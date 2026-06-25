import { stegaClean } from '@sanity/client/stega'
import type { Locale, ResolveContext, ResolveHooks, PermalinkTranslations } from '../../types'
import type { ResolvedPost } from '../../types/data'
import { resolveModules } from './modules'

export function resolvePosts(
  raw: any[],
  ctx: ResolveContext,
  permalinks: Record<Locale, Required<PermalinkTranslations>>,
  moduleHook?: ResolveHooks['module'],
  resolveHook?: ResolveHooks['post'],
): ResolvedPost[] {
  return raw.map(p => {
    const slug = stegaClean(p.slug || p._id)
    return {
      ...p,
      title:       ctx.resolveString(p.title),
      slug,
      url:         `/${ctx.locale}/${permalinks[ctx.locale].blog}/${slug}/`,
      locale:      ctx.locale,
      publishedAt: p.publishedAt ?? null,
      modules:     resolveModules(p.modules, ctx, moduleHook),
      seo:         ctx.resolveSeo(p.seo),
      ...(resolveHook ? resolveHook(p, ctx) : {}),
    }
  })
}
