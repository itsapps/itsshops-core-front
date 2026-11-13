import { describe, it, expect } from 'vitest'
import { validateCart } from '../lib/cart-validator'
import { extractVat } from '../lib/tax'
import type { SanityVariantResult, SanityTaxRuleResult, SanityBundleItemResult } from '../types/checkout'

const taxRules: SanityTaxRuleResult[] = [
  { taxCategoryCode: 'standard', rate: 20 },
  { taxCategoryCode: 'food', rate: 10 },
]

function makeVariant(overrides: Partial<SanityVariantResult> = {}): SanityVariantResult {
  return {
    _id: 'v1',
    status: 'active',
    kind: 'wine',
    title: [{ language: 'de', value: 'Blaufränkisch 2023' }],
    sku: 'BF-2023',
    price: 1500,
    weight: 1200,
    stock: 10,
    productId: 'product-123',
    taxCategoryCode: 'standard',
    productTitle: [{ language: 'de', value: 'Blaufränkisch' }],
    productWeight: null,
    productPrice: 1400,
    productTaxCategoryCode: 'standard',
    wine: { vintage: '2023', volume: 750 },
    options: null,
    bundleItems: null,
    ...overrides,
  }
}

/** An active wine bundle item (€15, 750 ml) — `id` names it in title, sku, product. */
function bundleItem(
  id: string,
  quantity: number,
  overrides: Partial<NonNullable<SanityBundleItemResult['variant']>> = {},
): SanityBundleItemResult {
  return {
    _key: `k-${id}`,
    quantity,
    variant: {
      _id: id,
      status: 'active',
      kind: 'wine',
      title: [{ language: 'de', value: `Item ${id}` }],
      sku: `SKU-${id}`,
      price: 1500,
      weight: null,
      productId: `p-${id}`,
      productTitle: [{ language: 'de', value: `Product ${id}` }],
      productWeight: null,
      productPrice: null,
      taxCategoryCode: 'standard',
      productTaxCategoryCode: null,
      stock: 100,
      wine: { vintage: '2023', volume: 750 },
      options: null,
      ...overrides,
    },
  }
}

describe('validateCart', () => {
  it('validates a simple cart', () => {
    const result = validateCart(
      [{ variantId: 'v1', quantity: 2 }],
      [makeVariant()],
      taxRules,
      'de',
    )
    expect(result.items).toHaveLength(1)
    expect(result.unavailableItems).toHaveLength(0)

    const item = result.items[0]
    expect(item.variantId).toBe('v1')
    expect(item.price).toBe(1500)
    expect(item.quantity).toBe(2)
    expect(item.vatRate).toBe(20)
    expect(item.title).toBe('Blaufränkisch 2023')
    expect(item.subtitle).toBe('0,75l, 2023')
    expect(item.wine).toEqual({ vintage: '2023', volume: 750 })
  })

  it('marks missing variants as unavailable', () => {
    const result = validateCart(
      [{ variantId: 'missing', quantity: 1 }],
      [makeVariant()],
      taxRules,
      'de',
    )
    expect(result.items).toHaveLength(0)
    expect(result.unavailableItems).toEqual(['missing'])
  })

  it('marks non-active variants as unavailable', () => {
    const result = validateCart(
      [{ variantId: 'v1', quantity: 1 }],
      [makeVariant({ status: 'soldOut' })],
      taxRules,
      'de',
    )
    expect(result.items).toHaveLength(0)
    expect(result.unavailableItems).toEqual(['v1'])
  })

  it('caps quantity to stock', () => {
    const result = validateCart(
      [{ variantId: 'v1', quantity: 15 }],
      [makeVariant({ stock: 5 })],
      taxRules,
      'de',
    )
    expect(result.items[0].quantity).toBe(5)
  })

  it('marks as unavailable when stock is 0', () => {
    const result = validateCart(
      [{ variantId: 'v1', quantity: 1 }],
      [makeVariant({ stock: 0 })],
      taxRules,
      'de',
    )
    expect(result.items).toHaveLength(0)
    expect(result.unavailableItems).toEqual(['v1'])
  })

  it('does not cap stock when stock feature is disabled', () => {
    const result = validateCart(
      [{ variantId: 'v1', quantity: 100 }],
      [makeVariant({ stock: 5 })],
      taxRules,
      'de',
      'de',
      false, // hasStockFeature = false
    )
    expect(result.items[0].quantity).toBe(100)
  })

  it('falls back to product price when variant has no price', () => {
    const result = validateCart(
      [{ variantId: 'v1', quantity: 1 }],
      [makeVariant({ price: null, productPrice: 1400 })],
      taxRules,
      'de',
    )
    expect(result.items[0].price).toBe(1400)
  })

  it('marks as unavailable when no price at all', () => {
    const result = validateCart(
      [{ variantId: 'v1', quantity: 1 }],
      [makeVariant({ price: null, productPrice: null })],
      taxRules,
      'de',
    )
    expect(result.unavailableItems).toEqual(['v1'])
  })

  it('falls back to product tax category', () => {
    const result = validateCart(
      [{ variantId: 'v1', quantity: 1 }],
      [makeVariant({ taxCategoryCode: null, productTaxCategoryCode: 'food' })],
      taxRules,
      'de',
    )
    expect(result.items[0].vatRate).toBe(10)
  })

  it('resolves options for physical variants', () => {
    const result = validateCart(
      [{ variantId: 'v1', quantity: 1 }],
      [makeVariant({
        kind: 'physical',
        wine: null,
        options: [
          { title: [{ language: 'de', value: 'Rot' }], groupTitle: [{ language: 'de', value: 'Farbe' }] },
        ],
      })],
      taxRules,
      'de',
    )
    expect(result.items[0].options).toEqual([
      { groupTitle: 'Farbe', optionTitle: 'Rot' },
    ])
  })

  describe('grantsFreeShipping', () => {
    const validate = (variant: SanityVariantResult, cartItem: Record<string, unknown> = {}) =>
      validateCart([{ variantId: 'v1', quantity: 1, ...cartItem } as never], [variant], taxRules, 'de').items[0]

    it('takes the flag from the server variant', () => {
      expect(validate(makeVariant({ grantsFreeShipping: true })).grantsFreeShipping).toBe(true)
      expect(validate(makeVariant({ grantsFreeShipping: null })).grantsFreeShipping).toBe(false)
      expect(validate(makeVariant()).grantsFreeShipping).toBe(false)
    })

    it('ignores a client-sent flag', () => {
      expect(validate(makeVariant(), { grantsFreeShipping: true }).grantsFreeShipping).toBe(false)
    })

    it('is false for digital variants', () => {
      const digital = makeVariant({ kind: 'digital', wine: null, grantsFreeShipping: true })
      expect(validate(digital).grantsFreeShipping).toBe(false)
    })

    it('a flagged bundle flags its line; a flagged child does not', () => {
      const child = bundleItem('child1', 2)
      const flaggedChild = { ...child, variant: { ...child.variant!, grantsFreeShipping: true } as never }
      const bundle = (flag: boolean, items: SanityBundleItemResult[]) =>
        makeVariant({ kind: 'bundle', wine: null, price: 3000, grantsFreeShipping: flag, bundleItems: items })
      expect(validate(bundle(true, [child])).grantsFreeShipping).toBe(true)
      expect(validate(bundle(false, [flaggedChild])).grantsFreeShipping).toBe(false)
    })
  })

  it('resolves bundle items and aggregates child weights', () => {
    const result = validateCart(
      [{ variantId: 'v1', quantity: 1 }],
      [makeVariant({
        kind: 'bundle',
        wine: null,
        price: 3000,
        bundleItems: [bundleItem('child1', 3, { kind: 'physical', weight: 750, wine: null, price: 1000 })],
      })],
      taxRules,
      'de',
    )
    expect(result.items[0].bundleItems).toEqual([{
      key: 'k-child1', variantId: 'child1', productId: 'p-child1', title: 'Item child1', subtitle: null,
      sku: 'SKU-child1', quantity: 3, kind: 'physical', weight: 750, wine: null,
      price: 3000, vatRate: 20, vatAmount: 500,
    }])
    // 3 × 750 g = 2250 g
    expect(result.items[0].weight).toBe(2250)
  })

  it('aggregates bundle weight from mixed wine + physical children', () => {
    const result = validateCart(
      [{ variantId: 'v1', quantity: 1 }],
      [makeVariant({
        kind: 'bundle',
        wine: null,
        bundleItems: [
          bundleItem('wine1', 6, { weight: null }),
          bundleItem('phys1', 1, { kind: 'physical', weight: 400, wine: null }),
        ],
      })],
      taxRules,
      'de',
    )
    // 6 × estimateWineBottleWeight(750) + 1 × 400 = 6 × 1250 + 400 = 7900 g
    expect(result.items[0].weight).toBe(7900)
  })

  it('uses a wine item\'s explicit weight in the bundle weight', () => {
    const result = validateCart(
      [{ variantId: 'v1', quantity: 1 }],
      [makeVariant({ kind: 'bundle', wine: null, bundleItems: [bundleItem('wine1', 2, { weight: 1500 })] })],
      taxRules,
      'de',
    )
    expect(result.items[0].weight).toBe(3000)
  })

  describe('bundle availability', () => {
    const cases: [string, Partial<SanityVariantResult>][] = [
      ['no items', { bundleItems: [] }],
      ['null items', { bundleItems: null }],
      ['a dangling item', { bundleItems: [bundleItem('a', 1), { _key: 'x', quantity: 1, variant: null }] }],
      ['an inactive item', { bundleItems: [bundleItem('a', 1), bundleItem('b', 1, { status: 'soldOut' })] }],
      ['an item without any price', { bundleItems: [bundleItem('a', 1, { price: null, productPrice: null })] }],
    ]
    for (const [name, overrides] of cases) {
      it(`refuses a bundle with ${name}`, () => {
        const result = validateCart(
          [{ variantId: 'v1', quantity: 1 }],
          [makeVariant({ kind: 'bundle', wine: null, ...overrides })],
          taxRules,
          'de',
        )
        expect(result.items).toHaveLength(0)
        expect(result.unavailableItems).toEqual(['v1'])
      })
    }

    it('accepts an active bundle whose item has only a product price', () => {
      const result = validateCart(
        [{ variantId: 'v1', quantity: 1 }],
        [makeVariant({ kind: 'bundle', wine: null, bundleItems: [bundleItem('a', 1, { price: null, productPrice: 900 })] })],
        taxRules,
        'de',
      )
      expect(result.items).toHaveLength(1)
      expect(result.items[0].bundleItems![0].price).toBe(1500)
    })
  })

  describe('bundle VAT split', () => {
    // €30 box = 2 × €12 wine (13 %) + €6 juice (20 %)
    const rules: SanityTaxRuleResult[] = [
      { taxCategoryCode: 'andere', rate: 20 },
      { taxCategoryCode: 'alkohol', rate: 13 },
    ]
    const box = (items: SanityVariantResult['bundleItems'], price = 3000) => makeVariant({
      kind: 'bundle', wine: null, price, taxCategoryCode: 'andere', productTaxCategoryCode: 'andere',
      bundleItems: items,
    })
    const wine = bundleItem('wine', 2, { price: 1200, taxCategoryCode: null, productTaxCategoryCode: 'alkohol' })
    const juice = bundleItem('juice', 1, { kind: 'physical', wine: null, weight: 1000, price: 600, taxCategoryCode: 'andere' })

    it('splits a mixed bundle by the items\' single prices, each at its own rate', () => {
      const [item] = validateCart([{ variantId: 'v1', quantity: 2 }], [box([wine, juice])], rules, 'de').items
      expect(item.bundleItems!.map(bi => [bi.price, bi.vatRate, bi.vatAmount])).toEqual([
        [2400, 13, extractVat(4800, 13)],
        [600, 20, extractVat(1200, 20)],
      ])
      expect(item.vatAmount).toBe(extractVat(4800, 13) + extractVat(1200, 20))
      expect(item.vatRate).toBe(13) // rate of the largest part
      expect(item.taxCategoryCode).toBe('')
    })

    it('uses an item variant\'s own tax category over its product\'s', () => {
      const override = bundleItem('tatschler', 1, { price: 1200, taxCategoryCode: 'andere', productTaxCategoryCode: 'alkohol' })
      const [item] = validateCart([{ variantId: 'v1', quantity: 1 }], [box([override], 1000)], rules, 'de').items
      expect(item.bundleItems![0].vatRate).toBe(20)
    })

    it('splits a cheaper bundle in ratio, last item takes the remainder', () => {
      // 3 items à €10, bundle €20 → 666 / 666 / 668
      const items = ['a', 'b', 'c'].map(id => bundleItem(id, 1, { price: 1000 }))
      const [item] = validateCart([{ variantId: 'v1', quantity: 1 }], [box(items, 2000)], rules, 'de').items
      expect(item.bundleItems!.map(bi => bi.price)).toEqual([666, 666, 668])
    })

    it('one-rate bundle: one part per item, all at that rate', () => {
      const items = [bundleItem('a', 1, { price: 1000 }), bundleItem('b', 2, { price: 500 })]
      const [item] = validateCart([{ variantId: 'v1', quantity: 1 }], [box(items, 1800)], taxRules, 'de').items
      expect(item.bundleItems!.map(bi => [bi.price, bi.vatRate])).toEqual([[900, 20], [900, 20]])
    })
  })

  describe('bundle subtitle', () => {
    it('ignores the client subtitle and composes it from the current items', () => {
      const [item] = validateCart(
        [{ variantId: 'v1', quantity: 1, subtitle: '3× Old wine' }],
        [makeVariant({ kind: 'bundle', wine: null, bundleItems: [bundleItem('a', 2), bundleItem('b', 1)] })],
        taxRules,
        'de',
      ).items
      expect(item.subtitle).toBe('2× Item a, 1× Item b')
      expect(item.bundleItems![0].subtitle).toBe('0,75l, 2023')
    })

    it('falls back to the product title of an item variant without its own title', () => {
      const [item] = validateCart(
        [{ variantId: 'v1', quantity: 1 }],
        [makeVariant({ kind: 'bundle', wine: null, bundleItems: [bundleItem('a', 1, { title: null })] })],
        taxRules,
        'de',
      ).items
      expect(item.subtitle).toBe('1× Product a')
    })

    it('bundle items use the shop\'s volume unit', () => {
      const [item] = validateCart(
        [{ variantId: 'v1', quantity: 1 }],
        [makeVariant({ kind: 'bundle', wine: null, bundleItems: [bundleItem('a', 1)] })],
        taxRules, 'de', 'de', true, null, 'ml',
      ).items
      expect(item.bundleItems![0].subtitle).toBe('750ml, 2023')
    })

    it('keeps the client subtitle for other kinds', () => {
      const [item] = validateCart(
        [{ variantId: 'v1', quantity: 1, subtitle: 'Client text' }],
        [makeVariant({ kind: 'physical', wine: null })],
        taxRules,
        'de',
      ).items
      expect(item.subtitle).toBe('Client text')
    })
  })

  it('resolves wine variant weight from explicit field first', () => {
    const result = validateCart(
      [{ variantId: 'v1', quantity: 1 }],
      [makeVariant()], // default fixture has weight: 1200
      taxRules,
      'de',
    )
    expect(result.items[0].weight).toBe(1200)
  })

  it('estimates wine variant weight from bottle volume when no explicit weight', () => {
    const result = validateCart(
      [{ variantId: 'v1', quantity: 1 }],
      [makeVariant({ weight: null })],
      taxRules,
      'de',
    )
    expect(result.items[0].weight).toBe(1250)
  })

  it('resolves physical variant weight from explicit field', () => {
    const result = validateCart(
      [{ variantId: 'v1', quantity: 1 }],
      [makeVariant({ kind: 'physical', wine: null, weight: 850 })],
      taxRules,
      'de',
    )
    expect(result.items[0].weight).toBe(850)
  })
})
