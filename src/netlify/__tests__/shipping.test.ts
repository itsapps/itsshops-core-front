import { describe, it, expect } from 'vitest'
import {
  calculateCartWeight,
  estimateWineBottleWeight,
  findShippingRate,
  isFreeShipping,
  resolveShippingMethods,
  selectShippingMethod,
} from '../lib/shipping'
import type { ValidatedCartItem, SanityShippingMethodResult, AvailableShippingMethod } from '../types/checkout'

function makeItem(overrides: Partial<ValidatedCartItem> = {}): ValidatedCartItem {
  return {
    variantId: 'v1',
    productId: 'p1',
    kind: 'physical',
    title: 'Test',
    subtitle: null,
    sku: null,
    price: 1000,
    weight: 500, // grams
    quantity: 1,
    taxCategoryCode: 'standard',
    vatRate: 20,
    vatAmount: 167,
    wine: null,
    options: null,
    bundleItems: null,
    ...overrides,
  }
}

describe('calculateCartWeight', () => {
  it('sums weight of physical items in kg', () => {
    const items = [
      makeItem({ weight: 500, quantity: 2 }),
      makeItem({ weight: 1000, quantity: 1 }),
    ]
    expect(calculateCartWeight(items)).toBe(2) // (500*2 + 1000*1) / 1000
  })

  it('ignores digital items (validator sets their weight to null)', () => {
    const items = [
      makeItem({ kind: 'digital', weight: null, quantity: 1 }),
    ]
    expect(calculateCartWeight(items)).toBe(0)
  })

  it('ignores items without weight', () => {
    const items = [makeItem({ weight: null, quantity: 1 })]
    expect(calculateCartWeight(items)).toBe(0)
  })

  it('skips items with null weight', () => {
    const items = [
      makeItem({ kind: 'wine', weight: null, quantity: 1, wine: { vintage: null, volume: null } }),
    ]
    expect(calculateCartWeight(items)).toBe(0)
  })

  it('returns 0 for empty cart', () => {
    expect(calculateCartWeight([])).toBe(0)
  })
})

describe('estimateWineBottleWeight', () => {
  it('estimates standard 0.75 l bottle at 1250 g', () => {
    expect(estimateWineBottleWeight(750)).toBe(1250)
  })

  it('estimates half bottle (0.375 l) with smaller glass overhead', () => {
    expect(estimateWineBottleWeight(375)).toBe(725)
  })

  it('estimates 1 l bottle with heavier glass', () => {
    expect(estimateWineBottleWeight(1000)).toBe(1600)
  })

  it('estimates magnum (1.5 l) with heaviest glass tier', () => {
    expect(estimateWineBottleWeight(1500)).toBe(2300)
  })

  it('returns 0 for non-positive volume', () => {
    expect(estimateWineBottleWeight(0)).toBe(0)
    expect(estimateWineBottleWeight(-100)).toBe(0)
  })
})

describe('findShippingRate', () => {
  const rates = [
    { maxWeight: 5, price: 500 },
    { maxWeight: 10, price: 800 },
    { maxWeight: 30, price: 1500 },
  ]

  it('finds rate for weight within range', () => {
    expect(findShippingRate(rates, 3)).toEqual({ maxWeight: 5, price: 500 })
    expect(findShippingRate(rates, 5)).toEqual({ maxWeight: 5, price: 500 })
    expect(findShippingRate(rates, 7)).toEqual({ maxWeight: 10, price: 800 })
    expect(findShippingRate(rates, 25)).toEqual({ maxWeight: 30, price: 1500 })
  })

  it('returns null if weight exceeds all rates', () => {
    expect(findShippingRate(rates, 31)).toBeNull()
  })

  it('returns null for empty rates', () => {
    expect(findShippingRate([], 1)).toBeNull()
  })

  it('handles unsorted rates', () => {
    const unsorted = [
      { maxWeight: 30, price: 1500 },
      { maxWeight: 5, price: 500 },
      { maxWeight: 10, price: 800 },
    ]
    expect(findShippingRate(unsorted, 3)).toEqual({ maxWeight: 5, price: 500 })
  })
})

describe('isFreeShipping', () => {
  it('returns true when subtotal exceeds threshold (afterDiscount)', () => {
    expect(isFreeShipping(5000, 6000, 0, 'afterDiscount')).toBe(true)
  })

  it('returns false when subtotal below threshold (afterDiscount)', () => {
    expect(isFreeShipping(5000, 4000, 0, 'afterDiscount')).toBe(false)
  })

  it('considers discount with afterDiscount', () => {
    // 6000 - 2000 = 4000 < 5000
    expect(isFreeShipping(5000, 6000, 2000, 'afterDiscount')).toBe(false)
  })

  it('ignores discount with beforeDiscount', () => {
    // 6000 >= 5000, ignoring discount
    expect(isFreeShipping(5000, 6000, 2000, 'beforeDiscount')).toBe(true)
  })

  it('returns false when threshold is null', () => {
    expect(isFreeShipping(null, 100000, 0, 'afterDiscount')).toBe(false)
  })

  it('returns false when threshold is 0', () => {
    expect(isFreeShipping(0, 100000, 0, 'afterDiscount')).toBe(false)
  })
})

describe('resolveShippingMethods', () => {
  const methods: SanityShippingMethodResult[] = [
    {
      _id: 'sm1',
      title: [{ _key: 'de', value: 'Standardversand' }, { _key: 'en', value: 'Standard Shipping' }],
      methodType: 'delivery',
      pickupFee: null,
      freeShippingThreshold: 10000,
      taxCategoryCode: 'standard',
      rates: [
        { maxWeight: 5, price: 500 },
        { maxWeight: 30, price: 1200 },
      ],
    },
    {
      _id: 'sm2',
      title: [{ _key: 'de', value: 'Selbstabholung' }, { _key: 'en', value: 'Self Pickup' }],
      methodType: 'pickup',
      pickupFee: 0,
      freeShippingThreshold: null,
      taxCategoryCode: 'standard',
      rates: null,
    },
  ]

  it('resolves delivery method with correct price', () => {
    const items = [makeItem({ weight: 1000, quantity: 2 })] // 2kg
    const result = resolveShippingMethods(methods, items, 5000, 0, 'afterDiscount', 'de')
    const delivery = result.find(m => m.methodType === 'delivery')!
    expect(delivery.title).toBe('Standardversand')
    expect(delivery.price).toBe(500) // 2kg fits in 5kg tier
    expect(delivery.isFree).toBe(false)
  })

  it('applies free shipping when threshold exceeded', () => {
    const items = [makeItem({ weight: 1000, quantity: 1 })]
    const result = resolveShippingMethods(methods, items, 15000, 0, 'afterDiscount', 'de')
    const delivery = result.find(m => m.methodType === 'delivery')!
    expect(delivery.price).toBe(0)
    expect(delivery.isFree).toBe(true)
  })

  it('resolves pickup method', () => {
    const items = [makeItem()]
    const result = resolveShippingMethods(methods, items, 5000, 0, 'afterDiscount', 'en')
    const pickup = result.find(m => m.methodType === 'pickup')!
    expect(pickup.title).toBe('Self Pickup')
    expect(pickup.price).toBe(0)
  })

  it('falls back to weight-based rate when wine volume has no packaging config', () => {
    const methodWithPackaging: SanityShippingMethodResult[] = [{
      _id: 'sm-pkg',
      title: [{ _key: 'de', value: 'Weinversand' }],
      methodType: 'delivery',
      pickupFee: null,
      freeShippingThreshold: null,
      taxCategoryCode: 'standard',
      rates: [{ maxWeight: 30, price: 800 }],
      packagingConfigs: [
        { volume: 750, packages: [{ count: 6, price: 500 }] },
        // no config for 375ml
      ],
    }]
    const items = [
      makeItem({ kind: 'wine', weight: 725, quantity: 2, wine: { vintage: '2024', volume: 375 } }),
    ]
    const result = resolveShippingMethods(methodWithPackaging, items, 3000, 0, 'afterDiscount', 'de')
    expect(result).toHaveLength(1)
    // 2x 375ml bottles → no packaging config → estimated weight 725g each → 1.45kg → weight rate 800
    expect(result[0].price).toBe(800)
    expect(result[0].packagingLines).toEqual([])
  })

  it('allows packaging-only method when uncovered volume has no weight rates', () => {
    const methodWithPackaging: SanityShippingMethodResult[] = [{
      _id: 'sm-pkg',
      title: [{ _key: 'de', value: 'Weinversand' }],
      methodType: 'delivery',
      pickupFee: null,
      freeShippingThreshold: null,
      taxCategoryCode: 'standard',
      rates: null, // no weight-based rates
      packagingConfigs: [
        { volume: 750, packages: [{ count: 1, price: 300 }] },
      ],
    }]
    const items = [
      makeItem({ kind: 'wine', weight: 725, quantity: 1, wine: { vintage: '2024', volume: 375 } }),
    ]
    const result = resolveShippingMethods(methodWithPackaging, items, 3000, 0, 'afterDiscount', 'de')
    expect(result).toHaveLength(1)
    // no packaging config for 375ml, no weight rates → packaging cost only (0)
    expect(result[0].price).toBe(0)
  })

  it('combines packaging and weight-based fallback for mixed volumes', () => {
    const methodWithPackaging: SanityShippingMethodResult[] = [{
      _id: 'sm-pkg',
      title: [{ _key: 'de', value: 'Weinversand' }],
      methodType: 'delivery',
      pickupFee: null,
      freeShippingThreshold: null,
      taxCategoryCode: 'standard',
      rates: [{ maxWeight: 30, price: 400 }],
      packagingConfigs: [
        { volume: 750, packages: [{ count: 1, price: 300 }] },
        // no config for 375ml
      ],
    }]
    const items = [
      makeItem({ kind: 'wine', weight: null, quantity: 1, wine: { vintage: '2023', volume: 750 } }),
      makeItem({ variantId: 'v2', kind: 'wine', weight: null, quantity: 2, wine: { vintage: '2024', volume: 375 } }),
    ]
    const result = resolveShippingMethods(methodWithPackaging, items, 3000, 0, 'afterDiscount', 'de')
    expect(result).toHaveLength(1)
    // 1x 750ml → packaging 300 + 2x 375ml uncovered → weight fallback 400 = 700
    expect(result[0].price).toBe(700)
    expect(result[0].packagingLines).toHaveLength(1)
    expect(result[0].packagingLines![0]).toMatchObject({ volume: 750, packSize: 1, quantity: 1 })
  })

  it('skips delivery method if weight exceeds all rates', () => {
    const items = [makeItem({ weight: 31000, quantity: 1 })] // 31kg > max 30kg
    const result = resolveShippingMethods(methods, items, 5000, 0, 'afterDiscount', 'de')
    expect(result.filter(m => m.methodType === 'delivery')).toHaveLength(0)
    expect(result.filter(m => m.methodType === 'pickup')).toHaveLength(1)
  })
})

describe('selectShippingMethod', () => {
  const methods: AvailableShippingMethod[] = [
    { _id: 'sm1', title: 'Express', methodType: 'delivery', price: 1200, isFree: false, taxCategoryCode: 'standard' },
    { _id: 'sm2', title: 'Standard', methodType: 'delivery', price: 500, isFree: false, taxCategoryCode: 'standard' },
    { _id: 'sm3', title: 'Pickup', methodType: 'pickup', price: 0, isFree: true, taxCategoryCode: 'standard' },
  ]

  it('selects requested method', () => {
    expect(selectShippingMethod(methods, 'sm1')!._id).toBe('sm1')
  })

  it('selects cheapest delivery when no request', () => {
    expect(selectShippingMethod(methods)!._id).toBe('sm2')
  })

  it('falls back to first method if no delivery methods exist', () => {
    const pickupOnly = [methods[2]]
    expect(selectShippingMethod(pickupOnly)!._id).toBe('sm3')
  })

  it('returns null for empty methods', () => {
    expect(selectShippingMethod([])).toBeNull()
  })

  it('ignores invalid requested id', () => {
    expect(selectShippingMethod(methods, 'nonexistent')!._id).toBe('sm2')
  })
})
