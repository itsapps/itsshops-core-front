import type { IncomingMessage, ServerResponse } from 'node:http'
import { CoreConfig } from '../types';
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
}