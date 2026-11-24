import type { ResolveContext, ResolveHooks } from '../../types'
import type { ResolvedMenu, ResolvedMenuItem } from '../../types/data'
import { stegaClean } from '@sanity/client/stega'

/**
 * URL per system page (`menuItem.systemPage`, a fixed core route such as the withdrawal form).
 * A missing or `'#'` entry means the page's feature is off — such menu items are dropped.
 */
export type SystemPageUrls = Record<string, string>

const isLive = (url: string | undefined): url is string => !!url && url !== '#'

/** `urlMap` key of a system page, e.g. `system:orderWithdraw` (rich-text links, `pageUrl` filter). */
export const systemUrlKey = (systemPage: string) => `system:${systemPage}`

/** Adds the live system pages to `urlMap` under `systemUrlKey(name)`. */
export function addSystemUrls(urlMap: Record<string, string>, systemUrls: SystemPageUrls): void {
  for (const [systemPage, url] of Object.entries(systemUrls)) {
    if (isLive(url)) urlMap[systemUrlKey(systemPage)] = url
  }
}

const systemTitle = (systemPage: string, ctx: ResolveContext) =>
  ctx.translate(`staticPages.${systemPage}.title`)

/**
 * System pages whose link label is fixed by law — an editor title is ignored. The withdrawal
 * function must be labelled exactly "Vertrag widerrufen" (FAGG §13a / Directive 2023/2673).
 */
const FIXED_LABEL_SYSTEM_PAGES = new Set(['orderWithdraw'])

export function resolveMenuItems(
  items: any[],
  ctx: ResolveContext,
  resolveHook?: ResolveHooks['menuItem'],
  systemUrls: SystemPageUrls = {},
): ResolvedMenuItem[] {
  return (items ?? []).flatMap(item => {
    const { title, linkType, url, internal, children, systemPage: rawSystemPage, _key, ...rest } = item
    const systemPage = rawSystemPage ? stegaClean(rawSystemPage) : null
    const isSystem = linkType === 'system'
    if (isSystem && !(systemPage && isLive(systemUrls[systemPage]))) return []
    const resolvedTitle = ctx.resolveString(title)
    return [{
      ...rest,
      _key,
      title:      isSystem
        ? (FIXED_LABEL_SYSTEM_PAGES.has(systemPage!) ? '' : resolvedTitle) || systemTitle(systemPage!, ctx)
        : resolvedTitle,
      linkType:   linkType ?? 'internal',
      url:        isSystem ? systemUrls[systemPage!] : stegaClean(ctx.resolveString(url)) || null,
      internal:   internal ?? null,
      systemPage: isSystem ? systemPage : null,
      children:   resolveMenuItems(children ?? [], ctx, resolveHook, systemUrls),
      ...(resolveHook ? resolveHook(item, ctx) : {}),
    }]
  })
}

export function resolveMenus(
  raw: any[],
  ctx: ResolveContext,
  resolveHook?: ResolveHooks['menuItem'],
  systemUrls: SystemPageUrls = {},
): ResolvedMenu[] {
  return raw.map(m => ({
    _id:   m._id,
    title: ctx.resolveString(m.title),
    items: resolveMenuItems(m.items ?? [], ctx, resolveHook, systemUrls),
  }))
}

const containsSystemPage = (items: ResolvedMenuItem[], systemPage: string): boolean =>
  items.some(i => i.systemPage === systemPage || containsSystemPage(i.children, systemPage))

/**
 * Guarantees a link to a system page that must always be reachable (the right-of-withdrawal form
 * is legally required to be easy to find): if none of the rendered menus (`menuIds` = settings'
 * main + footer menus) links to it, it is appended to the last footer menu. Mutates `menus`.
 */
export function ensureSystemPageLink(
  menus: ResolvedMenu[],
  systemPage: string,
  menuIds: { main: string[]; footer: string[] },
  ctx: ResolveContext,
  systemUrls: SystemPageUrls,
): void {
  const url = systemUrls[systemPage]
  if (!isLive(url)) return
  const rendered = menus.filter(m => menuIds.main.includes(m._id) || menuIds.footer.includes(m._id))
  if (rendered.some(m => containsSystemPage(m.items, systemPage))) return
  const lastFooterId = menuIds.footer.at(-1)
  const target = menus.find(m => m._id === lastFooterId)
  if (!target) return
  target.items.push({
    _key:       `system-${systemPage}`,
    title:      systemTitle(systemPage, ctx),
    linkType:   'system',
    url,
    internal:   null,
    systemPage,
    children:   [],
  })
}
