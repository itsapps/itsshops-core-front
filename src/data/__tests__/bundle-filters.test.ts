import { describe, it, expect } from 'vitest'
import { mergeBundleFilterAttributes, type FilterAccumulator } from '../resolve/filters'
import { resolveVariants } from '../resolve/variants'

const v = (_id: string, kind: string, filterAttributes: Record<string, string[]>, items: string[] = []) => ({
  _id, kind, filterAttributes, bundleItems: items.map(id => ({ variant: { _id: id } })),
})

describe('mergeBundleFilterAttributes', () => {
  it('a bundle takes the union of its items\' attributes, categories included', () => {
    const variants = [
      v('red', 'wine', { color: ['rot'], vintage: ['2022'], volume: ['750'], category: ['rotwein'] }),
      v('white', 'wine', { color: ['weiss'], vintage: ['2022'], volume: ['750'], category: ['weisswein'] }),
      v('box', 'bundle', { category: ['pakete'] }, ['red', 'white']),
    ]
    mergeBundleFilterAttributes(variants)
    expect(variants[2].filterAttributes).toEqual({
      category: ['pakete', 'rotwein', 'weisswein'], color: ['rot', 'weiss'], vintage: ['2022'], volume: ['750'],
    })
  })

  it('takes physical items\' option groups; skips missing items and leaves other kinds alone', () => {
    const variants = [
      v('shirt', 'physical', { groesse: ['l'] }),
      v('box', 'bundle', {}, ['shirt', 'gone']),
    ]
    mergeBundleFilterAttributes(variants)
    expect(variants[1].filterAttributes).toEqual({ groesse: ['l'] })
    expect(variants[0].filterAttributes).toEqual({ groesse: ['l'] })
  })

  it('counts each value a bundle gains once', () => {
    const acc: FilterAccumulator = new Map([
      ['color', { label: 'Farbe', values: new Map([['rot', { label: 'Rot', count: 2 }]]) }],
    ])
    mergeBundleFilterAttributes([
      v('r1', 'wine', { color: ['rot'] }),
      v('r2', 'wine', { color: ['rot'] }),
      v('box', 'bundle', {}, ['r1', 'r2']),
    ], acc)
    expect(acc.get('color')!.values.get('rot')!.count).toBe(3)
  })
})

describe('resolveVariants — bundle filter attributes', () => {
  it('a wine bundle matches its wines\' vintage and volume', () => {
    const raw = [
      { _id: 'w', productId: 'pw', status: 'active', kind: 'wine', price: 1500, wine: { vintage: 2022, volume: 750 } },
      { _id: 'box', productId: 'pbox', status: 'active', kind: 'bundle', price: 3000, bundleItems: [{ quantity: 2, variantId: 'w' }] },
    ]
    const products = new Map<string, any>([['pw', { _id: 'pw', kind: 'wine' }], ['pbox', { _id: 'pbox', kind: 'bundle' }]])
    const ctx = {
      locale: 'de', defaultLocale: 'de', units: { volume: 'ml' },
      resolveString: (x: unknown) => (typeof x === 'string' ? x : ''),
      resolveLocaleAltImage: () => null, resolveSeo: () => ({}), translate: (k: string) => k,
    }
    const acc: FilterAccumulator = new Map()
    const resolved = resolveVariants(raw, products, ctx as never, { de: { product: 'produkt' } } as never,
      new Map(), new Map([['pw', [raw[0]]], ['pbox', [raw[1]]]]), new Map(), undefined, acc)
    expect(resolved.find(r => r._id === 'box')!.filterAttributes).toEqual({ vintage: ['2022'], volume: ['750'] })
    expect(acc.get('vintage')!.values.get('2022')!.count).toBe(2)
  })
})
