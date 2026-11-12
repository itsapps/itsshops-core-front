import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createPreviewSession,
  verifyPreviewSession,
  previewSessionCookie,
  readCookie,
  PREVIEW_COOKIE_NAME,
} from '../utils/preview-session'

const NOW = Date.UTC(2026, 10, 12, 12, 0, 0)

describe('preview-session', () => {
  beforeEach(() => vi.stubEnv('PREVIEW_SESSION_SECRET', 'a'.repeat(64)))
  afterEach(() => vi.unstubAllEnvs())

  it('accepts a fresh session', () => {
    expect(verifyPreviewSession(createPreviewSession(NOW), NOW + 1000)).toBe(true)
  })

  it('rejects an expired session', () => {
    expect(verifyPreviewSession(createPreviewSession(NOW), NOW + 60 * 60 * 1000 + 1)).toBe(false)
  })

  it('rejects a tampered payload or signature', () => {
    const value = createPreviewSession(NOW)
    const [payload, signature] = value.split('.')
    const laterPayload = Buffer.from(String(Math.floor(NOW / 1000) + 999_999)).toString('base64url')
    expect(verifyPreviewSession(`${laterPayload}.${signature}`, NOW)).toBe(false)
    expect(verifyPreviewSession(`${payload}.${signature.slice(0, -1)}x`, NOW)).toBe(false)
  })

  it('rejects a signature of the wrong length and malformed values', () => {
    const [payload] = createPreviewSession(NOW).split('.')
    expect(verifyPreviewSession(`${payload}.abc`, NOW)).toBe(false)
    expect(verifyPreviewSession('nodot', NOW)).toBe(false)
    expect(verifyPreviewSession('a.b.c', NOW)).toBe(false)
    expect(verifyPreviewSession('', NOW)).toBe(false)
    expect(verifyPreviewSession(null, NOW)).toBe(false)
  })

  it('rejects a session signed with another secret', () => {
    const value = createPreviewSession(NOW)
    vi.stubEnv('PREVIEW_SESSION_SECRET', 'b'.repeat(64))
    expect(verifyPreviewSession(value, NOW)).toBe(false)
  })

  it('is invalid and cannot be created without a secret', () => {
    const value = createPreviewSession(NOW)
    vi.stubEnv('PREVIEW_SESSION_SECRET', '')
    expect(verifyPreviewSession(value, NOW)).toBe(false)
    expect(() => createPreviewSession(NOW)).toThrow(/PREVIEW_SESSION_SECRET/)
  })

  it('builds a cross-site iframe cookie scoped to the preview path', () => {
    const cookie = previewSessionCookie('v')
    expect(cookie).toMatch(/^itsshops_preview=v; /)
    for (const attr of ['Max-Age=3600', 'Path=/api/preview', 'HttpOnly', 'Secure', 'SameSite=None', 'Partitioned']) {
      expect(cookie).toContain(attr)
    }
  })

  it('reads a cookie by name', () => {
    const request = new Request('https://shop.example/', { headers: { cookie: `x=1; ${PREVIEW_COOKIE_NAME}=abc.def ; y=2` } })
    expect(readCookie(request, PREVIEW_COOKIE_NAME)).toBe('abc.def')
    expect(readCookie(request, 'missing')).toBeNull()
    expect(readCookie(new Request('https://shop.example/'), PREVIEW_COOKIE_NAME)).toBeNull()
  })
})
