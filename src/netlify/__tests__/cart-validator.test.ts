import { describe, it, expect } from 'vitest'
import { validateCart } from '../lib/cart-validator'
import type { SanityVariantResult, SanityTaxRuleResult } from '../types/checkout'

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
    expect(item.subtitle).toBe('2023 · 750 ml')
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

  it('resolves bundle items and aggregates child weights', () => {
    const result = validateCart(
      [{ variantId: 'v1', quantity: 1 }],
      [makeVariant({
        kind: 'bundle',
        wine: null,
        bundleItems: [
          {
            quantity: 3,
            variant: {
              _id: 'child1',
              kind: 'physical',
              title: null,
              weight: 750,
              productWeight: null,
              stock: 100,
              wine: null,
            },
          },
        ],
      })],
      taxRules,
      'de',
    )
    expect(result.items[0].bundleItems).toEqual([
      { variantId: 'child1', quantity: 3 },
    ])
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
          {
            quantity: 6,
            variant: {
              _id: 'wine1', kind: 'wine', title: null, weight: null, productWeight: null,
              stock: 100, wine: { vintage: '2022', volume: 750 },
            },
          },
          {
            quantity: 1,
            variant: {
              _id: 'phys1', kind: 'physical', title: null, weight: 400, productWeight: null,
              stock: 100, wine: null,
            },
          },
        ],
      })],
      taxRules,
      'de',
    )
    // 6 × estimateWineBottleWeight(750) + 1 × 400 = 6 × 1250 + 400 = 7900 g
    expect(result.items[0].weight).toBe(7900)
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
