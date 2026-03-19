import type { IncomingMessage, ServerResponse } from 'node:http'
import { CoreConfig } from '../types';
import { createRequire } from 'module'
import type { EleventyConfig } from '11ty.ts'

export const setupDev = (eleventyConfig: EleventyConfig, config: CoreConfig) => {
  if (!config.dev.enabled) return

  const { liveReload, serverPort } = config.dev
  eleventyConfig.setServerOptions({
    port: serverPort,
    showAllHosts: true,
    liveReload: liveReload,
    middleware: [
      function (req: IncomingMessage, res: ServerResponse, next: () => void) {
        if (req.url === '/') {
          res.writeHead(302, { Location: '/de' });
          res.end();
          return;
        }
        next();
      }
    ]
  });

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