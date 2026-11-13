import { describe, it, expect } from 'vitest'
import { stegaEncodeSourceMap } from '@sanity/client/stega'
import { effectiveStatus, resolveVariants } from '../resolve/variants'

const product = (id: string, over: Record<string, unknown> = {}) => ({ _id: id, kind: 'wine', title: null, price: null, ...over })
const variant = (id: string, productId: string, over: Record<string, unknown> = {}) => ({
  _id: id, productId, status: 'active', kind: 'wine', price: 1500, wine: { vintage: 2022, volume: 750 }, ...over,
})

const items = [variant('a', 'pa'), variant('b', 'pb', { price: null })]
const products = new Map([['pa', product('pa')], ['pb', product('pb', { price: 900 })], ['pbox', product('pbox', { kind: 'bundle' })]])
const rawMap = new Map(items.map(v => [v._id, v]))
const bundle = (over: Record<string, unknown> = {}) => variant('box', 'pbox', {
  kind: 'bundle', price: 3000, wine: null,
  bundleItems: [{ quantity: 2, variantId: 'a' }, { quantity: 1, variantId: 'b' }],
  ...over,
})

describe('effectiveStatus', () => {
  it('keeps an active bundle whose items are active and priced (own or product price)', () => {
    expect(effectiveStatus(bundle(), rawMap, products)).toBe('active')
  })

  it('bundle without items, with an archived/dangling item or an inactive item → soldOut', () => {
    expect(effectiveStatus(bundle({ bundleItems: [] }), rawMap, products)).toBe('soldOut')
    expect(effectiveStatus(bundle({ bundleItems: null }), rawMap, products)).toBe('soldOut')
    expect(effectiveStatus(bundle({ bundleItems: [{ quantity: 1, variantId: 'gone' }] }), rawMap, products)).toBe('soldOut')
    const inactive = new Map(rawMap).set('a', { ...items[0], status: 'comingSoon' })
    expect(effectiveStatus(bundle(), inactive, products)).toBe('soldOut')
  })

  it('reads a stega-encoded item status', () => {
    const encoded = stegaEncodeSourceMap(
      { status: 'soldOut' },
      { documents: [{ _id: 'a', _type: 'productVariant' }], paths: ["$['status']"], mappings: { "$['status']": { type: 'value', source: { type: 'documentValue', document: 0, path: 0 } } } } as never,
      { enabled: true, studioUrl: 'https://studio.example', filter: () => true },
    ) as { status: string }
    expect(encoded.status).not.toBe('soldOut') // really encoded
    const stega = new Map(rawMap).set('a', { ...items[0], status: encoded.status })
    expect(effectiveStatus(bundle(), stega, products)).toBe('soldOut')
  })

  it('a bundle item without any price → unavailable', () => {
    const unpriced = new Map(rawMap).set('b', { ...items[1], productId: 'pa' })
    expect(effectiveStatus(bundle(), unpriced, products)).toBe('unavailable')
  })

  it('any kind without its own and its product price → unavailable; inherited price → unchanged', () => {
    expect(effectiveStatus(variant('x', 'pa', { price: null }), rawMap, products)).toBe('unavailable')
    expect(effectiveStatus(variant('x', 'pb', { price: null }), rawMap, products)).toBe('active')
    expect(effectiveStatus(variant('x', 'pa', { price: null, status: 'soldOut' }), rawMap, products)).toBe('soldOut')
  })
})

describe('resolveVariants follows the effective status', () => {
  it('the bundle, a sibling and a variant-axis option all show it', () => {
    // Two bundle variants of one product (vintages 2022/2023 for the axis); both lose item "a".
    const box22 = bundle({ _id: 'box22', wine: { vintage: 2022 } })
    const box23 = bundle({ _id: 'box23', wine: { vintage: 2023 } })
    const raw = [{ ...items[0], status: 'soldOut' }, items[1], box22, box23]
    const ctx = {
      locale: 'de', defaultLocale: 'de', units: { volume: 'ml' },
      resolveString: (v: unknown) => (typeof v === 'string' ? v : ''),
      resolveLocaleAltImage: () => null,
      resolveSeo: () => ({}),
      translate: (k: string) => k,
    }
    const permalinks = { de: { product: 'produkt' } }
    const siblings = new Map<string, any[]>([['pbox', [box22, box23]], ['pa', [raw[0]]], ['pb', [raw[1]]]])
    const resolved = resolveVariants(raw, products, ctx as never, permalinks as never, new Map(), siblings, new Map())
    const r22 = resolved.find(v => v._id === 'box22')!
    expect(r22.status).toBe('soldOut')
    expect(r22.siblings.map(s => s.status)).toEqual(['soldOut'])
    // box22 is kind "bundle", so its axes are option groups — none here; check via a wine product instead.
    const wines = [variant('w22', 'pw'), variant('w23', 'pw', { price: null, wine: { vintage: 2023, volume: 750 } })]
    const wineProducts = new Map([['pw', product('pw')]])
    const [w22] = resolveVariants(wines, wineProducts, ctx as never, permalinks as never, new Map(), new Map([['pw', wines]]), new Map())
    expect(w22.variantAxes[0].options.find(o => o.value === 2023)!.status).toBe('unavailable')
    expect(w22.siblings[0].status).toBe('unavailable')
  })
})

describe('resolveVariants — grantsFreeShipping', () => {
  const ctx = {
    locale: 'de', defaultLocale: 'de', units: { volume: 'ml' },
    resolveString: (v: unknown) => (typeof v === 'string' ? v : ''),
    resolveLocaleAltImage: () => null,
    resolveSeo: () => ({}),
    translate: (k: string) => k,
  }
  const permalinks = { de: { product: 'produkt' } }
  const resolve = (v: Record<string, unknown>) => {
    const raw = [v]
    const prods = new Map([[v.productId as string, product(v.productId as string, { kind: v.kind })]])
    return resolveVariants(raw, prods, ctx as never, permalinks as never, new Map(), new Map([[v.productId as string, raw]]), new Map())[0]
  }

  it('true only when set on a non-digital variant', () => {
    expect(resolve(variant('f', 'pf', { grantsFreeShipping: true })).grantsFreeShipping).toBe(true)
    expect(resolve(variant('m', 'pm')).grantsFreeShipping).toBe(false)
    expect(resolve(variant('n', 'pn', { grantsFreeShipping: null })).grantsFreeShipping).toBe(false)
    expect(resolve(variant('d', 'pd', { kind: 'digital', wine: null, grantsFreeShipping: true })).grantsFreeShipping).toBe(false)
  })
})
