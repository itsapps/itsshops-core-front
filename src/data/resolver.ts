import type { SanityClient } from '@sanity/client'
import { slugify as coreSlugify } from '../utils/slugify'
import type { Config, Locale, ResolveContext } from '../types'
import type { PermalinkTranslations } from '../types'
import { resolveString, resolveImage, resolveLocaleAltImage, resolveBaseImage, resolveSeo, initImageBuilder } from './locale'
import { resolvePortableText } from './portableText'

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
} from './types'
import {
  buildProductQuery,
  buildVariantQuery,
  buildCategoryQuery,
  buildPageQuery,
  buildPostQuery,
  buildMenuQuery,
  buildSettingsQuery,
} from './queries'
type ResolveHooks = NonNullable<NonNullable<Config['extensions']>['resolve']>

function makeCtx(locale: Locale, defaultLocale: Locale): ResolveContext {
  return {
    locale,
    defaultLocale,
    resolveString:        (arr) => resolveString(arr, locale, defaultLocale),
    resolveImage:         (raw) => resolveImage(raw, locale, defaultLocale),
    resolveLocaleAltImage:(raw) => resolveLocaleAltImage(raw, locale, defaultLocale),
    resolveBaseImage:     (raw) => resolveBaseImage(raw),
    resolvePortableText:  (raw) => resolvePortableText(raw, locale, defaultLocale),
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
  const title = resolveString(variant.title, locale, defaultLocale)
    || resolveString(product.title, locale, defaultLocale)
    || variant.sku
    || variant._id

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
  locale: Locale,
  defaultLocale: Locale,
  permalinks: Record<Locale, Required<PermalinkTranslations>>,
  resolveHook?: ResolveHooks['category']
): ResolvedCategory[] {
  const ctx = makeCtx(locale, defaultLocale)
  return raw.map(c => {
    const slug = coreSlugify(resolveString(c.title, locale, defaultLocale) || c._id)
    return {
      _id: c._id,
      title: resolveString(c.title, locale, defaultLocale),
      description: resolveString(c.description, locale, defaultLocale),
      slug,
      url: `/${locale}/${permalinks[locale].category}/${slug}/`,
      sortOrder: c.sortOrder ?? 0,
      parentId: c.parent?._id ?? null,
      image: resolveImage(c.image, locale, defaultLocale),
      seo: resolveSeo(c.seo, locale, defaultLocale),
      ...(resolveHook ? resolveHook(c, ctx) : {}),
    }
  })
}

function resolveVariants(
  rawVariants: any[],
  productMap: Map<string, any>,
  locale: Locale,
  defaultLocale: Locale,
  permalinks: Record<Locale, Required<PermalinkTranslations>>,
  categoryMap: Map<string, ResolvedCategory>,
  siblingsMap: Map<string, any[]>,
  resolveHooks?: ResolveHooks
): ResolvedVariant[] {
  const ctx = makeCtx(locale, defaultLocale)
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
        title: resolveString(s.title, locale, defaultLocale)
          || resolveString(product.title, locale, defaultLocale),
        url: variantUrlMap.get(s._id) ?? '',
        status: s.status ?? 'active',
      }))

    const resolved: ResolvedVariant = {
      _id: variant._id,
      slug,
      url,
      status: variant.status ?? 'active',
      title:
        resolveString(variant.title, locale, defaultLocale) ||
        resolveString(product.title, locale, defaultLocale),
      sku: variant.sku ?? '',
      kind: variant.kind ?? product.kind ?? 'physical',
      featured: variant.featured ?? false,
      price: variant.price ?? product.price ?? 0,
      compareAtPrice: variant.compareAtPrice ?? product.compareAtPrice ?? null,
      image:
        resolveImage(variant.image, locale, defaultLocale) ??
        resolveImage(product.image, locale, defaultLocale),
      seo: resolveSeo(
        mergeSeоFallback(variant.seo, product.seo),
        locale,
        defaultLocale
      ),
      categories,
      manufacturers: (variant.manufacturers ?? product.manufacturers ?? []).map((m: any) => ({
        _id: m._id,
        name: resolveString(m.name, locale, defaultLocale),
      })),
      taxCategoryId: variant.taxCategory?._id ?? product.taxCategory?._id ?? null,
      stock: variant.stock ?? null,
      wine: variant.wine ?? null,
      options: (variant.options ?? []).map((o: any) => ({
        _id: o._id,
        name: resolveString(o.name, locale, defaultLocale),
      })),
      bundleItems: (variant.bundleItems ?? []).map((b: any) => ({
        quantity: b.quantity ?? 1,
        variant: {
          _id: b.variant._id,
          title: resolveString(b.variant.title, locale, defaultLocale),
        },
      })),
      product: {
        _id: product._id,
        title: resolveString(product.title, locale, defaultLocale),
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

function resolveMenuItems(
  items: any[],
  locale: Locale,
  defaultLocale: Locale,
  resolveHook?: ResolveHooks['menuItem'],
  ctx?: ResolveContext
): ResolvedMenuItem[] {
  return (items ?? []).map(item => {
    const { title, linkType, url, internal, children, _key, ...rest } = item
    return {
      ...rest,
      _key,
      title: resolveString(title, locale, defaultLocale),
      linkType: linkType ?? 'internal',
      url: resolveString(url, locale, defaultLocale) || null,
      internal: internal ?? null,
      children: resolveMenuItems(children ?? [], locale, defaultLocale, resolveHook, ctx),
      ...(resolveHook && ctx ? resolveHook(item, ctx) : {}),
    }
  })
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export async function buildCmsData(
  client: SanityClient,
  config: Config,
  permalinks: Record<Locale, Required<PermalinkTranslations>>
): Promise<CmsData> {
  initImageBuilder(client)

  const features = config.features ?? {}
  const extensions = config.extensions ?? {}

  // Fetch all raw data in parallel
  const [
    rawProducts,
    rawVariants,
    rawCategories,
    rawPages,
    rawPosts,
    rawMenus,
    rawSettings,
  ] = await Promise.all([
    features.shop    ? client.fetch(buildProductQuery(extensions))  : Promise.resolve([]),
    features.shop    ? client.fetch(buildVariantQuery(extensions))  : Promise.resolve([]),
    features.shop    ? client.fetch(buildCategoryQuery(extensions)) : Promise.resolve([]),
    client.fetch(buildPageQuery(extensions)),
    features.blog    ? client.fetch(buildPostQuery(extensions))     : Promise.resolve([]),
    client.fetch(buildMenuQuery(extensions)),
    client.fetch(buildSettingsQuery()),
  ])

  // Run extension queries in parallel
  const extensionKeys = Object.keys(extensions.queries ?? {})
  const extensionResults = await Promise.all(
    extensionKeys.map(key => client.fetch(extensions.queries![key], { locale: config.defaultLocale }))
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

  for (const locale of config.locales) {
    const defaultLocale = config.defaultLocale
    const resolve = extensions.resolve ?? {}
    const ctx = makeCtx(locale, defaultLocale)

    const categories = resolveCategories(rawCategories, locale, defaultLocale, permalinks, resolve.category)
    const categoryMap = new Map(categories.map(c => [c._id, c]))

    const products = features.shop
      ? resolveVariants(rawVariants, productMap, locale, defaultLocale, permalinks, categoryMap, siblingsMap, resolve)
      : []

    const pages: ResolvedPage[] = rawPages.map((p: any) => {
      const title = resolveString(p.title, locale, defaultLocale)
      // slug.current is a plain string (not an InternationalizedArray)
      const slug = coreSlugify(title) || p._id
      return {
        ...p,
        title,
        slug,
        url: `/${locale}/${permalinks[locale].page}/${slug}/`,
        modules: resolveModules(p.modules, ctx, resolve.module),
        seo: resolveSeo(p.seo, locale, defaultLocale),
        ...(resolve.page ? resolve.page(p, ctx) : {}),
      }
    })

    const posts: ResolvedPost[] = features.blog
      ? rawPosts.map((p: any) => {
          const slug = p.slug || p._id
          return {
            ...p,
            title: resolveString(p.title, locale, defaultLocale),
            slug,
            url: `/${locale}/${permalinks[locale].blog}/${slug}/`,
            publishedAt: p.publishedAt ?? null,
            modules: resolveModules(p.modules, ctx, resolve.module),
            seo: resolveSeo(p.seo, locale, defaultLocale),
            ...(resolve.post ? resolve.post(p, ctx) : {}),
          }
        })
      : []

    const menus: ResolvedMenu[] = rawMenus.map((m: any) => ({
      _id: m._id,
      title: resolveString(m.title, locale, defaultLocale),
      items: resolveMenuItems(m.items ?? [], locale, defaultLocale, resolve.menuItem, ctx),
    }))

    const settings: ResolvedSettings | null = rawSettings
      ? {
          _id: rawSettings._id,
          siteTitle: resolveString(rawSettings.siteTitle, locale, defaultLocale),
          siteShortDescription: resolveString(rawSettings.siteShortDescription, locale, defaultLocale),
          homePage: rawSettings.homePage?._id ?? null,
          privacyPage: rawSettings.privacyPage?._id ?? null,
          mainMenus: (rawSettings.mainMenus ?? []).map((m: any) => m._ref),
          footerMenus: (rawSettings.footerMenus ?? []).map((m: any) => m._ref),
          gtmId: rawSettings.gtmId ?? null,
        }
      : null

    const localeData: CmsLocaleData = {
      products,
      categories,
      pages,
      posts,
      menus,
      settings,
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
