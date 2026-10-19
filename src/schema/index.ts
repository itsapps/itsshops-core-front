import { stegaClean } from '@sanity/client/stega'
import type {
  ResolvedVariant, ResolvedCategory, ResolvedPage, ResolvedPost, ResolvedSettings,
  ResolvedShopSettings, ResolvedShippingMethod,
} from '../types/data'
import type { CoreConfig } from '../types'
import { vinofactImageUrl } from '../image'
import { offerAvailability, buildShippingDetails, type ShippingContext } from './shipping'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PageDoc = ResolvedVariant | ResolvedCategory | ResolvedPage | ResolvedPost

type ImageUrlFn = (image: any, width?: number, height?: number) => string

interface SchemaContext {
  locale: string
  settings: ResolvedSettings | null
  config: CoreConfig
  imageUrl: ImageUrlFn
  products: ResolvedVariant[]
  /** Set only with the checkout feature on — offers then carry `shippingDetails`. */
  shipping: ShippingContext | null
}

/** Shop data for the merchant-listing parts (shipping, return policy). */
export interface SchemaShopData {
  shopSettings: ResolvedShopSettings | null
  shippingMethods: ResolvedShippingMethod[]
  /** Withdrawal-policy page URL (`'#'` when unset). */
  withdrawalPolicyUrl: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function schemaScript(obj: object): string {
  return `<script type="application/ld+json">${JSON.stringify(obj, (_k, v) => typeof v === 'string' ? stegaClean(v) : v)}</script>`
}

function orgRef(baseUrl: string): object {
  return { '@type': 'Organization', '@id': `${baseUrl}#organization` }
}

/**
 * Shop-wide return policy (Organization level — Google's default for all offers). Withdrawal by
 * mail within the statutory 14 days; who pays postage from `returnShippingBorneBy`. Statutory
 * exceptions can't be expressed per product and are left out.
 */
function buildReturnPolicy(settings: ResolvedSettings, shop: SchemaShopData, baseUrl: string): object | undefined {
  const countries = [...new Set(shop.shippingMethods
    .filter(m => m.methodType === 'delivery')
    .flatMap(m => m.countries))]
  if (countries.length === 0) return undefined
  const returnCountry = shop.shopSettings?.returnAddress?.country || settings.company?.address?.country
  const borneBy = shop.shopSettings?.returnShippingBorneBy ?? 'customer'
  const link = shop.withdrawalPolicyUrl && shop.withdrawalPolicyUrl !== '#'
    ? baseUrl + shop.withdrawalPolicyUrl
    : undefined
  return {
    '@type':              'MerchantReturnPolicy',
    applicableCountry:    countries.length === 1 ? countries[0] : countries,
    ...(returnCountry && { returnPolicyCountry: returnCountry }),
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays:   14,
    returnMethod:         'https://schema.org/ReturnByMail',
    returnFees:           borneBy === 'merchant'
      ? 'https://schema.org/FreeReturn'
      : 'https://schema.org/ReturnFeesCustomerResponsibility',
    ...(link && { merchantReturnLink: link }),
  }
}

function buildOrganizationFull(settings: ResolvedSettings, baseUrl: string, returnPolicy?: object): object {
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
    ...orgRef(baseUrl),
    name:    company.name,
    url:     baseUrl,
    ...(addr             && { address:   addr }),
    ...(company.email    && { email:     company.email }),
    ...(company.phone    && { telephone: company.phone }),
    ...(returnPolicy     && { hasMerchantReturnPolicy: returnPolicy }),
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

/** Brand: first manufacturer, else the site title (the shop's brand name), else the company name.
 *  Wineries sell their own brand, so Google gets brand instead of a GTIN. */
function buildBrand(variant: ResolvedVariant, settings: ResolvedSettings | null): object | undefined {
  const name = variant.manufacturers?.[0]?.name || settings?.siteTitle || settings?.company?.name
  return name ? { '@type': 'Brand', name } : undefined
}

/** No price → no offer (checkout rejects it, Google needs a price > 0). Shipping only on offers
 *  that can be bought now. */
function buildOffer(variant: ResolvedVariant, url: string, seller: object | undefined, ctx: SchemaContext): object | null {
  if (!(variant.price > 0)) return null
  const availability = offerAvailability(variant, ctx.config.features.shop.stock)
  const shippingDetails = ctx.shipping && availability === 'InStock'
    ? buildShippingDetails(variant, ctx.shipping, ctx.locale)
    : []
  return {
    '@type':           'Offer',
    url,
    name:              variant.title,
    priceCurrency:     'EUR',
    price:             (variant.price / 100).toFixed(2),
    availability:      `https://schema.org/${availability}`,
    itemCondition:     'https://schema.org/NewCondition',
    ...(seller                      && { seller }),
    ...(shippingDetails.length > 0  && { shippingDetails }),
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
    ? imageUrl(_variantImg, 1200)
    : variant.wine?.bottleImage?.url
      ? vinofactImageUrl(variant.wine.bottleImage.url, 1200, 1200)
      : undefined

  const brand = buildBrand(variant, settings)

  const categories = (variant.categories ?? []).map(c => c.title).filter(Boolean)
  const category = categories.length > 0
    ? { category: categories.length === 1 ? categories[0] : categories }
    : undefined

  const seller = settings?.company?.name ? orgRef(baseUrl) : undefined

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
  const breadcrumb = schemaScript(buildBreadcrumb(breadcrumbItems))

  // A Product without offers is an invalid item for Google — no product markup at all then.
  const offers = buildOffer(variant, pageUrl, seller, ctx)
  if (!offers) return breadcrumb

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

  const siblingPages = (variant.siblings ?? [])
    .map(s => ctx.products.find(p => p._id === s._id))
    .filter((p): p is ResolvedVariant => p != null)

  if (siblingPages.length === 0) {
    return schemaScript({
      '@context': 'https://schema.org',
      '@type':    'Product',
      name:       variant.title,
      url:        pageUrl,
      sku:        variant.sku || variant._id,
      ...(desc                           && { description: desc }),
      ...(image                          && { image }),
      ...(brand                          && { brand }),
      ...category,
      ...(additionalProperty.length > 0  && { additionalProperty }),
      offers,
    }) + breadcrumb
  }

  // Variants with their own pages: Google's multi-page ProductGroup — this page's variant in full,
  // the siblings as URL-only stubs. Volume is the only variant axis Google knows (`size`).
  const groupId = variant.product._id
  const variesBySize = variant.wine?.volume != null
    && siblingPages.some(p => p.wine?.volume != null && p.wine.volume !== variant.wine!.volume)
  const groupDesc = variant.product.description?.replace(/\s+/g, ' ').trim() || desc
  // Variant titles are often just the product title — add the label ("0,75 l · 2022") to tell them apart
  const variantName = variant.label && variant.label !== variant.title ? `${variant.title} ${variant.label}` : variant.title

  return schemaScript({
    '@context':     'https://schema.org',
    '@type':        'ProductGroup',
    '@id':          `${baseUrl}#product-${groupId}`,
    name:           variant.product.title || variant.title,
    productGroupID: groupId,
    ...(groupDesc     && { description: groupDesc }),
    ...(brand         && { brand }),
    ...category,
    ...(variesBySize  && { variesBy: 'https://schema.org/size' }),
    hasVariant: [
      {
        '@type':              'Product',
        name:                 variantName,
        url:                  pageUrl,
        sku:                  variant.sku || variant._id,
        inProductGroupWithID: groupId,
        ...(desc                           && { description: desc }),
        ...(image                          && { image }),
        ...(variesBySize                   && { size: `${variant.wine!.volume! / 1000} l` }),
        ...(additionalProperty.length > 0  && { additionalProperty }),
        offers,
      },
      ...siblingPages.map(p => ({ '@type': 'Product', url: baseUrl + p.url })),
    ],
  }) + breadcrumb
}

function buildCategorySchema(category: ResolvedCategory, ctx: SchemaContext): string {
  const { settings, config, products } = ctx
  const baseUrl = config.baseUrl!
  const pageUrl = baseUrl + category.url

  const desc = category.seo?.metaDescription
    || category.seo?.shareDescription
    || category.description
    || ''

  const categoryProducts = products.filter(p =>
    (p.categories ?? []).some(c => c._id === category._id)
  )

  // Summary list (plain ListItems): Google wants product markup only on product pages.
  const itemListElement = categoryProducts.map((p, i) => ({
    '@type':  'ListItem',
    position: i + 1,
    url:      baseUrl + p.url,
    name:     p.title,
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
  const image    = _postImg ? imageUrl(_postImg, 1200) : undefined
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
  const image    = _pageImg ? imageUrl(_pageImg, 1200) : undefined
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
  shop?: SchemaShopData,
): string {
  if (!settings || !config.baseUrl) return ''
  const baseUrl  = config.baseUrl
  const hasOrg   = !!settings.company?.name
  const returnPolicy = hasOrg && shop && config.features.shop.checkout
    ? buildReturnPolicy(settings, shop, baseUrl)
    : undefined

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
    ? schemaScript({ '@context': 'https://schema.org', ...buildOrganizationFull(settings, baseUrl, returnPolicy) })
    : ''

  return website + '\n' + organization
}

export function buildPageDocSchema(
  pageDoc: PageDoc,
  locale: string,
  settings: ResolvedSettings | null,
  config: CoreConfig,
  imageUrl: ImageUrlFn,
  products: ResolvedVariant[] = [],
  shop?: SchemaShopData,
): string {
  if (!config.baseUrl) return ''

  const shipping: ShippingContext | null = shop && config.features.shop.checkout
    ? {
        methods: shop.shippingMethods,
        freeShippingCalculation: shop.shopSettings?.freeShippingCalculation ?? 'afterDiscount',
      }
    : null
  const ctx: SchemaContext = { locale, settings, config, imageUrl, products, shipping }

  switch (pageDoc._type) {
    case 'productVariant': return buildProductSchema(pageDoc, ctx)
    case 'category':       return buildCategorySchema(pageDoc, ctx)
    case 'post':           return buildBlogPostingSchema(pageDoc, ctx)
    case 'page':           return buildWebPageSchema(pageDoc, ctx)
  }
}
