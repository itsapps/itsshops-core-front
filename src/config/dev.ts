import { CoreConfig } from '../types';
import { createRequire } from 'module'

export const setupDev = (config: CoreConfig) => {
  if (!config.dev.enabled) return

  const require = createRequire(import.meta.url)
  const runtime = require('nunjucks/src/runtime')
  const _orig = runtime.memberLookup
  runtime.memberLookup = function(obj: any, val: any) {
    const result = _orig(obj, val)
    if ((result === null || result === undefined) && obj != null)
      console.warn(`[njk] undefined: .${String(val)}  on:`, JSON.stringify(obj)?.slice(0, 120))
    return result
  }
}