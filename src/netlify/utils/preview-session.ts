// Preview session token: `base64url(exp).hmacSHA256(base64url(exp))`, signed with
// PREVIEW_SESSION_SECRET. `preview-enable` hands it out after Sanity's preview secret was validated;
// the page it returns stores it in the iframe's sessionStorage. `preview`'s loader page sends it as
// the `x-preview-session` header. Not a cookie: Safari drops every cookie in a cross-site iframe
// (also `Partitioned`), while sessionStorage survives there (partitioned per top-level site).
// Holds no perspective — Presentation sends that per URL.
import { createHmac, timingSafeEqual } from 'node:crypto'

export const PREVIEW_SESSION_HEADER = 'x-preview-session'
export const PREVIEW_STORAGE_KEY = 'itsshops_preview'
export const PREVIEW_SESSION_TTL_SECONDS = 60 * 60

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

/** Token valid until `now + ttl`. Throws if PREVIEW_SESSION_SECRET is missing. */
export function createPreviewSession(now = Date.now(), ttlSeconds = PREVIEW_SESSION_TTL_SECONDS): string {
  const secret = process.env.PREVIEW_SESSION_SECRET
  if (!secret) throw new Error('PREVIEW_SESSION_SECRET is not set')
  const exp = Math.floor(now / 1000) + ttlSeconds
  const payload = Buffer.from(String(exp)).toString('base64url')
  return `${payload}.${sign(payload, secret)}`
}

/** True only for an untampered, unexpired token signed with the current secret. */
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

/** JSON for an inline <script>: `<` escaped so a value can never close the script element. */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}
