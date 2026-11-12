// Preview session cookie: `base64url(exp).hmacSHA256(base64url(exp))`, signed with
// PREVIEW_SESSION_SECRET. Set by `preview-enable` after Sanity's preview secret was validated,
// checked by `preview` on every render. Holds no perspective — Presentation sends that per URL.
import { createHmac, timingSafeEqual } from 'node:crypto'

export const PREVIEW_COOKIE_NAME = 'itsshops_preview'
export const PREVIEW_SESSION_TTL_SECONDS = 60 * 60

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

/** Cookie value valid until `now + ttl`. Throws if PREVIEW_SESSION_SECRET is missing. */
export function createPreviewSession(now = Date.now(), ttlSeconds = PREVIEW_SESSION_TTL_SECONDS): string {
  const secret = process.env.PREVIEW_SESSION_SECRET
  if (!secret) throw new Error('PREVIEW_SESSION_SECRET is not set')
  const exp = Math.floor(now / 1000) + ttlSeconds
  const payload = Buffer.from(String(exp)).toString('base64url')
  return `${payload}.${sign(payload, secret)}`
}

/** True only for an untampered, unexpired value signed with the current secret. */
export function verifyPreviewSession(value: string | null | undefined, now = Date.now()): boolean {
  const secret = process.env.PREVIEW_SESSION_SECRET
  if (!secret || !value) return false
  const [payload, signature, ...rest] = value.split('.')
  if (!payload || !signature || rest.length) return false
  const expected = Buffer.from(sign(payload, secret))
  const provided = Buffer.from(signature)
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return false
  const exp = Number(Buffer.from(payload, 'base64url').toString())
  return Number.isInteger(exp) && exp * 1000 > now
}

export function previewSessionCookie(value: string): string {
  // The preview runs inside the Studio's cross-site iframe → SameSite=None + Partitioned (CHIPS).
  return [
    `${PREVIEW_COOKIE_NAME}=${value}`,
    `Max-Age=${PREVIEW_SESSION_TTL_SECONDS}`,
    'Path=/api/preview',
    'HttpOnly',
    'Secure',
    'SameSite=None',
    'Partitioned',
  ].join('; ')
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim()
  }
  return null
}
