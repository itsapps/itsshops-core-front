/**
 * Starts a draft-preview session. Sanity Presentation (core-back `previewMode.enable`) opens
 * `/api/preview/enable?sanity-preview-secret=…&sanity-preview-pathname=…&sanity-preview-perspective=…`
 * with a short-lived secret it just created in the dataset. This function validates that secret
 * against Sanity, sets the signed `itsshops_preview` cookie (1 h) and redirects to the preview path.
 *
 * Usage in customer project (netlify/functions/preview_enable.mts):
 *
 *   import type { Config } from '@netlify/functions'
 *   import { createPreviewEnableHandler } from '@itsapps/itsshops-core-front/functions/preview-enable'
 *   export const config: Config = { path: '/api/preview/enable' }
 *   export default createPreviewEnableHandler()
 *
 * Env (Functions scope): SANITY_PROJECT_ID, SANITY_DATASET, SANITY_TOKEN, PREVIEW_SESSION_SECRET,
 * SERVER_FUNCTIONS_ALLOWED_ORIGINS (Studio origins → frame-ancestors).
 */
import { createClient } from '@sanity/client'
import { validatePreviewUrl } from '@sanity/preview-url-secret'
import { createPreviewSession, previewSessionCookie } from '../utils/preview-session'
import { previewSecurityHeaders } from '../utils/preview-headers'

const PREVIEW_PATH_PREFIX = '/api/preview/'

function textResponse(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { ...previewSecurityHeaders(), 'content-type': 'text/plain; charset=utf-8' },
  })
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
        apiVersion: '2025-02-19',
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

    let session: string
    try {
      session = createPreviewSession()
    } catch (error) {
      console.error('preview-enable:', error)
      return textResponse(500, 'Preview could not be enabled')
    }

    return new Response(null, {
      status: 307,
      headers: {
        ...previewSecurityHeaders(),
        location: result.redirectTo,
        'set-cookie': previewSessionCookie(session),
      },
    })
  }
}
