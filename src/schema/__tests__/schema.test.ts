import { describe, it, expect } from 'vitest'
import { buildPageDocSchema, buildWebSiteSchema, type SchemaShopData } from '../index'
import { parseDeliveryDays, offerAvailability, variantToCartItem } from '../shipping'
import type { ResolvedVariant, ResolvedCategory, ResolvedSettings, ResolvedShippingMethod, ResolvedShopSettings } from '../../types/data'
import type { CoreConfig } from '../../types'

const BASE = 'https://shop.example'

function config(shop: { checkout?: boolean; stock?: boolean } = {}): CoreConfig {
  return {
    baseUrl: BASE,
    features: { shop: { checkout: shop.checkout ?? true, stock: shop.stock ?? false } },
  } as unknown as CoreConfig
}

function settings(overrides: Partial<ResolvedSettings> = {}): ResolvedSettings {
  return {
    siteTitle: 'Weingut Test',
    company: { name: 'Test GmbH', address: { line1: 'Weg 1', zip: '7000', city: 'Ort', country: 'AT' } },
    ...overrides,
  } as unknown as ResolvedSettings
}

function variant(overrides: Partial<ResolvedVariant> = {}): ResolvedVariant {
  return {
    _id: 'v1',
    _type: 'productVariant',
    url: '/de/produkt/wein-2022/',
    status: 'active',
    title: 'Wein 2022',
    sku: 'W22',
    kind: 'wine',
    price: 1500,
    image: null,
    seo: {},
    categories: [],
    manufacturers: [],
    stock: null,
    weight: null,
    wine: { volume: 750, vintage: '2022' },
    bundleItems: [],
    product: { _id: 'p1', title: 'Wein', description: null },
    siblings: [],
    ...overrides,
  } as unknown as ResolvedVariant
}

const groups = [{
  bottles: [{ volume: 750, perPlace: 1 }, { volume: 375, perPlace: 2 }],
  packages: [{ places: 1, price: 600 }, { places: 6, price: 1200 }],
}]

function method(overrides: Partial<ResolvedShippingMethod> = {}): ResolvedShippingMethod {
  return {
    _id: 'dpd-at',
    title: 'DPD',
    deliveryTime: '2 – 5 Werktage',
    methodType: 'delivery',
    pickupFee: null,
    freeShippingThreshold: null,
    countries: ['AT'],
    rates: [{ maxWeight: 5, price: 500 }, { maxWeight: 30, price: 900 }],
    packagingGroups: groups,
    ...overrides,
  }
}

function shop(overrides: Partial<SchemaShopData> = {}, shopSettings: Partial<ResolvedShopSettings> = {}): SchemaShopData {
  return {
    shopSettings: {
      freeShippingCalculation: 'afterDiscount',
      returnShippingBorneBy: 'customer',
      returnAddress: null,
      ...shopSettings,
    } as ResolvedShopSettings,
    shippingMethods: [method(), method({ _id: 'dpd-de', countries: ['DE', 'LU'], packagingGroups: [{ ...groups[0], packages: [{ places: 1, price: 900 }] }] })],
    withdrawalPolicyUrl: '/de/widerruf/',
    ...overrides,
  }
}

const imageUrl = () => 'https://img.example/x.jpg'

/** All JSON-LD objects in the output. */
function ld(html: string): any[] {
  return [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(m => JSON.parse(m[1]))
}

function productPage(v: ResolvedVariant, opts: { products?: ResolvedVariant[]; shopData?: SchemaShopData | null; cfg?: CoreConfig; s?: ResolvedSettings } = {}): any[] {
  const shopData = opts.shopData === null ? undefined : (opts.shopData ?? shop())
  return ld(buildPageDocSchema(v, 'de', opts.s ?? settings(), opts.cfg ?? config(), imageUrl, opts.products ?? [v], shopData))
}

function main(objs: any[]): any {
  return objs.find(o => o['@type'] === 'Product' || o['@type'] === 'ProductGroup')
}

describe('brand', () => {
  it('uses the first manufacturer', () => {
    const p = main(productPage(variant({ manufacturers: [{ _id: 'm', name: 'Hersteller' }] as any })))
    expect(p.brand).toEqual({ '@type': 'Brand', name: 'Hersteller' })
  })
  it('falls back to siteTitle, then company.name', () => {
    expect(main(productPage(variant())).brand.name).toBe('Weingut Test')
    expect(main(productPage(variant(), { s: settings({ siteTitle: '' }) })).brand.name).toBe('Test GmbH')
  })
})

describe('offer', () => {
  it('has no priceValidUntil', () => {
    const p = main(productPage(variant()))
    expect(p.offers.price).toBe('15.00')
    expect(p.offers).not.toHaveProperty('priceValidUntil')
  })

  it('price 0 → no Product at all, breadcrumb only', () => {
    const objs = productPage(variant({ price: 0 }))
    expect(objs.map(o => o['@type'])).toEqual(['BreadcrumbList'])
  })

  it('never outputs a Product without offers', () => {
    const sib = variant({ _id: 'v2', url: '/de/produkt/wein-2021/', price: 0 })
    const v = variant({ siblings: [{ _id: 'v2' }] as any })
    const g = main(productPage(v, { products: [v, sib] }))
    const full = g.hasVariant.filter((p: any) => Object.keys(p).length > 2)
    expect(full).toHaveLength(1)
    expect(full[0].offers).toBeDefined()
    // the price-0 sibling stays a URL-only stub
    expect(g.hasVariant[1]).toEqual({ '@type': 'Product', url: BASE + sib.url })
  })

  it('sku falls back to _id', () => {
    expect(main(productPage(variant({ sku: '' }))).sku).toBe('v1')
  })
})

describe('availability', () => {
  it('non-active status → OutOfStock', () => {
    for (const status of ['soldOut', 'comingSoon', 'archived'] as const) {
      expect(offerAvailability(variant({ status }), false)).toBe('OutOfStock')
    }
  })
  it('stock counts only with the stock feature', () => {
    expect(offerAvailability(variant({ stock: 0 }), true)).toBe('OutOfStock')
    expect(offerAvailability(variant({ stock: 0 }), false)).toBe('InStock')
    expect(offerAvailability(variant({ stock: 3 }), true)).toBe('InStock')
    expect(offerAvailability(variant({ stock: null }), true)).toBe('InStock')
  })
  it('out-of-stock offers get no shipping', () => {
    const p = main(productPage(variant({ status: 'soldOut' })))
    expect(p.offers.availability).toBe('https://schema.org/OutOfStock')
    expect(p.offers).not.toHaveProperty('shippingDetails')
  })
})

describe('ProductGroup', () => {
  const v22 = variant({ siblings: [{ _id: 'v21' }, { _id: 'v-gone' }] as any })
  const v21 = variant({ _id: 'v21', url: '/de/produkt/wein-2021/', title: 'Wein 2021', wine: { volume: 750, vintage: '2021' } as any })

  it('plain Product without siblings', () => {
    expect(main(productPage(variant()))['@type']).toBe('Product')
  })

  it('group with own variant in full and siblings as URL stubs', () => {
    const g = main(productPage(v22, { products: [v22, v21] }))
    expect(g['@type']).toBe('ProductGroup')
    expect(g.productGroupID).toBe('p1')
    expect(g).not.toHaveProperty('url')
    expect(g).not.toHaveProperty('variesBy')
    expect(g.hasVariant).toHaveLength(2) // v-gone has no page
    expect(g.hasVariant[0]).toMatchObject({ url: BASE + v22.url, inProductGroupWithID: 'p1', sku: 'W22' })
    expect(g.hasVariant[0].name).toBe('Wein 2022') // no label → title only
    expect(g.hasVariant[0].offers['@type']).toBe('Offer')
    expect(g.hasVariant[1]).toEqual({ '@type': 'Product', url: BASE + v21.url })
  })

  it('variesBy size only when volumes differ', () => {
    const magnum = variant({ _id: 'v21', url: '/de/produkt/wein-15/', wine: { volume: 1500, vintage: '2022' } as any })
    const g = main(productPage(v22, { products: [v22, magnum] }))
    expect(g.variesBy).toBe('https://schema.org/size')
    expect(g.hasVariant[0].size).toBe('0.75 l')
    const labelled = variant({ ...v22, title: 'Wein', label: '0,75 l · 2022' } as any)
    expect(main(productPage(labelled, { products: [labelled, magnum] })).hasVariant[0].name).toBe('Wein 0,75 l · 2022')
  })

  it('description from the product first', () => {
    const v = variant({ ...v22, product: { _id: 'p1', title: 'Wein', description: 'Der Wein.\n\nSeit 1900.' } } as any)
    const g = main(productPage(v, { products: [v, v21] }))
    expect(g.description).toBe('Der Wein. Seit 1900.')
  })
})

describe('shipping details', () => {
  it('one entry per delivery method with all its countries (wine → packaging groups)', () => {
    const { shippingDetails } = main(productPage(variant())).offers
    expect(shippingDetails).toHaveLength(2)
    expect(shippingDetails[0]).toEqual({
      '@type': 'OfferShippingDetails',
      shippingRate: { '@type': 'MonetaryAmount', value: 6, currency: 'EUR' },
      shippingDestination: [{ '@type': 'DefinedRegion', addressCountry: 'AT' }],
      deliveryTime: {
        '@type': 'ShippingDeliveryTime',
        transitTime: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 5, unitCode: 'DAY' },
      },
    })
    expect(shippingDetails[1].shippingDestination.map((d: any) => d.addressCountry)).toEqual(['DE', 'LU'])
    expect(shippingDetails[1].shippingRate.value).toBe(9)
  })

  it('physical item → weight rate; rate without maxWeight is dropped', () => {
    const v = variant({ kind: 'physical', wine: null, weight: 8000 })
    const shopData = shop({ shippingMethods: [method({ packagingGroups: [], rates: [{ maxWeight: 5, price: 500 }, { maxWeight: null, price: 100 }, { maxWeight: 30, price: 900 }] })] })
    const { shippingDetails } = main(productPage(v, { shopData })).offers
    expect(shippingDetails.map((d: any) => d.shippingRate.value)).toEqual([9])
  })

  it('physical item without a matching rate → no entry', () => {
    const v = variant({ kind: 'physical', wine: null, weight: 50000 })
    const shopData = shop({ shippingMethods: [method({ packagingGroups: [] })] })
    expect(main(productPage(v, { shopData })).offers).not.toHaveProperty('shippingDetails')
  })

  it('bundle with a physical child: boxes for the wine + weight rate for the rest', () => {
    const v = variant({
      kind: 'bundle',
      wine: null,
      bundleItems: [
        { quantity: 2, variant: { _id: 'w', kind: 'wine', volume: 750, weight: null } },
        { quantity: 1, variant: { _id: 'g', kind: 'physical', volume: null, weight: 400 } },
      ] as any,
    })
    const item = variantToCartItem(v)
    expect(item.weight).toBe(2 * 1250 + 400)
    expect(item.bundleItems?.map(b => b.weight)).toEqual([1250, 400])
    const { shippingDetails } = main(productPage(v)).offers
    // AT: 2 places → 2 × 1-box (12.00) + 0.4 kg rate (5.00)
    expect(shippingDetails[0].shippingRate.value).toBe(17)
  })

  it('free-shipping threshold → rate 0', () => {
    const shopData = shop({ shippingMethods: [method({ freeShippingThreshold: 1000 })] })
    expect(main(productPage(variant(), { shopData })).offers.shippingDetails[0].shippingRate.value).toBe(0)
  })

  it('unparseable delivery time → entry without deliveryTime', () => {
    const shopData = shop({ shippingMethods: [method({ deliveryTime: 'bald' })] })
    const [d] = main(productPage(variant(), { shopData })).offers.shippingDetails
    expect(d).not.toHaveProperty('deliveryTime')
    expect(d.shippingRate).toBeDefined()
  })

  it('skips digital variants, pickup methods and methods without countries', () => {
    expect(main(productPage(variant({ kind: 'digital', wine: null }))).offers).not.toHaveProperty('shippingDetails')
    const shopData = shop({ shippingMethods: [method({ methodType: 'pickup', pickupFee: 0 }), method({ _id: 'x', countries: [] })] })
    expect(main(productPage(variant(), { shopData })).offers).not.toHaveProperty('shippingDetails')
  })

  it('only with the checkout feature', () => {
    expect(main(productPage(variant(), { cfg: config({ checkout: false }) })).offers).not.toHaveProperty('shippingDetails')
  })
})

describe('parseDeliveryDays', () => {
  it('parses a range, a single number, and gives up otherwise', () => {
    expect(parseDeliveryDays('2 – 5 Werktage')).toEqual({ min: 2, max: 5 })
    expect(parseDeliveryDays('3 Tage')).toEqual({ min: 3, max: 3 })
    expect(parseDeliveryDays('bald')).toBeNull()
    expect(parseDeliveryDays(null)).toBeNull()
    expect(parseDeliveryDays('5-2')).toBeNull()
  })
})

describe('category ItemList', () => {
  it('lists plain ListItems, no Product', () => {
    const cat = { _id: 'c1', _type: 'category', url: '/de/weiss/', title: 'Weiß', seo: {} } as unknown as ResolvedCategory
    const v = variant({ categories: [cat] })
    const labelled = variant({ _id: 'v2', url: '/de/produkt/wein-2021/', title: 'Wein', label: '0,75 l · 2021', categories: [cat] } as any)
    const [list] = ld(buildPageDocSchema(cat, 'de', settings(), config(), imageUrl, [v, labelled], shop()))
    expect(list.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, url: BASE + v.url, name: 'Wein 2022' },
      { '@type': 'ListItem', position: 2, url: BASE + labelled.url, name: 'Wein 0,75 l · 2021' },
    ])
  })
})

describe('return policy', () => {
  function org(s = settings(), shopData: SchemaShopData = shop(), cfg = config()): any {
    return ld(buildWebSiteSchema(s, cfg, 'de', shopData)).find(o => o['@type'] === 'Organization')
  }

  it('customer pays returns', () => {
    expect(org().hasMerchantReturnPolicy).toEqual({
      '@type': 'MerchantReturnPolicy',
      applicableCountry: ['AT', 'DE', 'LU'],
      returnPolicyCountry: 'AT',
      returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
      merchantReturnDays: 14,
      returnMethod: 'https://schema.org/ReturnByMail',
      returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
      merchantReturnLink: BASE + '/de/widerruf/',
    })
  })

  it('merchant pays returns → FreeReturn', () => {
    expect(org(settings(), shop({}, { returnShippingBorneBy: 'merchant' })).hasMerchantReturnPolicy.returnFees)
      .toBe('https://schema.org/FreeReturn')
  })

  it('returnPolicyCountry: return address → company address → omitted', () => {
    const withReturn = shop({}, { returnAddress: { country: 'DE' } as any })
    expect(org(settings(), withReturn).hasMerchantReturnPolicy.returnPolicyCountry).toBe('DE')
    const noAddr = settings({ company: { name: 'Test GmbH' } } as any)
    expect(org(noAddr).hasMerchantReturnPolicy).not.toHaveProperty('returnPolicyCountry')
  })

  it('no link when the withdrawal page is unset', () => {
    expect(org(settings(), shop({ withdrawalPolicyUrl: '#' })).hasMerchantReturnPolicy).not.toHaveProperty('merchantReturnLink')
  })

  it('none without company.name or checkout', () => {
    expect(org(settings({ company: null } as any))).toBeUndefined()
    expect(org(settings(), shop(), config({ checkout: false }))).not.toHaveProperty('hasMerchantReturnPolicy')
  })
})
