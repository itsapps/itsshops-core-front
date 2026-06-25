import { slugify as coreSlugify } from '../slugify'
import { stegaClean } from '@sanity/client/stega'
import type { ResolveContext, ResolveHooks } from '../../types'
import type { ResolvedPage } from '../../types/data'
import { resolveModules } from './modules'

export function resolvePages(
  raw: any[],
  ctx: ResolveContext,
  homePageId: string | null,
  moduleHook?: ResolveHooks['module'],
  resolveHook?: ResolveHooks['page'],
): ResolvedPage[] {
  return raw.map(p => {
    const title = ctx.resolveString(p.title)
    const slug  = stegaClean(p.slug || coreSlugify(stegaClean(title)) || p._id)
    const url   = p._id === homePageId ? `/${ctx.locale}/` : `/${ctx.locale}/${slug}/`
    return {
      ...p,
      title,
      slug,
      url,
      locale: ctx.locale,
      modules: resolveModules(p.modules, ctx, moduleHook),
      seo:     ctx.resolveSeo(p.seo),
      ...(resolveHook ? resolveHook(p, ctx) : {}),
    }
  })
}
