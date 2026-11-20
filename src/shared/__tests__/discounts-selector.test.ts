import { describe, it, expect } from 'vitest'
import { matchesSelector, isExcluded, withAncestors, hasCriteria } from '../discounts/selector'
import { sel } from './discounts-fixtures'

describe('matchesSelector', () => {
  it('an empty or missing selector matches every line', () => {
    expect(matchesSelector(sel(), null)).toBe(true)
    expect(matchesSelector(sel(), {})).toBe(true)
    expect(matchesSelector(sel(), { include: { kinds: [], categoryIds: null } })).toBe(true)
  })

  it('matches by kind', () => {
    const s = { include: { kinds: ['bundle'] } }
    expect(matchesSelector(sel({ kind: 'bundle' }), s)).toBe(true)
    expect(matchesSelector(sel({ kind: 'wine' }), s)).toBe(false)
  })

  it('matches by category (any of the line’s effective categories + ancestors)', () => {
    const s = { include: { categoryIds: ['red'] } }
    expect(matchesSelector(sel({ categoryIds: ['white', 'red'] }), s)).toBe(true)
    expect(matchesSelector(sel({ categoryIds: ['white'] }), s)).toBe(false)
  })

  it('matches by manufacturer, product and variant', () => {
    expect(matchesSelector(sel({ manufacturerIds: ['m1'] }), { include: { manufacturerIds: ['m1'] } })).toBe(true)
    expect(matchesSelector(sel({ manufacturerIds: ['m2'] }), { include: { manufacturerIds: ['m1'] } })).toBe(false)
    expect(matchesSelector(sel({ productId: 'p9' }), { include: { productIds: ['p9'] } })).toBe(true)
    expect(matchesSelector(sel({ productId: 'p1' }), { include: { productIds: ['p9'] } })).toBe(false)
    expect(matchesSelector(sel({ variantId: 'v9' }), { include: { variantIds: ['v9'] } })).toBe(true)
    expect(matchesSelector(sel({ variantId: 'v1' }), { include: { variantIds: ['v9'] } })).toBe(false)
  })

  it('matches by compare-at price only when the criterion is true', () => {
    expect(matchesSelector(sel({ hasCompareAtPrice: true }), { include: { hasCompareAtPrice: true } })).toBe(true)
    expect(matchesSelector(sel({ hasCompareAtPrice: false }), { include: { hasCompareAtPrice: true } })).toBe(false)
    // false is "no criterion" → empty include → everything
    expect(matchesSelector(sel({ hasCompareAtPrice: false }), { include: { hasCompareAtPrice: false } })).toBe(true)
  })

  it('include criteria are OR-ed', () => {
    const s = { include: { kinds: ['bundle'], productIds: ['p9'] } }
    expect(matchesSelector(sel({ kind: 'wine', productId: 'p9' }), s)).toBe(true)
    expect(matchesSelector(sel({ kind: 'bundle', productId: 'p1' }), s)).toBe(true)
    expect(matchesSelector(sel({ kind: 'wine', productId: 'p1' }), s)).toBe(false)
  })

  it('exclude wins over include; exclude alone means "all but"', () => {
    const s = { include: { kinds: ['wine'] }, exclude: { categoryIds: ['rare'] } }
    expect(matchesSelector(sel({ kind: 'wine', categoryIds: ['red'] }), s)).toBe(true)
    expect(matchesSelector(sel({ kind: 'wine', categoryIds: ['rare'] }), s)).toBe(false)
    expect(matchesSelector(sel({ kind: 'bundle' }), { exclude: { kinds: ['bundle'] } })).toBe(false)
    expect(matchesSelector(sel({ kind: 'wine' }), { exclude: { kinds: ['bundle'] } })).toBe(true)
  })

  it('a bundle matches by its own categories only (the adapter passes no item categories)', () => {
    // The bundle's own categories are "Weinpakete"; a red wine inside doesn't make it "red".
    const bundle = sel({ kind: 'bundle', categoryIds: ['packs'] })
    expect(matchesSelector(bundle, { include: { categoryIds: ['red'] } })).toBe(false)
    expect(matchesSelector(bundle, { include: { categoryIds: ['packs'] } })).toBe(true)
  })

  it('a parent category matches its subcategories via withAncestors', () => {
    const parents = { 'red-reserve': 'red', red: 'wine', wine: null }
    const line = sel({ categoryIds: withAncestors(['red-reserve'], parents) })
    expect(matchesSelector(line, { include: { categoryIds: ['wine'] } })).toBe(true)
    expect(matchesSelector(line, { include: { categoryIds: ['white'] } })).toBe(false)
  })
})

describe('isExcluded', () => {
  it('an empty exclusion list excludes nothing', () => {
    expect(isExcluded(sel(), null)).toBe(false)
    expect(isExcluded(sel(), {})).toBe(false)
    expect(isExcluded(sel(), { include: { kinds: [] } })).toBe(false)
  })

  it('excludes what the include list matches', () => {
    expect(isExcluded(sel({ kind: 'bundle' }), { include: { kinds: ['bundle'] } })).toBe(true)
    expect(isExcluded(sel({ kind: 'wine' }), { include: { kinds: ['bundle'] } })).toBe(false)
  })
})

describe('withAncestors', () => {
  it('adds every ancestor, any depth', () => {
    const parents = new Map([['c', 'b'], ['b', 'a'], ['a', null]])
    expect(withAncestors(['c'], parents).sort()).toEqual(['a', 'b', 'c'])
  })

  it('is a no-op without parents', () => {
    expect(withAncestors(['x', 'y'], {})).toEqual(['x', 'y'])
  })

  it('stops on a cycle', () => {
    expect(withAncestors(['a'], { a: 'b', b: 'a' }).sort()).toEqual(['a', 'b'])
  })

  it('dedupes shared ancestors', () => {
    expect(withAncestors(['x', 'y'], { x: 'root', y: 'root' }).sort()).toEqual(['root', 'x', 'y'])
  })
})

describe('hasCriteria', () => {
  it('is false for empty sides', () => {
    expect(hasCriteria(null)).toBe(false)
    expect(hasCriteria({ kinds: [], hasCompareAtPrice: false })).toBe(false)
    expect(hasCriteria({ variantIds: ['v'] })).toBe(true)
  })
})
