import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPreviewSession, verifyPreviewSession, scriptJson } from '../utils/preview-session'

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

  it('scriptJson escapes < so a value cannot close a script element', () => {
    expect(scriptJson('</script><b>')).toBe('"\\u003c/script>\\u003cb>"')
    expect(JSON.parse(scriptJson('</script>'))).toBe('</script>')
  })
})
