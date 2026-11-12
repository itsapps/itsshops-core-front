/**
 * Draft preview render for Sanity Presentation.
 *
 * Usage in customer project (netlify/functions/preview.mts):
 *
 *   import type { Context, Config } from '@netlify/functions'
 *   import { preview } from '@itsapps/itsshops-core-front/functions/preview'
 *   export const config: Config = {
 *     path: ['/api/preview/:locale', '/api/preview/:locale/:documentType/:documentId'],
 *   }
 *   export default (request: Request, context: Context) => preview({ request, context })
 *
 * `/api/preview/:locale` (Presentation's `initial`) renders the home page.
 *
 * Auth: a request without the `x-preview-session` header gets a loader page (no draft content). The
 * loader reads the session token `preview-enable` stored in sessionStorage, fetches the same URL
 * with the header and writes the result into the document. A valid header → the render; missing
 * token / invalid header → "session expired".
 */
import type { Context } from '@netlify/functions'
// @ts-ignore - Importing Eleventy which might lack types
import Eleventy from '@11ty/eleventy'
import {
  PREVIEW_SESSION_HEADER,
  PREVIEW_STORAGE_KEY,
  scriptJson,
  verifyPreviewSession,
} from '../utils/preview-session'
import { previewSecurityHeaders } from '../utils/preview-headers'

interface ElevResult {
  inputPath: string;
  content: string;
}

export type PreviewParams = {
  request: Request;
  context: Context;
}

const LOCALE_RE = /^[a-z]{2}$/
const DOCUMENT_ID_RE = /^[A-Za-z0-9_.-]{1,128}$/
/** The types `pageDoc` (config/templates.ts) resolves. */
const DOCUMENT_TYPES = new Set(['page', 'post', 'productVariant', 'category'])
const EXPIRED_TITLE = 'Preview session expired — reload the Presentation tool in the Studio'

function page(title: string, body = `<h1>${title}</h1>`, head = ''): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title>${head}</head><body>${body}</body></html>`
}

// Fixed bodies only — never echo request input into this text/html response.
function htmlResponse(status: number, html: string): Response {
  return new Response(html, {
    status,
    headers: { ...previewSecurityHeaders(), 'content-type': 'text/html; charset=utf-8', vary: PREVIEW_SESSION_HEADER },
  })
}

// CSP stays frame-ancestors only: document.write keeps this document (and its CSP), so a stricter
// policy here would also apply to the rendered page.
function loaderPage(): string {
  const script = `(async()=>{
var t=null;try{t=sessionStorage.getItem(${scriptJson(PREVIEW_STORAGE_KEY)})}catch(e){}
var h;
if(!t){h=${scriptJson(page(EXPIRED_TITLE))}}
else{try{var r=await fetch(location.href,{headers:{${scriptJson(PREVIEW_SESSION_HEADER)}:t},cache:'no-store',credentials:'same-origin'});h=await r.text()}
catch(e){h=${scriptJson(page('Preview could not be loaded'))}}}
document.open();document.write(h);document.close()})()`
  return page('Loading preview…', '<p role="status">Loading preview…</p>', `<script>${script}</script>`)
}

export const preview = async (props: PreviewParams) => {
  if (props.request.method === 'OPTIONS') {
    return new Response(null, { status: 204 })
  }

  const params = props.context.params ?? {}
  const locale = params.locale ?? ''
  // `/api/preview/:locale` → the home page (pageDoc falls back to settings.homePageId).
  const isHome = !params.documentType && !params.documentId
  const documentType = isHome ? 'page' : (params.documentType ?? '')
  const documentId = isHome ? '' : (params.documentId ?? '')
  if (
    !LOCALE_RE.test(locale) ||
    !DOCUMENT_TYPES.has(documentType) ||
    (!isHome && !DOCUMENT_ID_RE.test(documentId))
  ) {
    return htmlResponse(400, page('Invalid preview request'))
  }

  const token = props.request.headers.get(PREVIEW_SESSION_HEADER)
  if (token === null) return htmlResponse(200, loaderPage())
  if (!verifyPreviewSession(token)) return htmlResponse(401, page(EXPIRED_TITLE))

  const url = new URL(props.request.url)
  // `published` stays; anything else (missing, `drafts`, a release stack) previews drafts.
  const perspective = url.searchParams.get('sanity-preview-perspective') === 'published' ? 'published' : 'drafts'

  // Safe: a function instance serves one request at a time, and every request sets all four.
  process.env.IS_PREVIEW = 'true'
  process.env.PREVIEW_TYPE = documentType
  process.env.PREVIEW_ID = documentId
  process.env.PREVIEW_LOCALE = locale
  process.env.PREVIEW_PERSPECTIVE = perspective

  try {
    const elev = new Eleventy('src', undefined, {
      configPath: 'eleventy.config.mts',
      quietMode: true
    })

    const results = (await elev.toJSON()) as unknown as ElevResult[]
    await elev.destroy?.()

    if (!results[0]) {
      console.error(`preview: no result for ${documentType} ${documentId || '(home)'}`)
      return htmlResponse(500, page('No preview available'))
    }

    return htmlResponse(200, results[0].content)
  } catch (error) {
    console.error('preview: render failed', { documentType, documentId }, error)
    return htmlResponse(500, page('Preview could not be rendered'))
  }
}
