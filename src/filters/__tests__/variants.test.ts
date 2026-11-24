import { describe, it, expect } from 'vitest'
import { sortByVintage, representativeVariant } from '../index'

const v = (id: string, productId: string, vintage?: string, volume?: number) => ({
  _id: id,
  product: { _id: productId },
  wine: vintage || volume ? { vintage, volume } : undefined,
})

describe('sortByVintage', () => {
  it('sorts newest vintage first, 0.75 l first within a vintage, no vintage last', () => {
    const list = [
      v('a', 'p', '2007', 750),
      v('b', 'p', undefined, 500),
      v('c', 'p', '2022', 1500),
      v('d', 'p', '2022', 750),
      v('e', 'p', '2012', 750),
    ]
    expect(sortByVintage(list).map(x => x._id)).toEqual(['d', 'c', 'e', 'a', 'b'])
  })

  it('keeps the order of variants without wine data and does not mutate', () => {
    const list = [v('a', 'p'), v('b', 'q'), v('c', 'r')]
    expect(sortByVintage(list).map(x => x._id)).toEqual(['a', 'b', 'c'])
    expect(list.map(x => x._id)).toEqual(['a', 'b', 'c'])
  })

  it('passes non-arrays through', () => {
    expect(sortByVintage(undefined as any)).toBeUndefined()
  })
})

describe('representativeVariant', () => {
  const all = [
    v('old', 'p', '2007', 750),
    v('other', 'q', '2024', 750),
    v('magnum', 'p', '2022', 1500),
    v('new', 'p', '2022', 750),
  ]

  it("returns the product's newest 0.75 l vintage regardless of list order", () => {
    expect(representativeVariant(all, 'p')?._id).toBe('new')
  })

  it("only considers the product's own variants", () => {
    expect(representativeVariant(all, 'q')?._id).toBe('other')
  })

  it('returns null for an unknown product or a missing list', () => {
    expect(representativeVariant(all, 'x')).toBeNull()
    expect(representativeVariant(undefined as any, 'p')).toBeNull()
  })
})
