import { describe, it, expect } from 'vitest'
import {
  planDiscountMigration,
  applyDiscountMigration,
  describeDiscountMigration,
  type MigrationClient,
  type MigrationPatch,
} from '../lib/discount-migration-run'
import legacy from './fixtures/wc-api-legacy-orders.json'

type Doc = Record<string, any> & { _id: string; _type: string }

/**
 * An in-memory dataset answering the runner's queries by their shape (not a GROQ engine) and
 * applying its transactions, so a second run sees the first run's writes.
 */
function fakeDataset(initial: Doc[]) {
  const docs = new Map<string, Doc>(initial.map(d => [d._id, structuredClone({ _rev: 'r1', ...d })]))
  const isDraft = (id: string) => id.startsWith('drafts.') || id.startsWith('versions.')
  const all = () => [...docs.values()]
  const published = (type: string) => all().filter(d => d._type === type && !isDraft(d._id))
  const commits: string[] = []

  const client: MigrationClient = {
    async fetch<T>(query: string): Promise<T> {
      let result: unknown
      if (query.includes('_type == "coupon" || (_type == "productVariant"')) {
        result = all().filter(d => isDraft(d._id) && (d._type === 'coupon' || (d._type === 'productVariant' && d.grantsFreeShipping === true)))
          .map(d => ({ _id: d._id, _type: d._type }))
      } else if (query.startsWith('*[_type == "coupon"')) result = published('coupon')
      else if (query.startsWith('*[_type == "discount"')) result = published('discount').map(d => d._id)
      else if (query.includes('grantsFreeShipping == true')) result = published('productVariant').filter(d => d.grantsFreeShipping === true).map(({ _id, kind, status }) => ({ _id, kind, status }))
      else if (query.includes('kind == "bundle" && status == "active"')) result = published('productVariant').filter(d => d.kind === 'bundle' && d.status === 'active').map(d => d._id)
      else if (query.includes('defined(grantsFreeShipping)')) result = published('productVariant').filter(d => d.grantsFreeShipping !== undefined).map(d => d._id)
      else if (query.startsWith('*[_type == "order"')) result = structuredClone(published('order'))
      else throw new Error(`unexpected query ${query}`)
      return result as T
    },
    transaction() {
      const ops: (() => void)[] = []
      const tx = {
        createIfNotExists(doc: { _id: string; _type: string }) {
          ops.push(() => { if (!docs.has(doc._id)) docs.set(doc._id, structuredClone({ _rev: 'r1', ...doc })) })
          return tx
        },
        delete(id: string) { ops.push(() => { docs.delete(id) }); return tx },
        patch(id: string, build: (p: MigrationPatch) => MigrationPatch) {
          const steps: ((d: Doc) => void)[] = []
          let rev: string | null = null
          const p: MigrationPatch = {
            set: attrs => {
              steps.push(d => {
                for (const [k, v] of Object.entries(attrs)) {
                  const [head, ...rest] = k.split('.')
                  if (rest.length) d[head] = { ...d[head], [rest.join('.')]: v }
                  else d[k] = structuredClone(v)
                }
              })
              return p
            },
            unset: paths => { steps.push(d => { for (const k of paths) delete d[k] }); return p },
            setIfMissing: attrs => { steps.push(d => { for (const [k, v] of Object.entries(attrs)) d[k] ??= v }); return p },
            append: (path, items) => { steps.push(d => { d[path] = [...(d[path] ?? []), ...items] }); return p },
            ifRevisionId: r => { rev = r; return p },
          }
          build(p)
          ops.push(() => {
            const d = docs.get(id)
            if (!d) throw new Error(`patch on missing ${id}`)
            if (rev && d._rev !== rev) throw new Error(`revision mismatch on ${id}`)
            for (const step of steps) step(d)
            d._rev = `${d._rev}x`
          })
          return tx
        },
        async commit() {
          for (const op of ops) op()
          commits.push(`${ops.length} op(s)`)
        },
      }
      return tx
    },
  }
  return { client, docs, commits }
}

const coupon = (id: string, over: Doc | object = {}): Doc => ({
  _id: id, _type: 'coupon', code: id.toUpperCase(), title: [{ _key: 'de', language: 'de', value: id }],
  enabled: true, discountType: 'percent', value: 10, redemptionCount: 3, ...over,
})
const variant = (id: string, over: object = {}): Doc => ({ _id: id, _type: 'productVariant', kind: 'wine', status: 'active', ...over })
const fixtureOrders: Doc[] = (legacy as unknown as { order: Doc }[]).map(f => ({ ...f.order, _type: 'order' }))

function tinhofLike() {
  return fakeDataset([
    coupon('coupon-ZEHN'),
    coupon('coupon-FREI', { discountType: 'freeShipping', value: null }),
    variant('b1', { kind: 'bundle', grantsFreeShipping: true }),
    variant('b2', { kind: 'bundle', grantsFreeShipping: true }),
    variant('w1', { grantsFreeShipping: false }),
    variant('w2'),
    ...fixtureOrders,
  ])
}

describe('discount migration run', () => {
  it('dry run: plans every step, checks pass, writes nothing', async () => {
    const { client, commits } = tinhofLike()
    const plan = await planDiscountMigration(client)
    expect(plan.problems).toEqual([])
    expect(plan.coupons.map(c => c.discount._id)).toEqual(['discount-coupon-ZEHN', 'discount-coupon-FREI'])
    expect(plan.productFreeShipping?.discount.appliesTo?.include.kinds).toEqual(['bundle'])
    expect(plan.variantsToUnset.sort()).toEqual(['b1', 'b2', 'w1'])
    expect(plan.orders.length).toBeGreaterThan(0)
    expect(describeDiscountMigration(plan).at(-1)).toBe('Checks: all passed')
    expect(commits).toEqual([])
  })

  it('writes the plan; a second run finds nothing left', async () => {
    const { client, docs } = tinhofLike()
    await applyDiscountMigration(client, await planDiscountMigration(client))

    expect(docs.has('coupon-ZEHN')).toBe(false)
    expect(docs.get('discount-coupon-ZEHN')).toMatchObject({ trigger: 'code', target: 'order', redemptionCount: 3 })
    expect(docs.get('discount-coupon-FREI')).toMatchObject({ target: 'shipping', valueType: 'free', appliesToPickup: true })
    expect(docs.get('discount-product-free-shipping')).toMatchObject({ trigger: 'automatic', appliesToPickup: false })
    expect([...docs.values()].filter(d => d._type === 'productVariant' && 'grantsFreeShipping' in d)).toEqual([])
    for (const order of [...docs.values()].filter(d => d._type === 'order')) {
      expect(order).not.toHaveProperty('appliedCoupons')
      expect(['product', 'coupon']).not.toContain(order.fulfillment?.freeShippingReason)
      const lineSum = order.orderItems.reduce((s: number, i: { discount?: number }) => s + (i.discount ?? 0), 0)
      expect(lineSum).toBe(order.totals.discount)
    }
    const migrated = [...docs.values()].find(d => d._type === 'order' && d.statusHistory?.length)!
    expect(migrated.statusHistory.at(-1)).toMatchObject({ type: 'system', status: 'discountsMigrated' })

    const again = await planDiscountMigration(client)
    expect(again.coupons).toEqual([])
    expect(again.productFreeShipping).toBeNull()
    expect(again.variantsToUnset).toEqual([])
    expect(again.orders).toEqual([])
  })

  it('refuses while a draft coupon or flagged draft variant exists', async () => {
    const { client } = fakeDataset([coupon('drafts.coupon-X'), variant('drafts.b9', { kind: 'bundle', grantsFreeShipping: true })])
    const plan = await planDiscountMigration(client)
    expect(plan.problems).toHaveLength(2)
    await expect(applyDiscountMigration(client, plan)).rejects.toThrow()
  })

  it('a check mismatch blocks every write', async () => {
    const broken = { ...fixtureOrders.find(o => (o.totals as { discount: number }).discount > 0)! }
    // Totals that don't add up: line discounts can't reach totals.discount within the line gross.
    broken.totals = { ...broken.totals, discount: 999_999 }
    const { client, docs } = fakeDataset([coupon('coupon-ZEHN'), broken])
    const plan = await planDiscountMigration(client)
    expect(plan.problems.length).toBeGreaterThan(0)
    await expect(applyDiscountMigration(client, plan)).rejects.toThrow()
    expect(docs.has('coupon-ZEHN')).toBe(true)
  })
})
