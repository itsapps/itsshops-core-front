import { describe, it, expect } from 'vitest'
import { calculateTotals } from '../lib/totals'
import type { ValidatedCartItem, AvailableShippingMethod } from '../types/checkout'

function makeItem(overrides: Partial<ValidatedCartItem> = {}): ValidatedCartItem {
  return {
    variantId: 'v1',
    productId: 'p1',
    kind: 'wine',
    title: 'Wine A',
    subtitle: null,
    sku: null,
    price: 1200,
    weight: 750,
    quantity: 1,
    taxCategoryCode: 'standard',
    vatRate: 20,
    vatAmount: 200,
    wine: { vintage: '2023', volume: 750 },
    options: null,
    grantsFreeShipping: false,
    bundleItems: null,
    ...overrides,
  }
}

const shipping: AvailableShippingMethod = {
  _id: 'sm1',
  title: 'Standard',
  methodType: 'delivery',
  price: 500,
  isFree: false,
  taxCategoryCode: 'standard',
}

describe('calculateTotals', () => {
  it('calculates subtotal from items', () => {
    const items = [
      makeItem({ price: 1200, quantity: 2 }),
      makeItem({ price: 800, quantity: 1, variantId: 'v2' }),
    ]
    const result = calculateTotals(items, null, 0)
    expect(result.subtotal).toBe(3200) // 1200*2 + 800*1
  })

  it('includes shipping in grandTotal', () => {
    const items = [makeItem({ price: 1000, quantity: 1 })]
    const result = calculateTotals(items, shipping, 20)
    expect(result.subtotal).toBe(1000)
    expect(result.shipping).toBe(500)
    expect(result.grandTotal).toBe(1500)
  })

  it('calculates VAT breakdown with shipping', () => {
    const items = [makeItem({ price: 1200, quantity: 1, vatRate: 20 })]
    const result = calculateTotals(items, shipping, 20)
    // 1200 + 500 = 1700 at 20%
    // VAT = 1700 - 1700/1.20 = 1700 - 1417 = 283
    expect(result.vatBreakdown).toHaveLength(1)
    expect(result.vatBreakdown[0].rate).toBe(20)
    expect(result.vatBreakdown[0].vat).toBe(283)
    expect(result.tax).toBe(283)
  })

  it('handles mixed tax rates', () => {
    const items = [
      makeItem({ price: 1200, quantity: 1, vatRate: 20 }),
      makeItem({ price: 1100, quantity: 1, vatRate: 10, variantId: 'v2', taxCategoryCode: 'food' }),
    ]
    const result = calculateTotals(items, null, 0)
    expect(result.vatBreakdown).toHaveLength(2)
    const vat20 = result.vatBreakdown.find(v => v.rate === 20)!
    const vat10 = result.vatBreakdown.find(v => v.rate === 10)!
    expect(vat20.vat).toBe(200) // 1200 / 1.20 = 1000, vat = 200
    expect(vat10.vat).toBe(100) // 1100 / 1.10 = 1000, vat = 100
    expect(result.tax).toBe(300)
  })

  it('handles no shipping', () => {
    const items = [makeItem({ price: 1000, quantity: 1 })]
    const result = calculateTotals(items, null, 0)
    expect(result.shipping).toBe(0)
    expect(result.grandTotal).toBe(1000)
  })

  it('handles free shipping', () => {
    const freeShipping: AvailableShippingMethod = { ...shipping, price: 0, isFree: true }
    const items = [makeItem({ price: 1000, quantity: 1 })]
    const result = calculateTotals(items, freeShipping, 20)
    expect(result.shipping).toBe(0)
    expect(result.grandTotal).toBe(1000)
  })

  it('sets discount to 0 when no coupon passed', () => {
    const result = calculateTotals([makeItem()], null, 0)
    expect(result.discount).toBe(0)
  })

  describe('with coupon', () => {
    it('applies fixed discount and reduces grandTotal', () => {
      const items = [makeItem({ price: 1000, quantity: 1, vatRate: 20 })]
      const result = calculateTotals(items, shipping, 20, {
        discountAmount: 200,
        zeroShipping: false,
      })
      expect(result.subtotal).toBe(1000)
      expect(result.discount).toBe(200)
      expect(result.shipping).toBe(500)
      expect(result.grandTotal).toBe(1300) // 1000 - 200 + 500
    })

    it('reduces VAT proportionally to the discount', () => {
      // Item: 1200 gross at 20% VAT → original VAT 200
      // 10% discount = 120 cents → discounted gross = 1080 → new VAT = 180
      const items = [makeItem({ price: 1200, quantity: 1, vatRate: 20 })]
      const result = calculateTotals(items, null, 0, {
        discountAmount: 120,
        zeroShipping: false,
      })
      const vat20 = result.vatBreakdown.find((v) => v.rate === 20)!
      expect(vat20.vat).toBe(180)
    })

    it('zeroShipping coupon sets shipping to 0', () => {
      const items = [makeItem({ price: 1000, quantity: 1 })]
      const result = calculateTotals(items, shipping, 20, {
        discountAmount: 0,
        zeroShipping: true,
      })
      expect(result.shipping).toBe(0)
      expect(result.discount).toBe(0)
      expect(result.grandTotal).toBe(1000)
    })

    it('does not include shipping in VAT breakdown when zeroed by coupon', () => {
      const items = [makeItem({ price: 1000, quantity: 1, vatRate: 20 })]
      const result = calculateTotals(items, shipping, 20, {
        discountAmount: 0,
        zeroShipping: true,
      })
      // Without zeroShipping, breakdown would include the 500 shipping at 20%.
      // With zeroShipping, only the item contributes.
      expect(result.vatBreakdown).toHaveLength(1)
      const vat20 = result.vatBreakdown.find((v) => v.rate === 20)!
      // Item gross 1000 at 20% → VAT 167 (rounded)
      expect(vat20.vat).toBe(167)
    })

    it('discount + zeroShipping work together', () => {
      const items = [makeItem({ price: 1000, quantity: 1 })]
      const result = calculateTotals(items, shipping, 20, {
        discountAmount: 100,
        zeroShipping: true,
      })
      expect(result.subtotal).toBe(1000)
      expect(result.discount).toBe(100)
      expect(result.shipping).toBe(0)
      expect(result.grandTotal).toBe(900) // 1000 - 100 + 0
    })

    it('proportional discount across mixed VAT rates', () => {
      // Two items, equal gross, different VAT.
      // 200 cent discount → 100 cents off each line.
      const items = [
        makeItem({ price: 1000, quantity: 1, vatRate: 20 }),
        makeItem({ price: 1000, quantity: 1, vatRate: 10, variantId: 'v2' }),
      ]
      const result = calculateTotals(items, null, 0, {
        discountAmount: 200,
        zeroShipping: false,
      })
      expect(result.subtotal).toBe(2000)
      expect(result.discount).toBe(200)
      expect(result.grandTotal).toBe(1800)

      const vat20 = result.vatBreakdown.find((v) => v.rate === 20)!
      const vat10 = result.vatBreakdown.find((v) => v.rate === 10)!
      // Discounted item gross: 900 each
      // VAT 20%: 900 - 900/1.20 = 150
      // VAT 10%: 900 - 900/1.10 = 82
      expect(vat20.vat).toBe(150)
      expect(vat10.vat).toBe(82)
    })
  })
})

describe('calculateTotals with a mixed bundle', () => {
  // €30 box = 2 × €12 wine (13 %) + €6 juice (20 %), plus a loose €10 juice (20 %)
  const bundle = makeItem({
    kind: 'bundle', price: 3000, quantity: 1, vatRate: 13,
    bundleItems: [
      { key: 'a', variantId: 'w', productId: 'pw', title: 'Wein', subtitle: null, sku: null, quantity: 2, kind: 'wine', weight: null, wine: null, price: 2400, vatRate: 13, vatAmount: 276 },
      { key: 'b', variantId: 'j', productId: 'pj', title: 'Saft', subtitle: null, sku: null, quantity: 1, kind: 'physical', weight: null, wine: null, price: 600, vatRate: 20, vatAmount: 100 },
    ],
  })
  const loose = makeItem({ variantId: 'v2', price: 1000, vatRate: 20 })

  it('VAT per rate from the parts, no coupon', () => {
    const t = calculateTotals([bundle, loose], null, 0)
    expect(t.vatBreakdown).toEqual([
      { rate: 13, net: 2400 - 276, vat: 276 },
      { rate: 20, net: 1600 - 267, vat: 267 },
    ])
    expect(t.grandTotal).toBe(4000)
  })

  it('percent coupon (10 %): VAT per rate after discount, grand total to the cent', () => {
    const t = calculateTotals([bundle, loose], shipping, 20, { discountAmount: 400, zeroShipping: false })
    // 13 %: 2160 gross; 20 %: 1440 + 500 shipping = 1940
    expect(t.vatBreakdown).toEqual([
      { rate: 13, net: 2160 - 248, vat: 248 },
      { rate: 20, net: 1940 - 323, vat: 323 },
    ])
    expect(t.grandTotal).toBe(4000 - 400 + 500)
    expect(t.tax).toBe(248 + 323)
  })

  it('fixed coupon (€5) spread by gross over the parts', () => {
    const t = calculateTotals([bundle, loose], null, 0, { discountAmount: 500, zeroShipping: false })
    // factor 1/8: 13 % 2400 → 2100; 20 % 1600 → 1400
    expect(t.vatBreakdown.map(v => [v.rate, v.net + v.vat])).toEqual([[13, 2100], [20, 1400]])
    expect(t.grandTotal).toBe(3500)
  })
})
