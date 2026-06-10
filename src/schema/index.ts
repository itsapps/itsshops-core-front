import { stegaClean } from '@sanity/client/stega'
import type { ResolvedVariant, ResolvedCategory, ResolvedPage, ResolvedPost, ResolvedSettings } from '../types/data'
import type { CoreConfig } from '../types'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PageDoc = ResolvedVariant | ResolvedCategory | ResolvedPage | ResolvedPost

type ImageUrlFn = (image: any, width?: number, height?: number) => string

interface SchemaContext {
  locale: string
  settings: ResolvedSettings | null
  config: CoreConfig
  imageUrl: ImageUrlFn
  products: ResolvedVariant[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function schemaScript(obj: object): string {
  return `<script type="application/ld+json">${JSON.stringify(obj, (_k, v) => typeof v === 'string' ? stegaClean(v) : v)}</script>`
}

function priceValidUntil(): string {
  return `${new Date().getFullYear() + 1}-12-31`
}

function orgRef(baseUrl: string): object {
  return { '@type': 'Organization', '@id': `${baseUrl}#organization` }
}

function buildOrganizationFull(settings: ResolvedSettings, baseUrl: string): object {
  const { company } = settings
  if (!company?.name) return orgRef(baseUrl)

  const addr = company.address ? {
    '@type': 'PostalAddress',
    streetAddress: [company.address.line1, company.address.line2].filter(Boolean).join(', ') || undefined,
    postalCode:       company.address.zip     || undefined,
    addressLocality:  company.address.city    || undefined,
    addressCountry:   company.address.country || undefined,
  } : undefined

  return {
    '@type': 'Organization',
    '@id':   `${baseUrl}#organization`,
    name:    company.name,
    url:     baseUrl,
    ...(addr             && { address:   addr }),
    ...(company.email    && { email:     company.email }),
    ...(company.phone    && { telephone: company.phone }),
  }
}

function buildBreadcrumb(items: Array<{ name: string; url: string }>): object {
  return {
    '@context': 'https://schema.org',
    '@type':    'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type':    'ListItem',
      position:   i + 1,
      name:       item.name || '',
      item:       item.url,
    })),
  }
}

function buildOffer(variant: ResolvedVariant, url: string, seller: object | undefined): object {
  return {
    '@type':           'Offer',
    url,
    name:              variant.title,
    priceCurrency:     'EUR',
    price:             ((variant.price ?? 0) / 100).toFixed(2),
    priceValidUntil:   priceValidUntil(),
    availability:      `https://schema.org/${(variant.stock ?? 1) > 0 ? 'InStock' : 'OutOfStock'}`,
    itemCondition:     'https://schema.org/NewCondition',
    ...(seller      && { seller }),
  }
}

// ─── Per-type schema builders ─────────────────────────────────────────────────

function buildProductSchema(variant: ResolvedVariant, ctx: SchemaContext): string {
  const { settings, config, imageUrl } = ctx
  const baseUrl = config.baseUrl!
  const pageUrl = baseUrl + variant.url

  const desc = variant.seo?.metaDescription
    || variant.seo?.shareDescription
    || variant.wine?.description
    || settings?.siteShortDescription
    || ''

  const _variantImg = variant.seo?.shareImage || variant.image
  const image = _variantImg
    ? imageUrl(_variantImg, 1200, 630)
    : variant.wine?.bottleImage?.url ?? undefined

  const brand = variant.manufacturers?.[0]?.name
    ? { '@type': 'Brand', name: variant.manufacturers[0].name }
    : undefined

  const categories = (variant.categories ?? []).map(c => c.title).filter(Boolean)

  const seller = settings?.company?.name ? orgRef(baseUrl) : undefined

  const allVariants = [variant, ...(variant.siblings ?? [])
    .map(s => ctx.products.find(p => p._id === s._id))
    .filter((p): p is ResolvedVariant => p != null),
  ]
  const offers = allVariants.map(v => buildOffer(v, baseUrl + v.url, seller))

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

  const firstCategory = variant.categories?.[0]
  const breadcrumbItems = firstCategory
    ? [
        { name: settings?.siteTitle || '', url: baseUrl },
        { name: firstCategory.title, url: baseUrl + firstCategory.url },
        { name: variant.title, url: pageUrl },
      ]
    : [
        { name: settings?.siteTitle || '', url: baseUrl },
        { name: variant.title, url: pageUrl },
      ]

  return schemaScript({
    '@context': 'https://schema.org',
    '@type':    'Product',
    name:       variant.title,
    url:        pageUrl,
    ...(variant.sku                    && { sku: variant.sku }),
    ...(desc                           && { description: desc }),
    ...(image                          && { image }),
    ...(brand                          && { brand }),
    ...(categories.length > 0          && { category: categories.length === 1 ? categories[0] : categories }),
    ...(additionalProperty.length > 0  && { additionalProperty }),
    offers,
  }) + schemaScript(buildBreadcrumb(breadcrumbItems))
}

function buildCategorySchema(category: ResolvedCategory, ctx: SchemaContext): string {
  const { settings, config, imageUrl, products } = ctx
  const baseUrl = config.baseUrl!
  const pageUrl = baseUrl + category.url

  const desc = category.seo?.metaDescription
    || category.seo?.shareDescription
    || category.description
    || ''

  const categoryProducts = products.filter(p =>
    (p.categories ?? []).some(c => c._id === category._id)
  )

  const itemListElement = categoryProducts.map(p => ({
    '@type': 'Product',
    name:    p.title,
    url:     baseUrl + p.url,
    ...((p.seo?.shareImage || p.image) && { image: imageUrl(p.seo?.shareImage || p.image, 800) }),
    offers: {
      '@type':         'Offer',
      url:             baseUrl + p.url,
      priceCurrency:   'EUR',
      price:           ((p.price ?? 0) / 100).toFixed(2),
      priceValidUntil: priceValidUntil(),
      availability:    `https://schema.org/${(p.stock ?? 1) > 0 ? 'InStock' : 'OutOfStock'}`,
      itemCondition:   'https://schema.org/NewCondition',
    },
  }))

  const breadcrumbItems = [
    { name: settings?.siteTitle || '', url: baseUrl },
    { name: category.title, url: pageUrl },
  ]

  return schemaScript({
    '@context':    'https://schema.org',
    '@type':       'ItemList',
    name:          category.title,
    url:           pageUrl,
    ...(desc    && { description: desc }),
    numberOfItems: itemListElement.length,
    itemListElement,
  }) + schemaScript(buildBreadcrumb(breadcrumbItems))
}

function buildBlogPostingSchema(post: ResolvedPost, ctx: SchemaContext): string {
  const { locale, settings, config, imageUrl } = ctx
  const baseUrl = config.baseUrl!
  const pageUrl = baseUrl + post.url

  const desc = post.seo?.metaDescription
    || post.seo?.shareDescription
    || settings?.siteShortDescription
    || ''

  const _postImg = post.seo?.shareImage || (post.image as any)
  const image    = _postImg ? imageUrl(_postImg, 1200, 630) : undefined
  const isPartOf = { '@type': 'WebSite', '@id': baseUrl }
  const author   = settings?.company?.name ? orgRef(baseUrl) : undefined
  const publisher = settings?.company?.name ? orgRef(baseUrl) : undefined

  return schemaScript({
    '@context':  'https://schema.org',
    '@type':     'BlogPosting',
    headline:    post.title,
    url:         pageUrl,
    inLanguage:  locale,
    ...(desc                  && { description: desc }),
    ...(image                 && { image }),
    ...(post.publishedAt      && { datePublished: post.publishedAt }),
    ...(author                && { author }),
    ...(publisher             && { publisher }),
    isPartOf,
  })
}

function buildWebPageSchema(page: ResolvedPage, ctx: SchemaContext): string {
  const { locale, settings, config, imageUrl } = ctx
  const baseUrl = config.baseUrl!
  const pageUrl = baseUrl + page.url

  const desc = page.seo?.metaDescription
    || page.seo?.shareDescription
    || settings?.siteShortDescription
    || ''

  const _pageImg = page.seo?.shareImage || (page.image as any)
  const image    = _pageImg ? imageUrl(_pageImg, 1200, 630) : undefined
  const isPartOf = { '@type': 'WebSite', '@id': baseUrl }

  return schemaScript({
    '@context':  'https://schema.org',
    '@type':     'WebPage',
    name:        page.title,
    url:         pageUrl,
    inLanguage:  locale,
    ...(desc    && { description: desc }),
    ...(image   && { image }),
    isPartOf,
  })
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildWebSiteSchema(
  settings: ResolvedSettings | null,
  config: CoreConfig,
  locale: string,
): string {
  if (!settings || !config.baseUrl) return ''
  const baseUrl  = config.baseUrl
  const hasOrg   = !!settings.company?.name

  const website = schemaScript({
    '@context':  'https://schema.org',
    '@type':     'WebSite',
    '@id':       baseUrl,
    name:        settings.siteTitle || '',
    url:         baseUrl,
    inLanguage:  locale,
    ...(settings.siteShortDescription && { description: settings.siteShortDescription }),
    ...(hasOrg                        && { publisher: orgRef(baseUrl) }),
  })

  const organization = hasOrg
    ? schemaScript({ '@context': 'https://schema.org', ...buildOrganizationFull(settings, baseUrl) })
    : ''

  return website + organization
}

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
