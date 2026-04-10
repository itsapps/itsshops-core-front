import { slugify as coreSlugify } from '../../utils/slugify'
import { stegaClean } from '@sanity/client/stega'
import type { Locale, ResolveContext, ResolveHooks, PermalinkTranslations } from '../../types'
import type { ResolvedCategory, ResolvedVariant } from '../../types/data'
import { resolveString } from '../localizers'
import { formatVolumeMl } from '../../filters'
import { buildFilterAttributes, accumulateFilterGroups, type FilterAccumulator } from './filters'

// ---------------------------------------------------------------------------
// Slug generation
// ---------------------------------------------------------------------------

function buildVariantLabel(
  title: string,
  kind: string,
  variant: any,
  ctx: ResolveContext,
): { labels: string[]; label: string } {
  switch (kind) {
    case 'wine': {
      const parts: string[] = []
      if (variant.wine?.volume)  parts.push(formatVolumeMl(variant.wine.volume, ctx.units.volume, ctx.locale))
      if (variant.wine?.vintage) parts.push(String(variant.wine.vintage))
      return { label: parts.length ? parts.join(' · ') : title, labels: parts.length ? parts : [title] }
    }
    case 'physical':
    case 'digital': {
      const optionNames = (variant.options ?? [])
        .map((o: any) => resolveString(o.name, ctx.locale, ctx.defaultLocale))
        .filter(Boolean)
      return {
        label: optionNames.length ? optionNames.join(' · ') : title,
        labels: optionNames.length ? optionNames : [title]
      }
    }
    default:
      return { label: title, labels: [title]}
  }
}

function generateVariantSlug(
  variant: any,
  product: any,
  locale: Locale,
  defaultLocale: Locale,
): string {
  const title = stegaClean(
    resolveString(variant.title, locale, defaultLocale)
    || resolveString(product.title, locale, defaultLocale)
    || variant.sku
    || variant._id
  )
  const kind = variant.kind ?? product.kind
  // Slugs use fixed 'ml' — volume unit config must not change existing URLs
  switch (kind) {
    case 'wine': {
      const parts = [title]
      if (variant.wine?.volume)  parts.push(`${variant.wine.volume}ml`)
      if (variant.wine?.vintage) parts.push(variant.wine.vintage)
      return coreSlugify(parts.join(' '))
    }
    case 'physical':
    case 'digital': {
      const optionNames = (variant.options ?? [])
        .map((o: any) => resolveString(o.name, locale, defaultLocale))
        .filter(Boolean)
      return coreSlugify([title, ...optionNames].join(' '))
    }
    default:
      return coreSlugify(title)
  }
}

function deduplicateSlug(slug: string, used: Set<string>): string {
  if (!used.has(slug)) { used.add(slug); return slug }
  let n = 2
  while (used.has(`${slug}-${n}`)) n++
  const unique = `${slug}-${n}`
  used.add(unique)
  return unique
}

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

// ---------------------------------------------------------------------------
// Wine enrichment
// ---------------------------------------------------------------------------

/**
 * Recursively resolve locale maps ({ de: '...', en: '...' }) anywhere in a
 * Vinofact API response — top-level fields, nested objects, and arrays.
 * Plain scalars pass through unchanged.
 */
function resolveLocaleMaps(value: unknown, locale: string, defaultLocale: string): unknown {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) {
    return value.map(item => resolveLocaleMaps(item, locale, defaultLocale))
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value as object)
    if (keys.length > 0 && keys.every(k => /^[a-z]{2}(-[A-Z]{2})?$/.test(k))) {
      return (value as any)[locale] ?? (value as any)[defaultLocale] ?? null
    }
    const resolved: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as object)) {
      resolved[k] = resolveLocaleMaps(v, locale, defaultLocale)
    }
    return resolved
  }
  return value
}

function resolveWine(
  sanityWine: any,
  vinofactMap: Map<string, any>,
  ctx: ResolveContext,
): Record<string, unknown> {
  const vinofactData = sanityWine.vinofactWineId
    ? (vinofactMap.get(sanityWine.vinofactWineId) ?? {})
    : {}

  const resolved = resolveLocaleMaps(vinofactData, ctx.locale, ctx.defaultLocale) as Record<string, unknown>

  const numbersMultipliedFields = ['alcohol', 'residualSugar', 'tartaricAcid', 'totalSulfur', 'freeSulfur', 'phValue', 'histamine']
  for (const field of numbersMultipliedFields) {
    if (typeof resolved[field] === 'number') {
      resolved[field] = resolved[field] / 100
    }
  }
  // if (typeof resolved.alcohol === 'number') {
  //   resolved.alcohol = resolved.alcohol / 100
  // }
  // if (typeof resolved.tartaricAcid === 'number') {
  //   resolved.tartaricAcid = resolved.tartaricAcid / 100
  // }

  return {
    volume:  sanityWine.volume  ?? null,
    vintage: sanityWine.vintage ?? null,
    ...resolved,
  }
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

export function resolveVariants(
  rawVariants: any[],
  productMap: Map<string, any>,
  ctx: ResolveContext,
  permalinks: Record<Locale, Required<PermalinkTranslations>>,
  categoryMap: Map<string, ResolvedCategory>,
  siblingsMap: Map<string, any[]>,
  vinofactMap: Map<string, any>,
  resolveHooks?: ResolveHooks,
  filterAcc?: FilterAccumulator,
): ResolvedVariant[] {
  const { locale, defaultLocale } = ctx
  const usedSlugs = new Set<string>()
  const rawVariantMap = new Map(rawVariants.map(v => [v._id, v]))

  // First pass: generate slugs
  const withSlugs = rawVariants.map(variant => {
    const product = productMap.get(variant.productId)
    if (!product) return null
    const rawSlug = generateVariantSlug(variant, product, locale, defaultLocale)
    const slug = deduplicateSlug(rawSlug, usedSlugs)
    const url = `/${locale}/${permalinks[locale].product}/${slug}/`
    return { variant, product, slug, url }
  }).filter(Boolean) as Array<{ variant: any; product: any; slug: string; url: string }>

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
      .map((s: any) => {
        const sKind  = stegaClean(s.kind ?? product.kind ?? 'physical')
        const sTitle = ctx.resolveString(s.title) || ctx.resolveString(product.title)
        return {
          _id:    s._id,
          title:  sTitle,
          ...buildVariantLabel(sTitle, sKind, s, ctx),
          url:    variantUrlMap.get(s._id) ?? '',
          status: s.status ?? 'active',
          kind:   sKind,
          volume:  s.wine?.volume ?? null,
          vintage: s.wine?.vintage ?? null,
        }
      })

    const kind      = stegaClean(variant.kind ?? product.kind ?? 'physical')
    const wine      = variant.wine ? resolveWine(variant.wine, vinofactMap, ctx) as ResolvedVariant['wine'] : null
    const rawOpts   = variant.options ?? []
    const filterAttributes = buildFilterAttributes(kind, wine, rawOpts, ctx, categories)
    if (filterAcc) accumulateFilterGroups(filterAcc, kind, wine, rawOpts, ctx, categories)
    
    const title = ctx.resolveString(variant.title) || ctx.resolveString(product.title)

    const resolved: ResolvedVariant = {
      _id:            variant._id,
      _type:          'productVariant',
      _updatedAt:     variant._updatedAt ?? null,
      slug,
      url,
      locale:         locale,
      status:         stegaClean(variant.status ?? 'active') as ResolvedVariant['status'],
      title,
      ...buildVariantLabel(
        title,
        kind,
        variant,
        ctx,
      ),
      sku:            variant.sku ?? '',
      kind,
      featured:       variant.featured ?? false,
      price:          variant.price ?? product.price ?? 0,
      compareAtPrice: variant.compareAtPrice ?? product.compareAtPrice ?? null,
      image:          ctx.resolveLocaleAltImage(variant.image) ?? ctx.resolveLocaleAltImage(product.image),
      productImage:   ctx.resolveLocaleAltImage(product.image),
      seo:            ctx.resolveSeo(mergeSeоFallback(variant.seo, product.seo)),
      categories,
      manufacturers: (variant.manufacturers ?? product.manufacturers ?? []).map((m: any) => ({
        _id:  m._id,
        name: ctx.resolveString(m.name),
      })),
      taxCategoryId: variant.taxCategory?._id ?? product.taxCategory?._id ?? null,
      stock: variant.stock ?? null,
      wine,
      options: (variant.options ?? []).map((o: any) => ({
        _id:  o._id,
        name: ctx.resolveString(o.name),
      })),
      bundleItems: (variant.bundleItems ?? []).flatMap((b: any) => {
        const rawV = rawVariantMap.get(b.variantId)
        if (!rawV) return []
        const rawP = productMap.get(rawV.productId)
        return [{
          quantity: b.quantity ?? 1,
          variant: {
            _id:     rawV._id,
            title:   ctx.resolveString(rawV.title) || ctx.resolveString(rawP?.title),
            url:     variantUrlMap.get(rawV._id) ?? null,
            kind:    rawV.kind ?? rawP?.kind ?? 'physical',
            volume:  rawV.wine?.volume  ?? null,
            vintage: rawV.wine?.vintage ?? null,
            options: (rawV.options ?? []).map((o: any) => ({
              _id:  o._id,
              name: ctx.resolveString(o.name),
            })),
          },
        }]
      }),
      product: {
        _id:   product._id,
        title: ctx.resolveString(product.title),
      },
      siblings,
      filterAttributes,
      // Extended fields from product-level hook (variant hook wins on collision)
      ...(resolveHooks?.product ? resolveHooks.product(product, ctx) : {}),
      ...(resolveHooks?.variant ? resolveHooks.variant(variant, ctx) : {}),
    }

    // Wine description fallback for SEO meta description
    if (!resolved.seo.metaDescription && resolved.wine) {
      const wineDesc = (resolved.wine as any).description
      if (typeof wineDesc === 'string' && wineDesc) {
        resolved.seo = { ...resolved.seo, metaDescription: wineDesc }
      }
    }

    return resolved
  })
}
