import type { Context } from '@netlify/functions'
// @ts-ignore - Importing Eleventy which might lack types
import Eleventy from '@11ty/eleventy'
import { PREVIEW_COOKIE_NAME, readCookie, verifyPreviewSession } from '../utils/preview-session'
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

// Fixed bodies only — never echo request input into this text/html response.
function htmlResponse(status: number, title: string): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1></body></html>`,
    { status, headers: { ...previewSecurityHeaders(), 'content-type': 'text/html; charset=utf-8' } },
  )
}

export const preview = async (props: PreviewParams) => {
  if (props.request.method === 'OPTIONS') {
    return new Response(null, { status: 204 })
  }

  // Session cookie set by `preview-enable` after Sanity's preview secret was validated.
  if (!verifyPreviewSession(readCookie(props.request, PREVIEW_COOKIE_NAME))) {
    return htmlResponse(401, 'Preview session expired — reload the Presentation tool in the Studio')
  }

  const { locale, documentType, documentId } = props.context.params ?? {}
  if (
    !LOCALE_RE.test(locale ?? '') ||
    !DOCUMENT_TYPES.has(documentType ?? '') ||
    !DOCUMENT_ID_RE.test(documentId ?? '')
  ) {
    return htmlResponse(400, 'Invalid preview request')
  }

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
      console.error(`preview: no result for ${documentType} ${documentId}`)
      return htmlResponse(500, 'No preview available')
    }

    return new Response(results[0].content, {
      headers: { ...previewSecurityHeaders(), 'content-type': 'text/html; charset=utf-8' },
    })
  } catch (error) {
    console.error('preview: render failed', { documentType, documentId }, error)
    return htmlResponse(500, 'Preview could not be rendered')
  }
}
