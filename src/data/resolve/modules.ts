import type { ResolveContext, ResolveHooks } from '../../types'
import { stegaClean } from '@sanity/client/stega'

export function resolveModules(
  modules: any[],
  ctx: ResolveContext,
  moduleHook?: ResolveHooks['module'],
): any[] {
  return (modules ?? []).map(m => {
    let resolved: any
    switch (m._type) {
      case 'productGrid':
      case 'categoryGrid':
        resolved = { ...m, title: ctx.resolveString(m.title) }
        break
      case 'carousel':
        resolved = {
          ...m,
          slides: (m.slides ?? []).map((s: any) => ctx.resolveLocaleAltImage(s)),
        }
        break
      case 'youtube':
        resolved = { ...m, url: stegaClean(m.url) }
        break
      default:
        resolved = m
    }
    return moduleHook ? { ...resolved, ...moduleHook(resolved, ctx) } : resolved
  })
}
