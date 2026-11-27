import { describe, it, expect } from 'vitest'
import { resolveVariants } from '../resolve/variants'
import { makeCtx } from '../resolve/context'

const de = (value: string) => ({ language: 'de', value })
const en = (value: string) => ({ language: 'en', value })
const img = (ref: string) => ({ asset: { _ref: ref } })
const permalinks = { de: { product: 'produkt' }, en: { product: 'product' } } as never

const baseProduct = {
  _id: 'p',
  kind: 'physical',
  title: [de('Produkt'), en('Product')],
  description: [de('Produkt-Text'), en('Product text')],
  specifications: [{ label: [de('Material')], value: [de('Holz')] }],
  price: 1000,
  compareAtPrice: 1500,
  taxCategory: { _ref: 'tax-p' },
  categories: [{ _id: 'cat-p' }],
  manufacturers: [{ _id: 'm-p', name: [de('Hersteller P')] }],
  weight: 500,
  image: img('image-p'),
  seo: { metaTitle: [de('P meta')] },
}

function resolve(variant: Record<string, unknown>, product: Record<string, unknown> = {}, locale = 'de') {
  const p = { ...baseProduct, ...product }
  const v = { _id: 'v', productId: 'p', status: 'active', ...variant }
  const categoryMap = new Map<string, any>([
    ['cat-p', { _id: 'cat-p', title: 'P' }],
    ['cat-v', { _id: 'cat-v', title: 'V' }],
  ])
  return resolveVariants([v], new Map([['p', p]]), makeCtx(locale as never, 'de' as never, (k: string) => k),
    permalinks, categoryMap, new Map([['p', [v]]]), new Map())[0]
}

describe('resolveVariants — variant → product fallbacks', () => {
  it('an empty variant inherits every field', () => {
    const r = resolve({})
    expect(r.title).toBe('Produkt')
    expect(r.description).toBe('Produkt-Text')
    expect(r.specifications).toEqual([{ label: 'Material', value: 'Holz' }])
    expect(r.price).toBe(1000)
    expect(r.compareAtPrice).toBe(1500)
    expect(r.taxCategoryId).toBe('tax-p')
    expect(r.categories.map(c => c._id)).toEqual(['cat-p'])
    expect(r.manufacturers.map(m => m._id)).toEqual(['m-p'])
    expect(r.weight).toBe(500)
    expect(r.image?.asset._ref).toBe('image-p')
    expect(r.seo.metaTitle).toBe('P meta')
  })

  it("own values win; categories replace the product's", () => {
    const r = resolve({
      title: [de('Variante')],
      description: [de('Varianten-Text')],
      specifications: [{ label: [de('Farbe')], value: [de('Rot')] }],
      price: 1200,
      compareAtPrice: 1400,
      taxCategory: { _ref: 'tax-v' },
      categories: [{ _id: 'cat-v' }],
      manufacturers: [{ _id: 'm-v', name: [de('Hersteller V')] }],
      weight: 300,
      image: img('image-v'),
      seo: { metaTitle: [de('V meta')] },
    })
    expect(r.title).toBe('Variante')
    expect(r.description).toBe('Varianten-Text')
    expect(r.specifications).toEqual([{ label: 'Farbe', value: 'Rot' }])
    expect(r.price).toBe(1200)
    expect(r.compareAtPrice).toBe(1400)
    expect(r.taxCategoryId).toBe('tax-v')
    expect(r.categories.map(c => c._id)).toEqual(['cat-v'])
    expect(r.manufacturers.map(m => m._id)).toEqual(['m-v'])
    expect(r.weight).toBe(300)
    expect(r.image?.asset._ref).toBe('image-v')
    expect(r.seo.metaTitle).toBe('V meta')
  })

  it("empty lists fall back to the product's", () => {
    const r = resolve({ categories: [], manufacturers: [], specifications: [] })
    expect(r.categories.map(c => c._id)).toEqual(['cat-p'])
    expect(r.manufacturers.map(m => m._id)).toEqual(['m-p'])
    expect(r.specifications).toHaveLength(1)
  })

  it("own price → the product's compare-at price doesn't apply", () => {
    expect(resolve({ price: 1200 }).compareAtPrice).toBeNull()
  })

  it('a compare-at price not above the price is dropped', () => {
    expect(resolve({}, { compareAtPrice: 900 }).compareAtPrice).toBeNull()
  })

  it("English page: the product's English description beats the variant's German one", () => {
    const r = resolve({ description: [de('Varianten-Text')] }, {}, 'en')
    expect(r.description).toBe('Product text')
    expect(r.seo.metaDescription).toBe('Product text')
  })

  it('English page: a German-only variant title stays the title and the slug', () => {
    const r = resolve({ title: [de('Reserve')] }, {}, 'en')
    expect(r.title).toBe('Reserve')
    expect(r.slug).toBe('reserve')
  })
})
