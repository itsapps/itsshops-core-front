/**
 * Starts a draft-preview session. Sanity Presentation (core-back `previewMode.enable`) opens
 * `/api/preview-enable?sanity-preview-secret=…&sanity-preview-pathname=…&sanity-preview-perspective=…`
 * in its iframe, with a short-lived secret it just created in the dataset. This function validates
 * that secret against Sanity and answers a tiny page that stores a signed session token (1 h) in
 * the iframe's sessionStorage and then replaces itself with the preview path. `preview`'s loader
 * sends the token back as a header (see utils/preview-session.ts for why not a cookie).
 *
 * Not under `/api/preview/`: that would collide with the preview wrapper's `/api/preview/:locale`.
 *
 * Usage in customer project (netlify/functions/preview_enable.mts):
 *
 *   import type { Config } from '@netlify/functions'
 *   import { createPreviewEnableHandler } from '@itsapps/itsshops-core-front/functions/preview-enable'
 *   export const config: Config = { path: '/api/preview-enable' }
 *   export default createPreviewEnableHandler()
 *
 * Env (Functions scope): SANITY_PROJECT_ID, SANITY_DATASET, SANITY_TOKEN, PREVIEW_SESSION_SECRET,
 * SERVER_FUNCTIONS_ALLOWED_ORIGINS (Studio origins → frame-ancestors).
 */
import { randomBytes } from 'node:crypto'
import { createClient } from '@sanity/client'
import { validatePreviewUrl } from '@sanity/preview-url-secret'
import { sanityApiVersion } from '../../config/constants'
import { createPreviewSession, PREVIEW_STORAGE_KEY, scriptJson } from '../utils/preview-session'
import { previewSecurityHeaders } from '../utils/preview-headers'

const PREVIEW_PATH_PREFIX = '/api/preview/'

function textResponse(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { ...previewSecurityHeaders(), 'content-type': 'text/plain; charset=utf-8' },
  })
}

function storeAndRedirectPage(token: string, redirectTo: string): Response {
  const nonce = randomBytes(16).toString('base64')
  const script =
    `try{sessionStorage.setItem(${scriptJson(PREVIEW_STORAGE_KEY)},${scriptJson(token)})}catch(e){}` +
    `location.replace(${scriptJson(redirectTo)})`
  const html =
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Opening preview…</title></head>' +
    `<body><p>Opening preview…</p><script nonce="${nonce}">${script}</script></body></html>`
  const headers = previewSecurityHeaders()
  headers['content-security-policy'] += `; default-src 'none'; script-src 'nonce-${nonce}'`
  return new Response(html, { headers: { ...headers, 'content-type': 'text/html; charset=utf-8' } })
}

export function createPreviewEnableHandler() {
  return async (request: Request): Promise<Response> => {
    // Client built per request: `check:functions` imports this module without env.
    let result: Awaited<ReturnType<typeof validatePreviewUrl>>
    try {
      const client = createClient({
        projectId: process.env.SANITY_PROJECT_ID,
        dataset: process.env.SANITY_DATASET,
        token: process.env.SANITY_TOKEN,
        // validatePreviewUrl queries with its own pinned apiVersion (withConfig); ours is the default.
        apiVersion: sanityApiVersion,
        useCdn: false,
      })
      // Throws (instead of isValid: false) on a missing token or a Sanity API error.
      result = await validatePreviewUrl(client, request.url)
    } catch (error) {
      console.error('preview-enable: validating the preview secret failed', error)
      return textResponse(500, 'Preview could not be enabled')
    }

    if (!result.isValid) return textResponse(401, 'Invalid preview secret')
    if (!result.redirectTo) return textResponse(400, 'Missing preview path')
    // redirectTo is path-only already (the library resolves it against a dummy origin); the prefix
    // check keeps the redirect on the preview function.
    if (!result.redirectTo.startsWith(PREVIEW_PATH_PREFIX)) return textResponse(400, 'Invalid preview path')

    let token: string
    try {
      token = createPreviewSession()
    } catch (error) {
      console.error('preview-enable:', error)
      return textResponse(500, 'Preview could not be enabled')
    }

    return storeAndRedirectPage(token, result.redirectTo)
  }
}
