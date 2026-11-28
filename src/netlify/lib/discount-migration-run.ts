// Runs the discounts migration against one dataset (`itsshops sanity migrate-discounts`). Plans
// everything first (preflight + every conversion + every check), writes only when nothing failed
// and the caller didn't ask for a dry run. Idempotent: a second run finds nothing left to do.
import {
  couponToDiscount,
  discountMigrationHistoryEntry,
  migrateOrderDiscounts,
  productFreeShippingDiscount,
  verifyOrderDiscountMigration,
  type FlaggedVariant,
  type LegacyCoupon,
  type MigratedDiscountDoc,
  type OrderDiscountMigration,
  type OrderLike,
} from './discount-migration'

/** The client calls the runner makes — a `@sanity/client` with `perspective: 'raw'` fits. */
export interface MigrationClient {
  fetch<T = unknown>(query: string, params?: Record<string, unknown>): Promise<T>
  transaction(): MigrationTransaction
}
export interface MigrationTransaction {
  createIfNotExists(doc: { _id: string; _type: string }): MigrationTransaction
  delete(id: string): MigrationTransaction
  patch(id: string, build: (p: MigrationPatch) => MigrationPatch): MigrationTransaction
  commit(): Promise<unknown>
}
export interface MigrationPatch {
  set(attrs: Record<string, unknown>): MigrationPatch
  unset(paths: string[]): MigrationPatch
  setIfMissing(attrs: Record<string, unknown>): MigrationPatch
  append(path: string, items: unknown[]): MigrationPatch
  ifRevisionId(rev: string): MigrationPatch
}

type StoredOrder = OrderLike & { _id: string; _rev: string; orderNumber?: string }

export interface MigrationPlan {
  /** `drafts.*` / `versions.*` coupons and flagged variants — the run refuses while any exist. */
  blockingDrafts: { _id: string; _type: string }[]
  coupons: { couponId: string; discount: MigratedDiscountDoc; exists: boolean }[]
  productFreeShipping: { discount: MigratedDiscountDoc; exists: boolean; flaggedCount: number } | null
  /** Variants still carrying a `grantsFreeShipping` field (true or false) — unset in step 2. */
  variantsToUnset: string[]
  orders: { order: StoredOrder; migration: OrderDiscountMigration; problems: string[] }[]
  /** Any check failed → nothing is written. */
  problems: string[]
}

const NOT_DRAFT = '!(_id in path("drafts.**")) && !(_id in path("versions.**"))'
const IS_DRAFT = '(_id in path("drafts.**") || _id in path("versions.**"))'

export async function planDiscountMigration(
  client: MigrationClient,
  options: { locales?: string[]; defaultLocale?: string } = {},
): Promise<MigrationPlan> {
  const locales = options.locales ?? ['de', 'en']
  const defaultLocale = options.defaultLocale ?? locales[0] ?? 'de'

  // 0. Preflight: an open draft would keep the old shape (or be published over the migration).
  const blockingDrafts = await client.fetch<{ _id: string; _type: string }[]>(
    `*[${IS_DRAFT} && (_type == "coupon" || (_type == "productVariant" && grantsFreeShipping == true))]{ _id, _type }`,
  )

  // 1. Coupons → discounts.
  const coupons = await client.fetch<LegacyCoupon[]>(`*[_type == "coupon" && ${NOT_DRAFT}]`)
  const existingIds = new Set(await client.fetch<string[]>(`*[_type == "discount" && ${NOT_DRAFT}]._id`))
  const couponPlans = coupons.map(c => {
    const discount = couponToDiscount(c, defaultLocale)
    return { couponId: c._id, discount, exists: existingIds.has(discount._id) }
  })

  // 2. Product free shipping → one automatic shipping discount.
  const flagged = await client.fetch<FlaggedVariant[]>(
    `*[_type == "productVariant" && ${NOT_DRAFT} && grantsFreeShipping == true]{ _id, kind, status }`,
  )
  const activeBundleIds = await client.fetch<string[]>(
    `*[_type == "productVariant" && ${NOT_DRAFT} && kind == "bundle" && status == "active"]._id`,
  )
  const freeShipping = productFreeShippingDiscount(flagged, activeBundleIds, locales)
  const variantsToUnset = await client.fetch<string[]>(
    `*[_type == "productVariant" && ${NOT_DRAFT} && defined(grantsFreeShipping)]._id`,
  )

  // 3. Orders (liveEdit, no drafts): convert + check each.
  const storedOrders = await client.fetch<StoredOrder[]>(`*[_type == "order" && ${NOT_DRAFT}] | order(orderNumber asc)`)
  const orders = storedOrders.flatMap(order => {
    const migration = migrateOrderDiscounts(order)
    if (!migration) return []
    return [{ order, migration, problems: verifyOrderDiscountMigration(order, migration) }]
  })

  const problems = [
    ...blockingDrafts.map(d => `open draft: ${d._type} ${d._id} — publish or discard it first`),
    ...orders.flatMap(o => o.problems.map(p => `order ${o.order.orderNumber ?? o.order._id}: ${p}`)),
  ]

  return {
    blockingDrafts,
    coupons: couponPlans,
    productFreeShipping: freeShipping
      ? { discount: freeShipping, exists: existingIds.has(freeShipping._id), flaggedCount: flagged.length }
      : null,
    variantsToUnset,
    orders,
    problems,
  }
}

const randomKey = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12)

/** Writes a plan (no problems allowed). Each coupon and each order is its own transaction. */
export async function applyDiscountMigration(client: MigrationClient, plan: MigrationPlan): Promise<void> {
  if (plan.problems.length > 0) throw new Error('Refusing to write a plan with problems')

  // 1. Create (if missing) + delete the coupon in one transaction.
  for (const c of plan.coupons) {
    await client.transaction().createIfNotExists(c.discount).delete(c.couponId).commit()
  }

  // 2. The automatic discount, then the flag off every variant (chunks of 100).
  if (plan.productFreeShipping) {
    await client.transaction().createIfNotExists(plan.productFreeShipping.discount).commit()
  }
  for (let i = 0; i < plan.variantsToUnset.length; i += 100) {
    const tx = client.transaction()
    for (const id of plan.variantsToUnset.slice(i, i + 100)) tx.patch(id, p => p.unset(['grantsFreeShipping']))
    await tx.commit()
  }

  // 3. Orders — `ifRevisionId`, so a concurrent write (refund webhook, editor) fails the order
  // instead of being overwritten; a re-run picks it up.
  for (const { order, migration } of plan.orders) {
    await client.transaction().patch(order._id, p => {
      const set: Record<string, unknown> = { orderItems: migration.orderItems }
      if (migration.appliedDiscounts.length > 0) set.appliedDiscounts = migration.appliedDiscounts
      if (migration.freeShippingReason) set['fulfillment.freeShippingReason'] = migration.freeShippingReason
      return p
        .ifRevisionId(order._rev)
        .set(set)
        .unset(['appliedCoupons'])
        .setIfMissing({ statusHistory: [] })
        .append('statusHistory', [discountMigrationHistoryEntry(randomKey())])
    }).commit()
  }
}

/** Human-readable summary of a plan (dry run and before the confirmation). */
export function describeDiscountMigration(plan: MigrationPlan): string[] {
  const lines: string[] = []
  lines.push(`0. Preflight: ${plan.blockingDrafts.length === 0 ? 'no open drafts' : `${plan.blockingDrafts.length} open draft(s)`}`)
  for (const d of plan.blockingDrafts) lines.push(`   ✗ ${d._type} ${d._id}`)
  lines.push(`1. Coupons → discounts: ${plan.coupons.length}`)
  for (const c of plan.coupons) {
    lines.push(`   ${c.couponId} → ${c.discount._id} (${c.discount.code}, ${c.discount.target}/${c.discount.valueType}${c.exists ? ', discount exists — only the coupon is deleted' : ''})`)
  }
  const fs = plan.productFreeShipping
  lines.push(`2. Product free shipping: ${fs ? `${fs.flaggedCount} flagged variant(s) → ${fs.discount._id}${fs.exists ? ' (exists)' : ''}` : 'none flagged'}`)
  if (fs) {
    const include = fs.discount.appliesTo?.include
    lines.push(`   appliesTo: ${include?.kinds ? `kind ${include.kinds.join(', ')}` : `${include?.variants?.length ?? 0} variant(s)`}`)
  }
  lines.push(`   unset grantsFreeShipping on ${plan.variantsToUnset.length} variant(s)`)
  lines.push(`3. Orders to migrate: ${plan.orders.length}`)
  for (const o of plan.orders) {
    const total = o.migration.orderItems.reduce((s, i) => s + (i.discount ?? 0), 0)
    const entries = o.migration.appliedDiscounts.map(d => d.code ?? d.title).join(', ') || '—'
    lines.push(`   ${o.order.orderNumber ?? o.order._id}: line discounts ${total} ct, entries: ${entries}${o.migration.freeShippingReason ? ', reason → discount' : ''} ${o.problems.length ? '✗' : '✓'}`)
    for (const p of o.problems) lines.push(`     ✗ ${p}`)
  }
  lines.push(plan.problems.length === 0 ? 'Checks: all passed' : `Checks: ${plan.problems.length} problem(s) — nothing will be written`)
  return lines
}
