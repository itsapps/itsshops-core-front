import type { ResolveContext, ResolveHooks } from '../../types'
import { stegaClean } from '@sanity/client/stega'
import { resolveFilterSpecs } from './filters'

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
      case 'productList':
        resolved = {
          ...m,
          title: ctx.resolveString(m.title),
          filters: resolveFilterSpecs(m.filters, ctx),
        }
        break
      case 'carousel':
        resolved = {
          ...m,
          slides: (m.slides ?? []).map((s: any) => ctx.resolveLocaleAltImage(s)).filter(Boolean),
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
