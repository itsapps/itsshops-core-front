import type { ResolveContext, ResolveHooks } from '../../types'
import type { ResolvedMenu, ResolvedMenuItem } from '../../types/data'
import { stegaClean } from '@sanity/client/stega'

export function resolveMenuItems(
  items: any[],
  ctx: ResolveContext,
  resolveHook?: ResolveHooks['menuItem'],
): ResolvedMenuItem[] {
  return (items ?? []).map(item => {
    const { title, linkType, url, internal, children, _key, ...rest } = item
    return {
      ...rest,
      _key,
      title:    ctx.resolveString(title),
      linkType: linkType ?? 'internal',
      url:      stegaClean(ctx.resolveString(url)) || null,
      internal: internal ?? null,
      children: resolveMenuItems(children ?? [], ctx, resolveHook),
      ...(resolveHook ? resolveHook(item, ctx) : {}),
    }
  })
}

export function resolveMenus(
  raw: any[],
  ctx: ResolveContext,
  resolveHook?: ResolveHooks['menuItem'],
): ResolvedMenu[] {
  return raw.map(m => ({
    _id:   m._id,
    title: ctx.resolveString(m.title),
    items: resolveMenuItems(m.items ?? [], ctx, resolveHook),
  }))
}
