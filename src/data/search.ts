import type { ResolvedVariant, SearchEntry } from '../types/data'
import type { SearchConfig, SearchBuildContext } from '../types/config'

const DEFAULT_SEARCH_FIELDS = ['title']

/**
 * Build a per-locale search index from resolved variants.
 *
 * Behaviour:
 * - If config.buildProductEntry is set: one entry per product (variants grouped by product._id)
 * - If config.buildEntry is set:        one entry per variant
 * - Otherwise:                          default one-per-product with title + slug
 *
 * Returning null from either builder excludes that product/variant from the index.
 */
export function buildSearchIndex(
  products: ResolvedVariant[],
  config: SearchConfig,
  locale: string,
  ctx: SearchBuildContext,
): SearchEntry[] {
  if (config.buildProductEntry) {
    const groups = new Map<string, ResolvedVariant[]>()
    for (const variant of products) {
      const pid = variant.product._id
      if (!groups.has(pid)) groups.set(pid, [])
      groups.get(pid)!.push(variant)
    }
    const entries: SearchEntry[] = []
    for (const variants of groups.values()) {
      const entry = config.buildProductEntry(variants, locale, ctx)
      if (entry) entries.push(entry)
    }
    return entries
  }

  if (config.buildEntry) {
    return products.flatMap(variant => {
      const entry = config.buildEntry!(variant, locale, ctx)
      return entry ? [entry] : []
    })
  }

  // Default: one entry per product, basic fields only
  const seen = new Set<string>()
  const entries: SearchEntry[] = []
  for (const variant of products) {
    const pid = variant.product._id
    if (seen.has(pid)) continue
    seen.add(pid)
    entries.push({
      id: pid,
      slug: variant.url,
      title: variant.product.title,
    })
  }
  return entries
}

export function resolveSearchFields(config: SearchConfig): string[] {
  return config.searchFields ?? DEFAULT_SEARCH_FIELDS
}
