// Discounts migration (core-back 7.0.0 / core-front 6.0.0): pure conversions from the coupon /
// product-free-shipping shapes to the discount model. Used by `itsshops sanity
// migrate-discounts` and, for unpaid old-shape `orderMeta`, by the payment webhook. Never
// changes an amount: totals, prices and VAT stay as stored. Plan:
// `.claude/plans/discounts-model.md` → Migration.

type Ref = { _type: 'reference'; _ref: string; _weak?: boolean; _key?: string }
type I18nValue = { _key: string; _type?: string; language?: string; value?: string }

/** A `coupon` document (core-back < 7.0.0). */
export interface LegacyCoupon {
  _id: string
  code: string
  title?: I18nValue[] | null
  description?: I18nValue[] | null
  enabled?: boolean | null
  discountType: 'percent' | 'fixed' | 'freeShipping'
  value?: number | null
  validFrom?: string | null
  validTo?: string | null
  minSubtotal?: number | null
  maxRedemptions?: number | null
  redemptionCount?: number | null
}

/** A `discount` document as the migration writes it. */
export interface MigratedDiscountDoc {
  _id: string
  _type: 'discount'
  title: I18nValue[]
  description?: I18nValue[]
  enabled: boolean
  trigger: 'code' | 'automatic'
  code?: string
  target: 'items' | 'order' | 'shipping'
  valueType: 'percent' | 'fixed' | 'free'
  value?: number
  appliesTo?: {
    _type: 'productSelector'
    include: { _type: 'productSelectorCriteria'; kinds?: string[]; variants?: Ref[] }
  }
  ignoreShopExclusions: boolean
  appliesToPickup?: boolean
  minSubtotal?: number
  minSubtotalBasis: 'wholeCart'
  validFrom?: string
  validTo?: string
  maxRedemptions?: number
  redemptionCount: number
  combinesWith: { items: boolean; order: boolean; shipping: boolean }
}

const definedOnly = <T extends object>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null)) as T

/** The migrated discount's id — deterministic, so order refs map without a lookup table. */
export const discountIdForCoupon = (couponId: string): string => `discount-${couponId.replace(/^drafts\./, '')}`

const i18nValue = (language: string, value: string): I18nValue => ({
  _key: language,
  _type: 'internationalizedArrayStringValue',
  language,
  value,
})

/** Step 1: `coupon` → `discount-<id>`. percent/fixed → an order discount, freeShipping → shipping. */
export function couponToDiscount(coupon: LegacyCoupon, defaultLocale = 'de'): MigratedDiscountDoc {
  const shipping = coupon.discountType === 'freeShipping'
  const title = coupon.title?.some(t => t.value) ? coupon.title : [i18nValue(defaultLocale, coupon.code)]
  return definedOnly({
    _id: discountIdForCoupon(coupon._id),
    _type: 'discount' as const,
    title,
    description: coupon.description ?? undefined,
    enabled: coupon.enabled === true,
    trigger: 'code' as const,
    code: coupon.code,
    target: shipping ? ('shipping' as const) : ('order' as const),
    valueType: shipping ? ('free' as const) : coupon.discountType as 'percent' | 'fixed',
    value: shipping ? undefined : coupon.value ?? undefined,
    ignoreShopExclusions: false,
    // A free-shipping coupon always waived a pickup fee too.
    appliesToPickup: shipping ? true : undefined,
    minSubtotal: coupon.minSubtotal ?? undefined,
    minSubtotalBasis: 'wholeCart' as const,
    validFrom: coupon.validFrom ?? undefined,
    validTo: coupon.validTo ?? undefined,
    maxRedemptions: coupon.maxRedemptions ?? undefined,
    redemptionCount: coupon.redemptionCount ?? 0,
    combinesWith: { items: false, order: false, shipping: true },
  })
}

export const PRODUCT_FREE_SHIPPING_DISCOUNT_ID = 'discount-product-free-shipping'

export interface FlaggedVariant {
  _id: string
  kind: string
  status?: string | null
}

const FREE_SHIPPING_TITLES: Record<'bundle' | 'variants', Record<string, string>> = {
  bundle: { de: 'Versandkostenfrei mit Weinpaket', en: 'Free shipping with a wine bundle' },
  variants: { de: 'Versandkostenfrei', en: 'Free shipping' },
}

/**
 * Step 2: variants with `grantsFreeShipping` → one automatic shipping discount (or `null` when
 * none is flagged). `appliesTo` = kind bundle when every active bundle is flagged and every
 * flagged variant is a bundle (Tinhof), else the flagged variants. Doesn't waive pickup (product
 * free shipping never did); stacks with items/order discounts (migrated codes), as today.
 */
export function productFreeShippingDiscount(
  flagged: FlaggedVariant[],
  activeBundleIds: string[],
  locales: string[] = ['de', 'en'],
): MigratedDiscountDoc | null {
  if (flagged.length === 0) return null
  const flaggedIds = new Set(flagged.map(v => v._id.replace(/^drafts\./, '')))
  const byKind = activeBundleIds.length > 0
    && flagged.every(v => v.kind === 'bundle')
    && activeBundleIds.every(id => flaggedIds.has(id))
  const titles = FREE_SHIPPING_TITLES[byKind ? 'bundle' : 'variants']
  return {
    _id: PRODUCT_FREE_SHIPPING_DISCOUNT_ID,
    _type: 'discount',
    title: locales.filter(l => titles[l]).map(l => i18nValue(l, titles[l])),
    enabled: true,
    trigger: 'automatic',
    target: 'shipping',
    valueType: 'free',
    appliesTo: {
      _type: 'productSelector',
      include: byKind
        ? { _type: 'productSelectorCriteria', kinds: ['bundle'] }
        : {
            _type: 'productSelectorCriteria',
            variants: [...flaggedIds].sort().map(id => ({ _type: 'reference', _ref: id, _weak: true, _key: id })),
          },
    },
    ignoreShopExclusions: false,
    appliesToPickup: false,
    minSubtotalBasis: 'wholeCart',
    redemptionCount: 0,
    combinesWith: { items: true, order: true, shipping: false },
  }
}

// ── Orders ──────────────────────────────────────────────────────────────────

export interface LegacyAppliedCoupon {
  _key: string
  _type?: 'appliedCoupon'
  couponRef?: Ref | null
  code: string
  discountType: 'percent' | 'fixed' | 'freeShipping'
  value?: number | null
  discountAmount: number
}

export interface MigratedAppliedDiscount {
  _key: string
  _type: 'appliedDiscount'
  discountRef?: { _type: 'reference'; _ref: string; _weak: true }
  code?: string
  title: string
  trigger: 'code' | 'automatic'
  target: 'items' | 'order' | 'shipping'
  valueType: 'percent' | 'fixed' | 'free'
  value?: number
  amount?: number
}

type OrderBundleItemLike = { _key: string; price: number; discount?: number; [k: string]: unknown }
type OrderItemLike = {
  _key: string
  kind: string
  price: number
  quantity: number
  discount?: number
  bundle?: { items?: OrderBundleItemLike[] | null; [k: string]: unknown } | null
  [k: string]: unknown
}

/** The parts of an `order` / `orderMeta` the migration reads. */
export interface OrderLike {
  orderItems: OrderItemLike[]
  totals: { subtotal: number; discount: number; grandTotal: number; [k: string]: unknown }
  fulfillment?: { shippingCost: number; freeShippingReason?: string | null; [k: string]: unknown } | null
  customer?: { locale?: string | null; [k: string]: unknown } | null
  appliedCoupons?: LegacyAppliedCoupon[] | null
  appliedDiscounts?: unknown[] | null
  [k: string]: unknown
}

const PRODUCT_ENTRY_TITLES: Record<string, string> = {
  de: 'Versandkostenfrei durch Produkt',
  en: 'Free shipping (product)',
}

/**
 * Whether a document still has the pre-7.0.0 discount shape: `appliedCoupons`, a legacy
 * free-shipping reason, or a discount without line discounts — and no `appliedDiscounts` / line
 * discounts yet (idempotency).
 */
export function hasLegacyDiscountShape(doc: OrderLike): boolean {
  if (doc.appliedDiscounts?.length) return false
  if (doc.orderItems.some(item => (item.discount ?? 0) > 0)) return false
  const reason = doc.fulfillment?.freeShippingReason
  return !!doc.appliedCoupons?.length || reason === 'product' || reason === 'coupon' || (doc.totals?.discount ?? 0) > 0
}

/** One line as the old wc-api expanded it: a bundle with a contents snapshot = one per item. */
type ExpandedLine = { itemIndex: number; childIndex: number | null; lineGross: number }

function expandLines(items: OrderItemLike[]): ExpandedLine[] {
  return items.flatMap((item, itemIndex): ExpandedLine[] => {
    const children = item.bundle?.items
    if (item.kind === 'bundle' && children?.length) {
      return children.map((bi, childIndex) => ({ itemIndex, childIndex, lineGross: bi.price * item.quantity }))
    }
    return [{ itemIndex, childIndex: null, lineGross: item.price * item.quantity }]
  })
}

/**
 * Gross discount per expanded line, computed **exactly as the wc-api did before 6.0.0**
 * (proportional, `Math.round`, remainder on the last line), so a migrated order sends wineNET
 * the same line totals it already received. Copied verbatim from `mapOrder`; don't "improve" it.
 */
export function legacyLineDiscounts(order: Pick<OrderLike, 'orderItems' | 'totals' | 'fulfillment'>): number[] {
  const t = order.totals
  const f = order.fulfillment
  const wcLines = expandLines(order.orderItems)
  const discountFactor = t.subtotal > 0 ? t.discount / t.subtotal : 0
  const discountedGrossPerItem = wcLines.map(line =>
    Math.round(line.lineGross * (1 - discountFactor))
  )
  const expectedLineTotal = t.grandTotal - (f ? f.shippingCost : 0)
  const roundingRemainder = expectedLineTotal - discountedGrossPerItem.reduce((s, v) => s + v, 0)
  if (discountedGrossPerItem.length > 0)
    discountedGrossPerItem[discountedGrossPerItem.length - 1] += roundingRemainder
  return wcLines.map((line, i) => line.lineGross - discountedGrossPerItem[i])
}

function appliedFromCoupon(coupon: LegacyAppliedCoupon): MigratedAppliedDiscount {
  const shipping = coupon.discountType === 'freeShipping'
  return definedOnly({
    _key: coupon._key,
    _type: 'appliedDiscount' as const,
    discountRef: coupon.couponRef?._ref
      ? { _type: 'reference' as const, _ref: discountIdForCoupon(coupon.couponRef._ref), _weak: true as const }
      : undefined,
    code: coupon.code,
    title: coupon.code,
    trigger: 'code' as const,
    target: shipping ? ('shipping' as const) : ('order' as const),
    valueType: shipping ? ('free' as const) : coupon.discountType as 'percent' | 'fixed',
    value: shipping ? undefined : coupon.value ?? undefined,
    amount: coupon.discountAmount,
  })
}

export interface OrderDiscountMigration {
  orderItems: OrderItemLike[]
  appliedDiscounts: MigratedAppliedDiscount[]
  /** Set only when it changes (`product` / `coupon` → `discount`). */
  freeShippingReason?: 'discount'
}

/**
 * Step 3 for one order (or an old-shape `orderMeta`): line discounts by the old wc-api
 * algorithm, `appliedCoupons` → `appliedDiscounts`, reason `product` / `coupon` → `discount`
 * (+ a "Versandkostenfrei durch Produkt" entry without ref or amount for `product`). `null` when
 * the document has nothing to migrate. Amounts are never touched — check with
 * `verifyOrderDiscountMigration`.
 */
export function migrateOrderDiscounts(
  order: OrderLike,
  makeKey: () => string = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12),
): OrderDiscountMigration | null {
  if (!hasLegacyDiscountShape(order)) return null

  const lineDiscounts = legacyLineDiscounts(order)
  const expanded = expandLines(order.orderItems)
  const perItem = order.orderItems.map(() => 0)
  const perChild = order.orderItems.map(item => (item.bundle?.items ?? []).map(() => 0))
  expanded.forEach((line, i) => {
    perItem[line.itemIndex] += lineDiscounts[i]
    if (line.childIndex !== null) perChild[line.itemIndex][line.childIndex] = lineDiscounts[i]
  })

  const orderItems = order.orderItems.map((item, i) => {
    if (perItem[i] === 0 && !perChild[i].some(d => d !== 0)) return item
    const children = item.bundle?.items
    return {
      ...item,
      discount: perItem[i],
      ...(item.kind === 'bundle' && children?.length && {
        bundle: {
          ...item.bundle,
          items: children.map((bi, c) => (perChild[i][c] === 0 ? bi : { ...bi, discount: perChild[i][c] })),
        },
      }),
    }
  })

  const appliedDiscounts = (order.appliedCoupons ?? []).map(appliedFromCoupon)
  const reason = order.fulfillment?.freeShippingReason
  if (reason === 'product') {
    const locale = order.customer?.locale ?? 'de'
    appliedDiscounts.push({
      _key: makeKey(),
      _type: 'appliedDiscount',
      title: PRODUCT_ENTRY_TITLES[locale] ?? PRODUCT_ENTRY_TITLES.de,
      trigger: 'automatic',
      target: 'shipping',
      valueType: 'free',
    })
  }

  return {
    orderItems,
    appliedDiscounts,
    ...((reason === 'product' || reason === 'coupon') && { freeShippingReason: 'discount' as const }),
  }
}

/**
 * The migration's check: amounts unchanged (every stored field but the new `discount`s), sum of
 * line discounts = `totals.discount`, every line and bundle-item discount within 0…its gross,
 * bundle items sum to their line. Returns the problems (empty = ok) — the CLI aborts on any.
 */
export function verifyOrderDiscountMigration(before: OrderLike, migration: OrderDiscountMigration): string[] {
  const problems: string[] = []
  const strip = (item: OrderItemLike) => {
    const { discount: _d, bundle, ...rest } = item
    const items = bundle?.items?.map(({ discount: _bd, ...bi }) => bi)
    return JSON.stringify({ ...rest, bundle: bundle ? { ...bundle, items } : bundle })
  }
  if (migration.orderItems.length !== before.orderItems.length) problems.push('line count changed')
  migration.orderItems.forEach((item, i) => {
    const old = before.orderItems[i]
    if (!old || strip(item) !== strip(old)) problems.push(`line ${item._key}: stored fields changed`)
    const gross = item.price * item.quantity
    const d = item.discount ?? 0
    if (!Number.isInteger(d) || d < 0 || d > gross) problems.push(`line ${item._key}: discount ${d} outside 0…${gross}`)
    const children = item.bundle?.items
    if (item.kind === 'bundle' && children?.length) {
      const sum = children.reduce((s, bi) => s + (bi.discount ?? 0), 0)
      if (sum !== d) problems.push(`line ${item._key}: bundle items sum to ${sum}, line has ${d}`)
      for (const bi of children) {
        const cd = bi.discount ?? 0
        const cg = bi.price * item.quantity
        if (cd < 0 || cd > cg) problems.push(`line ${item._key}/${bi._key}: discount ${cd} outside 0…${cg}`)
      }
    }
  })
  const total = migration.orderItems.reduce((s, item) => s + (item.discount ?? 0), 0)
  if (total !== (before.totals.discount ?? 0)) {
    problems.push(`line discounts sum to ${total}, totals.discount is ${before.totals.discount}`)
  }
  return problems
}

/**
 * The webhook transition (until 30 days after the last live shop's release): an unpaid
 * `orderMeta` written by the old frontend → the new shape, so the order is created as a migrated
 * one. Documents already in the new shape come back unchanged.
 */
export function convertLegacyOrderMeta<T extends OrderLike>(meta: T): T {
  const migration = migrateOrderDiscounts(meta)
  if (!migration) return meta
  const { appliedCoupons: _old, ...rest } = meta
  return {
    ...rest,
    orderItems: migration.orderItems,
    ...(migration.appliedDiscounts.length > 0 && { appliedDiscounts: migration.appliedDiscounts }),
    ...(migration.freeShippingReason && meta.fulfillment && {
      fulfillment: { ...meta.fulfillment, freeShippingReason: migration.freeShippingReason },
    }),
  } as unknown as T
}

/** The `system` history entry a migrated order gets. */
export function discountMigrationHistoryEntry(key: string, timestamp = new Date().toISOString()) {
  return {
    _key: key,
    _type: 'orderStatusHistory' as const,
    type: 'system' as const,
    status: 'discountsMigrated',
    timestamp,
    source: 'system',
  }
}
