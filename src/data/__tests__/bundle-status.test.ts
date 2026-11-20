import { describe, it, expect, vi } from 'vitest'
import { stegaEncodeSourceMap } from '@sanity/client/stega'
import { applyBuildShippingDiscounts, bundleItemsTotal, effectiveStatus, resolveVariants } from '../resolve/variants'
import { fetchBuildShippingDiscounts } from '../build-discounts'

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

  const bundleRule = { appliesTo: { include: { kinds: ['bundle'] } } }
  const derive = (v: Record<string, unknown>, discounts: { appliesTo: unknown }[], parents = new Map<string, string | null>()) => {
    const resolved = resolve(v)
    applyBuildShippingDiscounts([resolved], discounts as never, parents)
    return resolved.grantsFreeShipping
  }

  it('a stored flag no longer counts; resolveVariants leaves it false', () => {
    expect(resolve(variant('f', 'pf', { grantsFreeShipping: true })).grantsFreeShipping).toBe(false)
  })

  it('a kind-bundle rule sets it on bundles only', () => {
    expect(derive(variant('b', 'pb', { kind: 'bundle', wine: null, bundleItems: [] }), [bundleRule])).toBe(true)
    expect(derive(variant('w', 'pw'), [bundleRule])).toBe(false)
    expect(derive(variant('b', 'pb', { kind: 'bundle', wine: null, bundleItems: [] }), [])).toBe(false)
  })

  it('an empty appliesTo = every non-digital variant; digital never', () => {
    expect(derive(variant('w', 'pw'), [{ appliesTo: null }])).toBe(true)
    expect(derive(variant('d', 'pd', { kind: 'digital', wine: null }), [{ appliesTo: null }])).toBe(false)
  })

  it('a stega-encoded kind would never match (why the build fetch skips stega)', () => {
    const encoded = stegaEncodeSourceMap(
      { kind: 'bundle' },
      { documents: [{ _id: 'd', _type: 'discount' }], paths: ["$['kind']"], mappings: { "$['kind']": { type: 'value', source: { type: 'documentValue', document: 0, path: 0 } } } } as never,
      { enabled: true, studioUrl: 'https://studio.example', filter: () => true },
    ) as { kind: string }
    const v = variant('b', 'pb', { kind: 'bundle', wine: null, bundleItems: [] })
    expect(derive(v, [{ appliesTo: { include: { kinds: [encoded.kind] } } }])).toBe(false)
  })
})

describe('fetchBuildShippingDiscounts', () => {
  const on = { shop: { enabled: true, checkout: true } }
  const raw = (over: Record<string, unknown> = {}) => ({
    _id: 'd', title: null, trigger: 'automatic', enabled: true, target: 'shipping', valueType: 'free',
    appliesTo: { include: { kinds: ['bundle'] } }, ...over,
  })

  it('fetches without stega options and keeps only unconditional rules', async () => {
    const fetch = vi.fn().mockResolvedValue([
      raw(), raw({ _id: 'dated', validTo: '2026-12-31' }), raw({ _id: 'min', minSubtotal: 5000 }),
      raw({ _id: 'limited', maxRedemptions: 10 }), raw({ _id: 'qty', minQuantity: 2 }),
    ])
    const result = await fetchBuildShippingDiscounts({ fetch } as never, on)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0]).toHaveLength(1)
    expect(fetch.mock.calls[0][0]).toContain('_type == "discount" && trigger == "automatic" && target == "shipping" && enabled == true')
    expect(result.map(d => d._id)).toEqual(['d'])
  })

  it('without checkout: no fetch, no rules', async () => {
    const fetch = vi.fn()
    expect(await fetchBuildShippingDiscounts({ fetch } as never, { shop: { enabled: true, checkout: false } })).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('bundleItemsTotal', () => {
  // items: a = €15 (own price), b = €9 (product price); bundle = 2 × a + 1 × b = €39
  it('sums the items at their single prices × quantity when more than the bundle price', () => {
    expect(bundleItemsTotal(bundle(), 3000, rawMap, products)).toBe(3900)
  })
  it('null when not more than the bundle price', () => {
    expect(bundleItemsTotal(bundle(), 3900, rawMap, products)).toBeNull()
    expect(bundleItemsTotal(bundle(), 4500, rawMap, products)).toBeNull()
  })
  it('null for a missing or unpriced item, no items, or another kind', () => {
    expect(bundleItemsTotal(bundle({ bundleItems: [{ quantity: 1, variantId: 'gone' }] }), 100, rawMap, products)).toBeNull()
    const unpriced = new Map([...rawMap, ['c', variant('c', 'pa', { price: null })]])
    expect(bundleItemsTotal(bundle({ bundleItems: [{ quantity: 1, variantId: 'c' }] }), 100, unpriced, products)).toBeNull()
    expect(bundleItemsTotal(bundle({ bundleItems: [] }), 100, rawMap, products)).toBeNull()
    expect(bundleItemsTotal(items[0], 100, rawMap, products)).toBeNull()
  })
})
