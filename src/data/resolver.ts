import type { SanityClient } from '@sanity/client'
import { slugify as coreSlugify } from '../utils/slugify'
import { stegaClean } from '@sanity/client/stega'
import type { Config, CoreConfig, Locale, ResolveContext, TranslatorFunction, PermalinkTranslations, CoreContext } from '../types'
import { resolveString, resolveImage, resolveLocaleAltImage, resolveBaseImage, resolveSeo } from './localizers'
import { resolvePortableText } from './portableText'
import { buildPermalinkTranslations } from '../i18n/permalinks'

import type {
  CmsData,
  CmsLocaleData,
  ResolvedVariant,
  ResolvedCategory,
  ResolvedPage,
  ResolvedPost,
  ResolvedMenu,
  ResolvedMenuItem,
  ResolvedSettings,
  ResolvedShopSettings,
  ResolvedCompany,
  ResolvedAddress,
} from '../types/data'
import {
  buildProductQuery,
  buildVariantQuery,
  buildCategoryQuery,
  buildPageQuery,
  buildPostQuery,
  buildMenuQuery,
  buildSettingsQuery,
  buildShopSettingsQuery,
} from './queries'
type ResolveHooks = NonNullable<NonNullable<Config['extensions']>['resolve']>

function makeCtx(locale: Locale, defaultLocale: Locale, translate: TranslatorFunction): ResolveContext {
  return {
    locale,
    defaultLocale,
    resolveString:         (arr) => resolveString(arr, locale, defaultLocale),
    resolveImage:          (raw) => resolveImage(raw, locale, defaultLocale),
    resolveLocaleAltImage: (raw) => resolveLocaleAltImage(raw, locale, defaultLocale),
    resolveBaseImage:      (raw) => resolveBaseImage(raw),
    resolveSeo:            (raw) => resolveSeo(raw, locale, defaultLocale),
    resolvePortableText:   (raw) => resolvePortableText(raw, locale, defaultLocale),
    translate:             (key, params) => translate(key, params, locale),
  }
}

// ---------------------------------------------------------------------------
// Slug generation
// ---------------------------------------------------------------------------

function generateVariantSlug(
  variant: any,
  product: any,
  locale: Locale,
  defaultLocale: Locale
): string {
  const title = stegaClean(
    resolveString(variant.title, locale, defaultLocale)
    || resolveString(product.title, locale, defaultLocale)
    || variant.sku
    || variant._id
  )

  const kind = variant.kind ?? product.kind

  switch (kind) {
    case 'wine': {
      const wine = variant.wine
      const parts = [title]
      if (wine?.volume) parts.push(`${wine.volume}ml`)
      if (wine?.vintage) parts.push(wine.vintage)
      return coreSlugify(parts.join(' '))
    }

    case 'physical':
    case 'digital': {
      const optionNames = (variant.options ?? [])
        .map((o: any) => resolveString(o.name, locale, defaultLocale))
        .filter(Boolean)
      return coreSlugify([title, ...optionNames].join(' '))
    }

    case 'bundle':
    default:
      return coreSlugify(title)
  }
}

function deduplicateSlug(slug: string, used: Set<string>): string {
  if (!used.has(slug)) {
    used.add(slug)
    return slug
  }
  let n = 2
  while (used.has(`${slug}-${n}`)) n++
  const unique = `${slug}-${n}`
  used.add(unique)
  return unique
}

// ---------------------------------------------------------------------------
// Module resolution — resolves known image fields in core module types
// ---------------------------------------------------------------------------

function resolveModules(
  modules: any[],
  ctx: ResolveContext,
  moduleHook?: ResolveHooks['module']
): any[] {
  return (modules ?? []).map(m => {
    let resolved: any
    switch (m._type) {
      case 'hero':
        resolved = { ...m, bgImage: ctx.resolveImage(m.bgImage) }
        break
      case 'multiColumns':
        resolved = {
          ...m,
          columns: (m.columns ?? []).map((col: any) => ({
            ...col,
            image: ctx.resolveImage(col.image),
          })),
        }
        break
      case 'carousel':
        resolved = {
          ...m,
          slides: (m.slides ?? []).map((s: any) => ctx.resolveLocaleAltImage(s)),
        }
        break
      default:
        resolved = m
    }
    return moduleHook ? { ...resolved, ...moduleHook(resolved, ctx) } : resolved
  })
}

// ---------------------------------------------------------------------------
// Resolvers per document type
// ---------------------------------------------------------------------------

function resolveCategories(
  raw: any[],
  ctx: ResolveContext,
  permalinks: Record<Locale, Required<PermalinkTranslations>>,
  resolveHook?: ResolveHooks['category']
): ResolvedCategory[] {
  return raw.map(c => {
    const slug = coreSlugify(stegaClean(ctx.resolveString(c.title) || c._id))
    return {
      _id: c._id,
      title: ctx.resolveString(c.title),
      description: ctx.resolveString(c.description),
      slug,
      url: `/${ctx.locale}/${permalinks[ctx.locale].category}/${slug}/`,
      sortOrder: c.sortOrder ?? 0,
      parentId: c.parent?._id ?? null,
      image: ctx.resolveImage(c.image),
      seo: ctx.resolveSeo(c.seo),
      ...(resolveHook ? resolveHook(c, ctx) : {}),
    }
  })
}

function resolveVariants(
  rawVariants: any[],
  productMap: Map<string, any>,
  ctx: ResolveContext,
  permalinks: Record<Locale, Required<PermalinkTranslations>>,
  categoryMap: Map<string, ResolvedCategory>,
  siblingsMap: Map<string, any[]>,
  resolveHooks?: ResolveHooks
): ResolvedVariant[] {
  const { locale, defaultLocale } = ctx
  const usedSlugs = new Set<string>()

  // First pass: generate slugs
  const withSlugs = rawVariants.map(variant => {
    const product = productMap.get(variant.productId)
    if (!product) return null

    const rawSlug = generateVariantSlug(variant, product, locale, defaultLocale)
    const slug = deduplicateSlug(rawSlug, usedSlugs)
    const url = `/${locale}/${permalinks[locale].product}/${slug}/`
    return { variant, product, slug, url }
  }).filter(Boolean) as Array<{ variant: any; product: any; slug: string; url: string }>

  // Build a quick lookup for sibling URLs (need slugs from first pass)
  const variantUrlMap = new Map(withSlugs.map(({ variant, url }) => [variant._id, url]))

  // Second pass: fully resolve
  return withSlugs.map(({ variant, product, slug, url }) => {
    const rawCategories: any[] = variant.categories?.length
      ? variant.categories
      : (product.categories ?? [])

    const categories = rawCategories
      .map((c: any) => categoryMap.get(c._id))
      .filter(Boolean) as ResolvedCategory[]

    const siblings = (siblingsMap.get(product._id) ?? [])
      .filter((s: any) => s._id !== variant._id)
      .map((s: any) => ({
        _id: s._id,
        title: ctx.resolveString(s.title) || ctx.resolveString(product.title),
        url: variantUrlMap.get(s._id) ?? '',
        status: s.status ?? 'active',
      }))

    const resolved: ResolvedVariant = {
      _id: variant._id,
      slug,
      url,
      status: variant.status ?? 'active',
      title: ctx.resolveString(variant.title) || ctx.resolveString(product.title),
      sku: variant.sku ?? '',
      kind: variant.kind ?? product.kind ?? 'physical',
      featured: variant.featured ?? false,
      price: variant.price ?? product.price ?? 0,
      compareAtPrice: variant.compareAtPrice ?? product.compareAtPrice ?? null,
      image: ctx.resolveImage(variant.image) ?? ctx.resolveImage(product.image),
      seo: ctx.resolveSeo(mergeSeоFallback(variant.seo, product.seo)),
      categories,
      manufacturers: (variant.manufacturers ?? product.manufacturers ?? []).map((m: any) => ({
        _id: m._id,
        name: ctx.resolveString(m.name),
      })),
      taxCategoryId: variant.taxCategory?._id ?? product.taxCategory?._id ?? null,
      stock: variant.stock ?? null,
      wine: variant.wine ?? null,
      options: (variant.options ?? []).map((o: any) => ({
        _id: o._id,
        name: ctx.resolveString(o.name),
      })),
      bundleItems: (variant.bundleItems ?? []).map((b: any) => ({
        quantity: b.quantity ?? 1,
        variant: {
          _id: b.variant._id,
          title: ctx.resolveString(b.variant.title),
        },
      })),
      product: {
        _id: product._id,
        title: ctx.resolveString(product.title),
      },
      siblings,
      // Extended fields from product-level hook (variant hook wins on collision)
      ...(resolveHooks?.product ? resolveHooks.product(product, ctx) : {}),
      ...(resolveHooks?.variant ? resolveHooks.variant(variant, ctx) : {}),
    }

    return resolved
  })
}

/** Merge variant SEO with product SEO as fallback, field by field */
function mergeSeоFallback(variantSeo: any, productSeo: any): any {
  if (!variantSeo && !productSeo) return null
  if (!variantSeo) return productSeo
  if (!productSeo) return variantSeo
  return {
    metaTitle:        variantSeo.metaTitle?.length        ? variantSeo.metaTitle        : productSeo.metaTitle,
    metaDescription:  variantSeo.metaDescription?.length  ? variantSeo.metaDescription  : productSeo.metaDescription,
    shareTitle:       variantSeo.shareTitle?.length       ? variantSeo.shareTitle       : productSeo.shareTitle,
    shareDescription: variantSeo.shareDescription?.length ? variantSeo.shareDescription : productSeo.shareDescription,
    keywords:         variantSeo.keywords?.length         ? variantSeo.keywords         : productSeo.keywords,
    shareImage:       variantSeo.shareImage               ?? productSeo.shareImage,
  }
}

function resolveSettings(raw: any, ctx: ResolveContext, urlMap: Record<string, string>): ResolvedSettings {
  return {
    _id:                  raw._id,
    siteTitle:            ctx.resolveString(raw.siteTitle),
    siteShortDescription: ctx.resolveString(raw.siteShortDescription),
    siteDescription:      ctx.resolvePortableText(raw.siteDescription),
    homePageUrl:  raw.homePage?._id    ? (urlMap[raw.homePage._id] ?? null) : null,
    privacyPage:  raw.privacyPage?._id ?? null,
    mainMenus:            (raw.mainMenus  ?? []).map((m: any) => m._ref),
    footerMenus:          (raw.footerMenus ?? []).map((m: any) => m._ref),
    gtmId:                raw.gtmId ?? null,
    company:              raw.company ? resolveCompany(raw.company, ctx) : null,
  }
}

function resolveCompany(raw: any, ctx: ResolveContext): ResolvedCompany {
  const addr = raw.address
  return {
    name:    ctx.resolveString(raw.name),
    owner:   raw.owner ?? '',
    address: addr
      ? {
          line1:   addr.line1   ?? '',
          line2:   addr.line2   ?? '',
          zip:     addr.zip     ?? '',
          city:    ctx.resolveString(addr.city),
          country: addr.country ?? '',
        } satisfies ResolvedAddress
      : null,
  }
}

function resolveShopSettings(raw: any, ctx: ResolveContext): ResolvedShopSettings {
  return {
    _id:         raw._id,
    shopPageId:  raw.shopPage?._id ?? null,
    defaultCountry:         raw.defaultCountry
      ? { _id: raw.defaultCountry._id, countryCode: raw.defaultCountry.countryCode ?? '' }
      : null,
    freeShippingCalculation: raw.freeShippingCalculation ?? 'afterDiscount',
    stockThreshold:         raw.stockThreshold ?? null,
    defaultTaxCategory:     raw.defaultTaxCategory
      ? {
          _id:   raw.defaultTaxCategory._id,
          title: ctx.resolveString(raw.defaultTaxCategory.title),
          code:  raw.defaultTaxCategory.code ?? '',
        }
      : null,
    orderNumberPrefix:  raw.orderNumberPrefix  ?? null,
    invoiceNumberPrefix: raw.invoiceNumberPrefix ?? null,
    bankAccount:        raw.bankAccount
      ? { name: raw.bankAccount.name ?? '', bic: raw.bankAccount.bic ?? '', iban: raw.bankAccount.iban ?? '' }
      : null,
  }
}

function resolveMenuItems(
  items: any[],
  ctx: ResolveContext,
  resolveHook?: ResolveHooks['menuItem'],
): ResolvedMenuItem[] {
  return (items ?? []).map(item => {
    const { title, linkType, url, internal, children, _key, ...rest } = item
    return {
      ...rest,
      _key,
      title: ctx.resolveString(title),
      linkType: linkType ?? 'internal',
      url: ctx.resolveString(url) || null,
      internal: internal ?? null,
      children: resolveMenuItems(children ?? [], ctx, resolveHook),
      ...(resolveHook ? resolveHook(item, ctx) : {}),
    }
  })
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export async function buildCmsData(
  client: SanityClient,
  context: CoreContext,
): Promise<CmsData> {
  const { config, translate, imageBuilder } = context

  const permalinks = buildPermalinkTranslations(config.permalinks)

  const features = config.features
  const extensions = config.extensions ?? {}

  const isPreview = config.buildMode === 'preview'

  const fetchQuery = <T>(query: string, params?: Record<string, unknown>): Promise<T> =>
    client.fetch<T>(query, params ?? {}, isPreview && config.sanity.studioUrl ? {
      resultSourceMap: true,
      stega: { enabled: true, studioUrl: config.sanity.studioUrl },
    } : {})

  // In preview mode, filter the target document by _id. All other queries run normally
  // since any page can contain modules that reference products, categories, etc.
  const pid = (type: string) =>
    isPreview && config.preview.documentType === type ? config.preview.documentId : undefined

  // Fetch all raw data in parallel
  const [
    rawProducts,
    rawVariants,
    rawCategories,
    rawPages,
    rawPosts,
    rawMenus,
    rawSettings,
    rawShopSettings,
  ] = await Promise.all([
    features.shop.enabled ? fetchQuery(buildProductQuery(extensions, pid('product')))       : Promise.resolve([]),
    features.shop.enabled ? fetchQuery(buildVariantQuery(extensions, pid('productVariant'))): Promise.resolve([]),
    features.shop.enabled && features.shop.category
      ? fetchQuery(buildCategoryQuery(extensions, pid('category'))) : Promise.resolve([]),
    fetchQuery(buildPageQuery(extensions, pid('page'))),
    features.blog ? fetchQuery(buildPostQuery(extensions, pid('post'))) : Promise.resolve([]),
    fetchQuery(buildMenuQuery(extensions, config.menu.maxDepth)),
    fetchQuery(buildSettingsQuery()),
    features.shop.enabled ? fetchQuery(buildShopSettingsQuery()) : Promise.resolve(null),
  ])

  // Run extension queries in parallel
  const extensionKeys = Object.keys(extensions.queries ?? {})
  const extensionResults = await Promise.all(
    extensionKeys.map(key => fetchQuery(extensions.queries![key], { locale: config.defaultLocale }))
  )
  const extensionData = Object.fromEntries(
    extensionKeys.map((key, i) => [key, extensionResults[i]])
  )

  // Build product map and siblings map once (shared across locales)
  const productMap = new Map<string, any>(rawProducts.map((p: any) => [p._id, p]))

  const siblingsMap = new Map<string, any[]>()
  for (const variant of rawVariants) {
    const pid = variant.productId
    if (!siblingsMap.has(pid)) siblingsMap.set(pid, [])
    siblingsMap.get(pid)!.push(variant)
  }

  // Build per-locale data + flat pagination arrays
  const cms: CmsData = {
    products:   [],
    categories: [],
    pages:      [],
    posts:      [],
  }

  const localesToProcess = isPreview && config.preview.locale
    ? [config.preview.locale]
    : config.locales

  for (const locale of localesToProcess) {
    const defaultLocale = config.defaultLocale
    const resolve = extensions.resolve ?? {}
    const ctx = makeCtx(locale, defaultLocale, translate)

    const categories = resolveCategories(rawCategories, ctx, permalinks, resolve.category)
    const categoryMap = new Map(categories.map(c => [c._id, c]))

    const products = features.shop
      ? resolveVariants(rawVariants, productMap, ctx, permalinks, categoryMap, siblingsMap, resolve)
      : []

    const homePageId = rawSettings?.homePage?._id ?? null

    const pages: ResolvedPage[] = rawPages.map((p: any) => {
      const title = ctx.resolveString(p.title)
      const slug  = stegaClean(p.slug || coreSlugify(stegaClean(title)) || p._id)
      const url   = p._id === homePageId ? `/${locale}/` : `/${locale}/${slug}/`
      return {
        ...p,
        title,
        slug,
        url,
        modules: resolveModules(p.modules, ctx, resolve.module),
        seo: ctx.resolveSeo(p.seo),
        ...(resolve.page ? resolve.page(p, ctx) : {}),
      }
    })

    const posts: ResolvedPost[] = features.blog
      ? rawPosts.map((p: any) => {
          const slug = stegaClean(p.slug || p._id)
          return {
            ...p,
            title: ctx.resolveString(p.title),
            slug,
            url: `/${locale}/${permalinks[locale].blog}/${slug}/`,
            publishedAt: p.publishedAt ?? null,
            modules: resolveModules(p.modules, ctx, resolve.module),
            seo: ctx.resolveSeo(p.seo),
            ...(resolve.post ? resolve.post(p, ctx) : {}),
          }
        })
      : []

    const menus: ResolvedMenu[] = rawMenus.map((m: any) => ({
      _id: m._id,
      title: ctx.resolveString(m.title),
      items: resolveMenuItems(m.items ?? [], ctx, resolve.menuItem),
    }))

    const urlMap: Record<string, string> = {}
    for (const p of pages)      urlMap[p._id] = p.url
    for (const c of categories) urlMap[c._id] = c.url
    for (const v of products)   urlMap[v._id] = v.url
    for (const p of posts)      urlMap[p._id] = p.url

    const settings: ResolvedSettings | null = rawSettings
      ? resolveSettings(rawSettings, ctx, urlMap)
      : null

    const shopSettings: ResolvedShopSettings | null = rawShopSettings
      ? resolveShopSettings(rawShopSettings, ctx)
      : null

    const localeData: CmsLocaleData = {
      products,
      categories,
      pages,
      posts,
      menus,
      settings,
      shopSettings,
      urlMap,
      ...extensionData,
    }

    cms[locale] = localeData

    // Append to flat pagination arrays
    for (const item of products)   cms.products.push({ ...item, locale })
    for (const item of categories) cms.categories.push({ ...item, locale })
    for (const item of pages)      cms.pages.push({ ...item, locale })
    for (const item of posts)      cms.posts.push({ ...item, locale })
  }

  return cms
}
