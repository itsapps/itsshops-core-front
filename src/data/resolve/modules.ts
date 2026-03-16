import type { ResolveContext, ResolveHooks } from '../../types'

export function resolveModules(
  modules: any[],
  ctx: ResolveContext,
  moduleHook?: ResolveHooks['module'],
): any[] {
  return (modules ?? []).map(m => {
    let resolved: any
    switch (m._type) {
      case 'hero':
        resolved = { ...m, bgImage: ctx.resolveImage(m.bgImage) }
        break
      case 'multiColumns':
        resolved = {
          ...m,
          columns: (m.columns ?? []).map((col: any) => ({
            ...col,
            image: ctx.resolveImage(col.image),
          })),
        }
        break
      case 'carousel':
        resolved = {
          ...m,
          slides: (m.slides ?? []).map((s: any) => ctx.resolveLocaleAltImage(s)),
        }
        break
      default:
        resolved = m
    }
    return moduleHook ? { ...resolved, ...moduleHook(resolved, ctx) } : resolved
  })
}
