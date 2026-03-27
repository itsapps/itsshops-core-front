import type { IncomingMessage, ServerResponse } from 'node:http'
import { CoreConfig } from '../types';
import { createRequire } from 'module'
import type { EleventyConfig } from '11ty.ts'

export const setupDev = (eleventyConfig: EleventyConfig, config: CoreConfig) => {
  // Server options apply whenever --serve is used (Eleventy ignores them otherwise)
  eleventyConfig.setServerOptions({
    port: config.serve.port,
    showAllHosts: true,
    liveReload: config.serve.liveReload,
    middleware: [
      function (req: IncomingMessage, res: ServerResponse, next: () => void) {
        if (req.url === '/') {
          const location = config.buildMode === 'maintenance'
            ? '/maintenance/'
            : `/${config.defaultLocale}/`
          res.writeHead(302, { Location: location });
          res.end();
          return;
        }
        next();
      }
    ]
  });

  // Debug helpers only when ITSSHOPS_DEBUG=true / --dev
  if (!config.debug.enabled) return

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