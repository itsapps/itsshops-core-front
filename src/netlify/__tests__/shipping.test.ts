import { describe, it, expect } from 'vitest'
import {
  calculateCartWeight,
  estimateWineBottleWeight,
  findShippingRate,
  isFreeShipping,
  resolveShippingMethods,
  selectShippingMethod,
} from '../lib/shipping'
import type {
  ValidatedCartItem,
  SanityShippingMethodResult,
  SanityPackagingGroupResult,
  AvailableShippingMethod,
} from '../types/checkout'

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
      title: [{ language: 'de', value: 'Standardversand' }, { language: 'en', value: 'Standard Shipping' }],
      methodType: 'delivery',
      pickupFee: null,
      freeShippingThreshold: 10000,
      taxCategoryCode: 'standard',
      rates: [
        { maxWeight: 5, price: 500 },
        { maxWeight: 30, price: 1200 },
      ],
      packagingGroups: null,
    },
    {
      _id: 'sm2',
      title: [{ language: 'de', value: 'Selbstabholung' }, { language: 'en', value: 'Self Pickup' }],
      methodType: 'pickup',
      pickupFee: 0,
      freeShippingThreshold: null,
      taxCategoryCode: 'standard',
      rates: null,
      packagingGroups: null,
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

  // Tinhof-style setup: half bottles share the 0.75 l boxes (2 per place), magnums their own box.
  const tinhofGroups: SanityPackagingGroupResult[] = [
    {
      bottles: [{ volume: 750, perPlace: 1 }, { volume: 375, perPlace: 2 }],
      packages: [
        { places: 1, price: 600 },
        { places: 2, price: 650 },
        { places: 3, price: 700 },
        { places: 6, price: 800 },
        { places: 12, price: 1050 },
      ],
    },
    { bottles: [{ volume: 1500, perPlace: 1 }], packages: [{ places: 1, price: 750 }] },
  ]
  const packagingMethod = (
    packagingGroups: SanityPackagingGroupResult[],
    rates: SanityShippingMethodResult['rates'] = null,
  ): SanityShippingMethodResult[] => [{
    _id: 'sm-pkg',
    title: [{ language: 'de', value: 'Weinversand' }],
    methodType: 'delivery',
    pickupFee: null,
    freeShippingThreshold: null,
    taxCategoryCode: 'standard',
    rates,
    packagingGroups,
  }]
  const wine = (volume: number, quantity: number, variantId = `w${volume}`) =>
    makeItem({ variantId, kind: 'wine', weight: null, quantity, wine: { vintage: '2024', volume } })
  const resolvePackaging = (items: ValidatedCartItem[], groups = tinhofGroups, rates: SanityShippingMethodResult['rates'] = null) =>
    resolveShippingMethods(packagingMethod(groups, rates), items, 3000, 0, 'afterDiscount', 'de')

  it.each([
    // [cart, price, box places]
    ['2 × 375', [wine(375, 2)], 600, 1],
    ['12 × 375', [wine(375, 12)], 800, 6],
    ['4 × 750 + 4 × 375', [wine(750, 4), wine(375, 4)], 800, 6],
    ['3 × 375 (1.5 places → 2)', [wine(375, 3)], 650, 2],
    ['4 × 750 + 3 × 375 (5.5 places → 6, rounded once)', [wine(750, 4), wine(375, 3)], 800, 6],
    ['1 × 375 (half a place → 1)', [wine(375, 1)], 600, 1],
  ])('packs half bottles into the shared boxes: %s', (_label, items, price, packSize) => {
    const result = resolvePackaging(items)
    expect(result).toHaveLength(1)
    expect(result[0].price).toBe(price)
    expect(result[0].packagingLines).toEqual([{ volumes: [750, 375], packSize, quantity: 1, price }])
  })

  it('prices each group separately and snapshots one line per box size', () => {
    const result = resolvePackaging([wine(750, 7), wine(1500, 2)])
    // 7 places → a 12-box (1050) beats 6-box + 1-box (1400); 2 magnums → 2 × 1-box (750)
    expect(result[0].price).toBe(1050 + 1500)
    expect(result[0].packagingLines).toEqual([
      { volumes: [750, 375], packSize: 12, quantity: 1, price: 1050 },
      { volumes: [1500], packSize: 1, quantity: 2, price: 750 },
    ])
  })

  it('rounds up exactly across mixed perPlace values', () => {
    const groups: SanityPackagingGroupResult[] = [{
      bottles: [{ volume: 750, perPlace: 1 }, { volume: 375, perPlace: 2 }, { volume: 187, perPlace: 3 }],
      packages: [{ places: 1, price: 100 }],
    }]
    // 1 + 1/2 + 2/3 = 2.17 places → 3
    const result = resolvePackaging([wine(750, 1), wine(375, 1), wine(187, 2)], groups)
    expect(result[0].price).toBe(300)
  })

  it('puts an unlisted bottle size into the next larger size\'s group, one per place', () => {
    // 500 ml is in no group → 0.75 l group, 1 place each: 4 × 750 + 2 × 500 = 6 places
    const result = resolvePackaging([wine(750, 4), wine(500, 2)])
    expect(result).toHaveLength(1)
    expect(result[0].price).toBe(800)
    expect(result[0].packagingLines).toEqual([{ volumes: [750, 500, 375], packSize: 6, quantity: 1, price: 800 }])
  })

  it('drops the method when a bottle is larger than every listed size', () => {
    expect(resolvePackaging([wine(3000, 1)])).toHaveLength(0)
  })

  it('drops the method when a wine has no volume', () => {
    const items = [makeItem({ kind: 'wine', weight: null, quantity: 1, wine: { vintage: '2024', volume: null } })]
    expect(resolvePackaging(items)).toHaveLength(0)
  })

  it('drops the method when a group has no boxes', () => {
    const groups: SanityPackagingGroupResult[] = [{ bottles: [{ volume: 750, perPlace: 1 }], packages: [] }]
    expect(resolvePackaging([wine(750, 1)], groups)).toHaveLength(0)
  })

  it('keeps separate groups per size (Jurtschitsch-style) unchanged', () => {
    const groups: SanityPackagingGroupResult[] = [
      { bottles: [{ volume: 750, perPlace: 1 }], packages: [{ places: 1, price: 300 }, { places: 6, price: 500 }] },
      { bottles: [{ volume: 1500, perPlace: 1 }], packages: [{ places: 1, price: 400 }] },
    ]
    // 4 × 750 → a 6-box (500) is cheaper than 4 × 1-box (1200); 1 × 1500 → 400
    const result = resolvePackaging([wine(750, 4), wine(1500, 1)], groups)
    expect(result[0].price).toBe(900)
  })

  it('adds weight rates for non-wine items on top of the packaging', () => {
    const items = [wine(375, 2), makeItem({ variantId: 'p1', kind: 'physical', weight: 500, quantity: 1 })]
    const result = resolvePackaging(items, tinhofGroups, [{ maxWeight: 30, price: 400 }])
    expect(result[0].price).toBe(600 + 400)
  })

  it('counts wine bottles inside bundles for packaging', () => {
    const methodWithPackaging: SanityShippingMethodResult[] = [{
      _id: 'sm-pkg',
      title: [{ language: 'de', value: 'Weinversand' }],
      methodType: 'delivery',
      pickupFee: null,
      freeShippingThreshold: null,
      taxCategoryCode: 'standard',
      rates: null,
      packagingGroups: [
        { bottles: [{ volume: 750, perPlace: 1 }], packages: [{ places: 6, price: 600 }] },
      ],
    }]
    // bundle of 6x 750ml wine bottles
    const items = [
      makeItem({
        kind: 'bundle',
        weight: 7500,
        quantity: 1,
        wine: null,
        bundleItems: [
          { variantId: 'w1', quantity: 6, kind: 'wine', weight: 1250, wine: { volume: 750 } },
        ],
      }),
    ]
    const result = resolveShippingMethods(methodWithPackaging, items, 3000, 0, 'afterDiscount', 'de')
    expect(result).toHaveLength(1)
    // 6 bottles → 1x 6-pack at 600
    expect(result[0].price).toBe(600)
    expect(result[0].packagingLines).toHaveLength(1)
    expect(result[0].packagingLines![0]).toMatchObject({ volumes: [750], packSize: 6, quantity: 1 })
  })

  it('multiplies bundle wine children by bundle quantity', () => {
    const methodWithPackaging: SanityShippingMethodResult[] = [{
      _id: 'sm-pkg',
      title: [{ language: 'de', value: 'Weinversand' }],
      methodType: 'delivery',
      pickupFee: null,
      freeShippingThreshold: null,
      taxCategoryCode: 'standard',
      rates: null,
      packagingGroups: [
        { bottles: [{ volume: 750, perPlace: 1 }], packages: [{ places: 6, price: 600 }] },
      ],
    }]
    // 2x bundle of 3x 750ml = 6 bottles total
    const items = [
      makeItem({
        kind: 'bundle',
        weight: 3750,
        quantity: 2,
        wine: null,
        bundleItems: [
          { variantId: 'w1', quantity: 3, kind: 'wine', weight: 1250, wine: { volume: 750 } },
        ],
      }),
    ]
    const result = resolveShippingMethods(methodWithPackaging, items, 3000, 0, 'afterDiscount', 'de')
    expect(result).toHaveLength(1)
    expect(result[0].price).toBe(600)
  })

  it('handles mixed bundle: wine children packaged, non-wine children weight-based', () => {
    const methodWithPackaging: SanityShippingMethodResult[] = [{
      _id: 'sm-pkg',
      title: [{ language: 'de', value: 'Weinversand' }],
      methodType: 'delivery',
      pickupFee: null,
      freeShippingThreshold: null,
      taxCategoryCode: 'standard',
      rates: [{ maxWeight: 30, price: 400 }],
      packagingGroups: [
        { bottles: [{ volume: 750, perPlace: 1 }], packages: [{ places: 1, price: 300 }] },
      ],
    }]
    // bundle: 1x 750ml wine + 1x physical (500g)
    const items = [
      makeItem({
        kind: 'bundle',
        weight: 1750,
        quantity: 1,
        wine: null,
        bundleItems: [
          { variantId: 'w1', quantity: 1, kind: 'wine', weight: 1250, wine: { volume: 750 } },
          { variantId: 'p1', quantity: 1, kind: 'physical', weight: 500, wine: null },
        ],
      }),
    ]
    const result = resolveShippingMethods(methodWithPackaging, items, 3000, 0, 'afterDiscount', 'de')
    expect(result).toHaveLength(1)
    // 1x 750ml → packaging 300, 1x physical 500g → weight rate 400
    expect(result[0].price).toBe(700)
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
