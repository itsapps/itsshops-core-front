import type { SanityClient } from '@sanity/client'
import { slugify as coreSlugify } from '../utils/slugify'
import { stegaClean } from '@sanity/client/stega'
import type { Locale, PermalinkTranslations, CoreContext } from '../types'
import type { CmsData, CmsLocaleData, ResolvedPage, ResolvedPost } from '../types/data'
import { buildPermalinkTranslations } from '../i18n/permalinks'
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
import { fetchVinofactWines } from './vinofact'
import { makeCtx } from './resolve/context'
import { resolveModules } from './resolve/modules'
import { resolveCategories } from './resolve/categories'
import { resolveVariants } from './resolve/variants'
import { resolveMenus } from './resolve/menus'
import { resolveSettings, resolveShopSettings } from './resolve/settings'

export async function buildCmsData(
  client: SanityClient,
  context: CoreContext,
): Promise<CmsData> {
  const { config, translate } = context

  const permalinks = buildPermalinkTranslations(config.permalinks)
  const features   = config.features
  const extensions = config.extensions ?? {}
  const isPreview  = config.buildMode === 'preview'

  const fetchQuery = (query: string, params?: Record<string, unknown>): Promise<any> =>
    client.fetch(query, params ?? {}, isPreview && config.sanity.studioUrl ? {
      resultSourceMap: true,
      stega: { enabled: true, studioUrl: config.sanity.studioUrl },
    } : {})

  // In preview mode, add _id filter only for the target document type
  const pid = (type: string) =>
    isPreview && config.preview.documentType === type ? config.preview.documentId : undefined

  // ─── Fetch raw data ────────────────────────────────────────────────────────

  const [
    rawProducts, rawVariants, rawCategories,
    rawPages, rawPosts, rawMenus, rawSettings, rawShopSettings,
  ] = await Promise.all([
    features.shop.enabled ? fetchQuery(buildProductQuery(extensions, pid('product')))        : Promise.resolve([]),
    features.shop.enabled ? fetchQuery(buildVariantQuery(extensions, pid('productVariant'))) : Promise.resolve([]),
    features.shop.enabled && features.shop.category
      ? fetchQuery(buildCategoryQuery(extensions, pid('category'))) : Promise.resolve([]),
    fetchQuery(buildPageQuery(extensions, pid('page'))),
    features.blog ? fetchQuery(buildPostQuery(extensions, pid('post'))) : Promise.resolve([]),
    fetchQuery(buildMenuQuery(extensions, config.menu.maxDepth)),
    fetchQuery(buildSettingsQuery()),
    features.shop.enabled ? fetchQuery(buildShopSettingsQuery()) : Promise.resolve(null),
  ])

  // ─── Extension queries (fetched once, resolved per-locale via resolveData) ──

  const rawExtensionEntries = await Promise.all(
    Object.entries(extensions.queries ?? {}).map(([key, query]) =>
      fetchQuery(query).then(result => [key, result] as const)
    )
  )
  const rawExtensionData = Object.fromEntries(rawExtensionEntries)

  // ─── Pre-compute shared maps ───────────────────────────────────────────────

  const productMap = new Map<string, any>(rawProducts.map((p: any) => [p._id, p]))

  const siblingsMap = new Map<string, any[]>()
  for (const v of rawVariants) {
    if (!siblingsMap.has(v.productId)) siblingsMap.set(v.productId, [])
    siblingsMap.get(v.productId)!.push(v)
  }

  // ─── Vinofact ──────────────────────────────────────────────────────────────

  let vinofactMap: Map<string, any> = new Map()
  const vinofact = features.shop.vinofact
  if (vinofact.enabled && vinofact.integration) {
    const wineIds: string[] = [...new Set(
      (rawVariants as any[])
        .map((v) => v.wine?.vinofactWineId as string | undefined)
        .filter((id): id is string => !!id)
    )]
    if (wineIds.length > 0) {
      vinofactMap = await fetchVinofactWines(vinofact, wineIds, config.locales)
    }
  }

  // ─── Per-locale resolution ────────────────────────────────────────────────

  const cms: CmsData = { products: [], categories: [], pages: [], posts: [] }

  const localesToProcess = isPreview && config.preview.locale
    ? [config.preview.locale]
    : config.locales

  for (const locale of localesToProcess) {
    const defaultLocale = config.defaultLocale
    const resolve = extensions.resolve ?? {}
    const ctx = makeCtx(locale, defaultLocale, translate)

    const extensionData = extensions.resolveData
      ? extensions.resolveData(rawExtensionData, ctx)
      : rawExtensionData

    const categories = resolveCategories(rawCategories, ctx, permalinks, resolve.category)
    const categoryMap = new Map(categories.map(c => [c._id, c]))

    const products = features.shop
      ? resolveVariants(rawVariants, productMap, ctx, permalinks, categoryMap, siblingsMap, vinofactMap, resolve)
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
        seo:     ctx.resolveSeo(p.seo),
        ...(resolve.page ? resolve.page(p, ctx) : {}),
      }
    })

    const posts: ResolvedPost[] = features.blog
      ? rawPosts.map((p: any) => {
          const slug = stegaClean(p.slug || p._id)
          return {
            ...p,
            title:       ctx.resolveString(p.title),
            slug,
            url:         `/${locale}/${permalinks[locale].blog}/${slug}/`,
            publishedAt: p.publishedAt ?? null,
            modules:     resolveModules(p.modules, ctx, resolve.module),
            seo:         ctx.resolveSeo(p.seo),
            ...(resolve.post ? resolve.post(p, ctx) : {}),
          }
        })
      : []

    const menus = resolveMenus(rawMenus, ctx, resolve.menuItem)

    const urlMap: Record<string, string> = {}
    for (const p of pages)      urlMap[p._id] = p.url
    for (const c of categories) urlMap[c._id] = c.url
    for (const v of products)   urlMap[v._id] = v.url
    for (const p of posts)      urlMap[p._id] = p.url

    const localeData: CmsLocaleData = {
      products,
      categories,
      pages,
      posts,
      menus,
      settings:     rawSettings     ? resolveSettings(rawSettings, ctx, urlMap)     : null,
      shopSettings: rawShopSettings ? resolveShopSettings(rawShopSettings, ctx)     : null,
      urlMap,
      ...extensionData,
    }

    cms[locale] = localeData

    for (const item of products)   cms.products.push({ ...item, locale })
    for (const item of categories) cms.categories.push({ ...item, locale })
    for (const item of pages)      cms.pages.push({ ...item, locale })
    for (const item of posts)      cms.posts.push({ ...item, locale })
  }

  return cms
}
