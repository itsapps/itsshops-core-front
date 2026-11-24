import { allowedOrigins } from './server-auth'

/**
 * Headers for every `preview` / `preview-enable` response. Function responses don't get the site's
 * `_headers`, so these are set here. Only the Studio origins may frame the preview; an empty
 * allowlist fails closed.
 */
export function previewSecurityHeaders(): Record<string, string> {
  const origins = allowedOrigins()
  return {
    'content-security-policy': `frame-ancestors ${origins.length ? origins.join(' ') : "'none'"}`,
    'x-robots-tag': 'noindex',
    'cache-control': 'private, no-store',
  }
}
