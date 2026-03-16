import { slugify as coreSlugify } from '../../utils/slugify'
import { stegaClean } from '@sanity/client/stega'
import type { Locale, ResolveContext, ResolveHooks, PermalinkTranslations } from '../../types'
import type { ResolvedCategory } from '../../types/data'

export function resolveCategories(
  raw: any[],
  ctx: ResolveContext,
  permalinks: Record<Locale, Required<PermalinkTranslations>>,
  resolveHook?: ResolveHooks['category'],
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
