import type { ResolvedVariant, ResolvedCategory, ResolvedPage, ResolvedPost, ResolvedSettings } from '../types/data'
import type { CoreConfig } from '../types'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PageDoc = ResolvedVariant | ResolvedCategory | ResolvedPage | ResolvedPost

type ImageUrlFn = (image: any, width?: number) => string

interface SchemaContext {
  locale: string
  settings: ResolvedSettings | null
  config: CoreConfig
  imageUrl: ImageUrlFn
  products: ResolvedVariant[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function schemaScript(obj: object): string {
  return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`
}

function priceValidUntil(): string {
  return `${new Date().getFullYear() + 1}-12-31`
}

function buildOrganization(settings: ResolvedSettings | null, baseUrl: string): object | undefined {
  if (!settings?.company?.name) return undefined
  return { '@type': 'Organization', name: settings.company.name, url: baseUrl }
}

function buildOffer(variant: ResolvedVariant, url: string, seller: object | undefined): object {
  return {
    '@type': 'Offer',
    url,
    name: variant.title,
    priceCurrency: 'EUR',
    price: (variant.price / 100).toFixed(2),
    priceValidUntil: priceValidUntil(),
    availability: `https://schema.org/${(variant.stock ?? 1) > 0 ? 'InStock' : 'OutOfStock'}`,
    itemCondition: 'https://schema.org/NewCondition',
    ...(seller && { seller }),
  }
}

// ─── Per-type schema builders ─────────────────────────────────────────────────

function buildProductSchema(variant: ResolvedVariant, ctx: SchemaContext): string {
  const { settings, config, imageUrl } = ctx
  const pageUrl = config.baseUrl + variant.url
  const desc = variant.seo?.metaDescription || variant.seo?.shareDescription || variant.wine?.description || ''
  const siteDesc = settings?.siteShortDescription || settings?.siteDescription || ''

  // Variant image takes priority; fall back to Vinofact bottle image for wines
  const image = variant.image
    ? imageUrl(variant.image, 1200)
    : variant.wine?.bottleImage?.url ?? undefined

  const brand = variant.manufacturers[0]
    ? { '@type': 'Brand', name: variant.manufacturers[0].name }
    : undefined

  const categories = variant.categories.map(c => c.title).filter(Boolean)

  const seller = buildOrganization(settings, config.baseUrl)

  // All variants of the same product as separate offers (siblings + self)
  const allVariants = [variant, ...variant.siblings
    .map(s => ctx.products.find(p => p._id === s._id))
    .filter((p): p is ResolvedVariant => p != null),
  ]
  const offers = allVariants.map(v => buildOffer(v, config.baseUrl + v.url, seller))

  // Wine-specific additional properties
  const additionalProperty: object[] = []
  if (variant.wine?.alcohol != null) {
    additionalProperty.push({ '@type': 'PropertyValue', name: 'Alkohol', value: `${variant.wine.alcohol}%` })
  }
  if (variant.wine?.vintage) {
    additionalProperty.push({ '@type': 'PropertyValue', name: 'Jahrgang', value: variant.wine.vintage })
  }
  if (variant.wine?.volume != null) {
    additionalProperty.push({ '@type': 'PropertyValue', name: 'Füllmenge', value: `${variant.wine.volume / 1000} l` })
  }

  return schemaScript({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: variant.title,
    url: pageUrl,
    ...(variant.sku && { sku: variant.sku }),
    ...(desc || siteDesc ? { description: desc || siteDesc } : {}),
    ...(image && { image }),
    ...(brand && { brand }),
    ...(categories.length > 0 && { category: categories.length === 1 ? categories[0] : categories }),
    ...(variant.seo?.keywords && { keywords: variant.seo.keywords }),
    ...(additionalProperty.length > 0 && { additionalProperty }),
    offers,
  })
}

function buildCategorySchema(category: ResolvedCategory, ctx: SchemaContext): string {
  const { config, imageUrl, products } = ctx
  const pageUrl = config.baseUrl + category.url
  const desc = category.seo?.metaDescription || category.seo?.shareDescription || category.description || ''
  const image = category.image ? imageUrl(category.image, 1200) : undefined

  const categoryProducts = products.filter(p =>
    p.categories.some(c => c._id === category._id)
  )

  const itemListElement = categoryProducts.map(p => ({
    '@type': 'Product',
    name: p.title,
    url: config.baseUrl + p.url,
    ...(p.image && { image: imageUrl(p.image, 800) }),
    offers: buildOffer(p, config.baseUrl + p.url, undefined),
  }))

  return schemaScript({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: category.title,
    url: pageUrl,
    ...(desc && { description: desc }),
    ...(image && { image }),
    numberOfItems: itemListElement.length,
    itemListElement,
  })
}

function buildBlogPostingSchema(post: ResolvedPost, ctx: SchemaContext): string {
  const { locale, settings, config, imageUrl } = ctx
  const pageUrl = config.baseUrl + post.url
  const siteDesc = settings?.siteShortDescription || settings?.siteDescription || ''
  const desc = post.seo?.metaDescription || post.seo?.shareDescription || siteDesc
  const image = (post.image as any) ? imageUrl(post.image as any, 1200) : undefined
  const isPartOf = { '@type': 'WebSite', name: settings?.siteTitle ?? '', url: config.baseUrl }
  const author = settings?.company?.name
  const publisher = buildOrganization(settings, config.baseUrl)

  return schemaScript({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    name: post.title,
    url: pageUrl,
    ...(desc && { description: desc }),
    ...(image && { image }),
    ...(post.publishedAt && { datePublished: post.publishedAt }),
    ...(author && { author }),
    inLanguage: locale,
    isPartOf,
    ...(publisher && { publisher }),
  })
}

function buildWebPageSchema(page: ResolvedPage, ctx: SchemaContext): string {
  const { locale, settings, config, imageUrl } = ctx
  const pageUrl = config.baseUrl + page.url
  const siteDesc = settings?.siteShortDescription || settings?.siteDescription || ''
  const desc = page.seo?.metaDescription || page.seo?.shareDescription || siteDesc
  const image = (page.image as any) ? imageUrl(page.image as any, 1200) : undefined
  const isPartOf = { '@type': 'WebSite', name: settings?.siteTitle ?? '', url: config.baseUrl }

  return schemaScript({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.title,
    url: pageUrl,
    ...(desc && { description: desc }),
    ...(image && { image }),
    inLanguage: locale,
    isPartOf,
  })
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildPageDocSchema(
  pageDoc: PageDoc,
  locale: string,
  settings: ResolvedSettings | null,
  config: CoreConfig,
  imageUrl: ImageUrlFn,
  products: ResolvedVariant[] = [],
): string {
  if (!config.baseUrl) return ''

  const ctx: SchemaContext = { locale, settings, config, imageUrl, products }

  switch (pageDoc._type) {
    case 'productVariant': return buildProductSchema(pageDoc, ctx)
    case 'category':       return buildCategorySchema(pageDoc, ctx)
    case 'post':           return buildBlogPostingSchema(pageDoc, ctx)
    case 'page':           return buildWebPageSchema(pageDoc, ctx)
  }
}
