import { describe, it, expect } from 'vitest'
import {
  couponToDiscount,
  productFreeShippingDiscount,
  discountIdForCoupon,
  hasLegacyDiscountShape,
  legacyLineDiscounts,
  migrateOrderDiscounts,
  verifyOrderDiscountMigration,
  discountMigrationHistoryEntry,
  PRODUCT_FREE_SHIPPING_DISCOUNT_ID,
  type LegacyCoupon,
  type OrderLike,
} from '../lib/discount-migration'
import legacy from './fixtures/wc-api-legacy-orders.json'

/** Old-shape orders + what the pre-6.0.0 wc-api sent for them (generated before step 15). */
const fixtures = legacy as unknown as { order: OrderLike & { orderNumber: string }; wc: { line_items: { total: string; total_tax: string }[] } }[]
const byNumber = (n: string) => structuredClone(fixtures.find(f => f.order.orderNumber === n)!.order)
const cents = (s: string) => Math.round(Number(s) * 100)
let n = 0
const key = () => `key${++n}`

function coupon(overrides: Partial<LegacyCoupon> = {}): LegacyCoupon {
  return {
    _id: 'coupon-abc',
    code: 'ZEHN',
    title: [{ _key: 'de', language: 'de', value: 'Zehn Prozent' }],
    enabled: true,
    discountType: 'percent',
    value: 10,
    validFrom: '2026-01-01T00:00:00Z',
    validTo: null,
    minSubtotal: 5000,
    maxRedemptions: 100,
    redemptionCount: 7,
    ...overrides,
  }
}

describe('couponToDiscount', () => {
  it('maps a percent coupon to an order code discount, keeping its fields', () => {
    const d = couponToDiscount(coupon())
    expect(d).toEqual({
      _id: 'discount-coupon-abc',
      _type: 'discount',
      title: [{ _key: 'de', language: 'de', value: 'Zehn Prozent' }],
      enabled: true,
      trigger: 'code',
      code: 'ZEHN',
      target: 'order',
      valueType: 'percent',
      value: 10,
      ignoreShopExclusions: false,
      minSubtotal: 5000,
      minSubtotalBasis: 'wholeCart',
      validFrom: '2026-01-01T00:00:00Z',
      maxRedemptions: 100,
      redemptionCount: 7,
      combinesWith: { items: false, order: false, shipping: true },
    })
  })

  it('maps freeShipping to a shipping discount that waives pickup too', () => {
    const d = couponToDiscount(coupon({ discountType: 'freeShipping', value: null }))
    expect(d.target).toBe('shipping')
    expect(d.valueType).toBe('free')
    expect(d.value).toBeUndefined()
    expect(d.appliesToPickup).toBe(true)
  })

  it('falls back to the code as title; a disabled coupon stays disabled', () => {
    const d = couponToDiscount(coupon({ title: null, enabled: false, redemptionCount: null }))
    expect(d.title).toEqual([{ _key: 'de', _type: 'internationalizedArrayStringValue', language: 'de', value: 'ZEHN' }])
    expect(d.enabled).toBe(false)
    expect(d.redemptionCount).toBe(0)
  })

  it('maps ids deterministically (also from a draft id)', () => {
    expect(discountIdForCoupon('abc')).toBe('discount-abc')
    expect(discountIdForCoupon('drafts.abc')).toBe('discount-abc')
  })
})

describe('productFreeShippingDiscount', () => {
  const bundles = ['b1', 'b2']

  it('none flagged → nothing', () => {
    expect(productFreeShippingDiscount([], bundles)).toBeNull()
  })

  it('all active bundles flagged → kind bundle', () => {
    const d = productFreeShippingDiscount([{ _id: 'b1', kind: 'bundle' }, { _id: 'b2', kind: 'bundle' }], bundles)!
    expect(d._id).toBe(PRODUCT_FREE_SHIPPING_DISCOUNT_ID)
    expect(d.appliesTo?.include).toEqual({ _type: 'productSelectorCriteria', kinds: ['bundle'] })
    expect(d.title.map(t => t.value)).toEqual(['Versandkostenfrei mit Weinpaket', 'Free shipping with a wine bundle'])
    expect(d).toMatchObject({
      trigger: 'automatic', target: 'shipping', valueType: 'free', enabled: true,
      appliesToPickup: false, redemptionCount: 0, minSubtotalBasis: 'wholeCart',
      combinesWith: { items: true, order: true, shipping: false },
    })
  })

  it('a subset or a non-bundle → the flagged variants', () => {
    const subset = productFreeShippingDiscount([{ _id: 'b1', kind: 'bundle' }], bundles)!
    expect(subset.appliesTo?.include.variants?.map(r => r._ref)).toEqual(['b1'])
    expect(subset.title.map(t => t.value)).toEqual(['Versandkostenfrei', 'Free shipping'])
    const mixed = productFreeShippingDiscount(
      [{ _id: 'b1', kind: 'bundle' }, { _id: 'b2', kind: 'bundle' }, { _id: 'w', kind: 'wine' }], bundles)!
    expect(mixed.appliesTo?.include.kinds).toBeUndefined()
    expect(mixed.appliesTo?.include.variants?.map(r => r._ref)).toEqual(['b1', 'b2', 'w'])
    expect(mixed.appliesTo?.include.variants?.[0]).toEqual({ _type: 'reference', _ref: 'b1', _weak: true, _key: 'b1' })
  })
})

describe('legacyLineDiscounts = what the old wc-api sent', () => {
  it.each(fixtures.map(f => [f.order.orderNumber, f] as const))('order %s', (_n, f) => {
    const discounts = legacyLineDiscounts(f.order)
    // Expanded lines in wc-api order: bundle → its items.
    const grosses = f.order.orderItems.flatMap(item =>
      item.kind === 'bundle' && item.bundle?.items?.length
        ? item.bundle.items.map(bi => bi.price * item.quantity)
        : [item.price * item.quantity])
    expect(discounts).toHaveLength(f.wc.line_items.length)
    f.wc.line_items.forEach((li, i) => {
      // line total + its tax = the discounted gross the old algorithm computed
      expect(cents(li.total) + cents(li.total_tax)).toBeCloseTo(grosses[i] - discounts[i], -0.5)
    })
  })
})

describe('migrateOrderDiscounts', () => {
  it('writes line discounts, converts the coupon, keeps every amount', () => {
    const order = byNumber('000008')
    const m = migrateOrderDiscounts(order, key)!
    expect(m.orderItems.map(i => i.discount)).toEqual([150, 50])
    expect(m.appliedDiscounts).toEqual([{
      _key: 'c-ZEHN', _type: 'appliedDiscount',
      discountRef: { _type: 'reference', _ref: 'discount-coupon-ZEHN', _weak: true },
      code: 'ZEHN', title: 'ZEHN', trigger: 'code', target: 'order', valueType: 'percent', value: 10, amount: 200,
    }])
    expect(m.freeShippingReason).toBeUndefined()
    expect(verifyOrderDiscountMigration(order, m)).toEqual([])
  })

  it('splits a bundle line over its items (children sum to the line)', () => {
    const order = byNumber('000101')
    const m = migrateOrderDiscounts(order, key)!
    const bundle = m.orderItems[0]
    const children = bundle.bundle!.items!.map(bi => bi.discount ?? 0)
    expect(children.reduce((a, b) => a + b, 0)).toBe(bundle.discount)
    expect(m.orderItems.reduce((s, i) => s + (i.discount ?? 0), 0)).toBe(858)
    expect(verifyOrderDiscountMigration(order, m)).toEqual([])
  })

  it('product free shipping → reason discount + an entry without ref or amount', () => {
    const order = byNumber('000103')
    const m = migrateOrderDiscounts(order, () => 'pfs')!
    expect(m.freeShippingReason).toBe('discount')
    expect(m.appliedDiscounts.at(-1)).toEqual({
      _key: 'pfs', _type: 'appliedDiscount', title: 'Versandkostenfrei durch Produkt',
      trigger: 'automatic', target: 'shipping', valueType: 'free',
    })
    expect(verifyOrderDiscountMigration(order, m)).toEqual([])
  })

  it('free-shipping coupon → shipping entry with the waived amount, no line discounts', () => {
    const order = byNumber('000104')
    const m = migrateOrderDiscounts(order, key)!
    expect(m.freeShippingReason).toBe('discount')
    expect(m.orderItems.every(i => i.discount === undefined)).toBe(true)
    expect(m.appliedDiscounts[0]).toMatchObject({ target: 'shipping', valueType: 'free', amount: 650 })
    expect(m.appliedDiscounts[0]).not.toHaveProperty('value')
  })

  it('English order: the product entry title is English', () => {
    const order = byNumber('000103')
    order.customer = { ...order.customer, locale: 'en' }
    expect(migrateOrderDiscounts(order, key)!.appliedDiscounts.at(-1)!.title).toBe('Free shipping (product)')
  })

  it('is idempotent: a migrated or new-shape order is skipped', () => {
    const order = byNumber('000008')
    const m = migrateOrderDiscounts(order, key)!
    const migrated = { ...order, orderItems: m.orderItems, appliedDiscounts: m.appliedDiscounts, appliedCoupons: undefined }
    expect(hasLegacyDiscountShape(migrated)).toBe(false)
    expect(migrateOrderDiscounts(migrated, key)).toBeNull()
  })

  it('skips orders with nothing to migrate', () => {
    const order = byNumber('000008')
    order.appliedCoupons = null
    order.totals = { ...order.totals, discount: 0, grandTotal: order.totals.subtotal + 650 }
    expect(migrateOrderDiscounts(order, key)).toBeNull()
  })

  it('covers every fixture without a problem', () => {
    for (const f of fixtures) {
      const order = structuredClone(f.order)
      const m = migrateOrderDiscounts(order, key)
      if (m) expect(verifyOrderDiscountMigration(order, m), f.order.orderNumber).toEqual([])
    }
  })
})

describe('verifyOrderDiscountMigration catches mismatches', () => {
  it('totals that don’t add up (sum ≠ totals.discount or a negative line)', () => {
    const order = byNumber('000008')
    order.totals = { ...order.totals, grandTotal: order.totals.grandTotal + 5 } // broken stored totals
    const m = migrateOrderDiscounts(order, key)!
    expect(verifyOrderDiscountMigration(order, m).join('\n')).toMatch(/discount|outside/)
  })

  it('a changed stored field', () => {
    const order = byNumber('000008')
    const m = migrateOrderDiscounts(order, key)!
    m.orderItems[0] = { ...m.orderItems[0], price: m.orderItems[0].price + 1 }
    expect(verifyOrderDiscountMigration(order, m)).toContain('line k0: stored fields changed')
  })

  it('bundle items not summing to their line', () => {
    const order = byNumber('000101')
    const m = migrateOrderDiscounts(order, key)!
    m.orderItems[0].bundle!.items![0] = { ...m.orderItems[0].bundle!.items![0], discount: 0 }
    expect(verifyOrderDiscountMigration(order, m).some(p => p.includes('bundle items sum'))).toBe(true)
  })
})

describe('discountMigrationHistoryEntry', () => {
  it('is a system entry', () => {
    expect(discountMigrationHistoryEntry('k', '2026-11-20T00:00:00Z')).toEqual({
      _key: 'k', _type: 'orderStatusHistory', type: 'system', status: 'discountsMigrated',
      timestamp: '2026-11-20T00:00:00Z', source: 'system',
    })
  })
})
