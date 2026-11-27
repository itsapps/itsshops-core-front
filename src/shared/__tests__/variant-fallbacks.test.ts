import { describe, it, expect } from 'vitest'
import { effectiveCompareAtPrice } from '../variant-fallbacks'

describe('effectiveCompareAtPrice', () => {
  it("own price, no own compare-at → none (the product's doesn't apply)", () => {
    expect(effectiveCompareAtPrice({ price: 1200 }, { price: 1000, compareAtPrice: 1500 })).toBeNull()
  })

  it('own price and own compare-at → own', () => {
    expect(effectiveCompareAtPrice({ price: 1200, compareAtPrice: 1500 }, { compareAtPrice: 2000 })).toBe(1500)
  })

  it("no own price → variant's compare-at, else the product's", () => {
    expect(effectiveCompareAtPrice({}, { price: 1000, compareAtPrice: 1500 })).toBe(1500)
    expect(effectiveCompareAtPrice({ compareAtPrice: 1300 }, { price: 1000, compareAtPrice: 1500 })).toBe(1300)
    expect(effectiveCompareAtPrice({ price: null, compareAtPrice: null }, { price: 1000, compareAtPrice: 1500 })).toBe(1500)
  })

  it('compare-at not higher than the price → none', () => {
    expect(effectiveCompareAtPrice({ price: 1000, compareAtPrice: 1000 }, null)).toBeNull()
    expect(effectiveCompareAtPrice({ price: 1000, compareAtPrice: 900 }, null)).toBeNull()
    expect(effectiveCompareAtPrice({ compareAtPrice: 1000 }, { price: 1200 })).toBeNull()
  })

  it('no effective price → none', () => {
    expect(effectiveCompareAtPrice({ compareAtPrice: 1500 }, { compareAtPrice: 2000 })).toBeNull()
    expect(effectiveCompareAtPrice({}, null)).toBeNull()
  })

  it('a price of 0 is a price', () => {
    expect(effectiveCompareAtPrice({ price: 0, compareAtPrice: 500 }, { price: 1000, compareAtPrice: 2000 })).toBe(500)
  })
})
