import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { validatePreviewUrl } = vi.hoisted(() => ({ validatePreviewUrl: vi.fn() }))
vi.mock('@sanity/preview-url-secret', () => ({ validatePreviewUrl }))

import { createPreviewEnableHandler } from '../functions/preview-enable'
import { verifyPreviewSession } from '../utils/preview-session'

const handler = createPreviewEnableHandler()
const call = () => handler(new Request('https://shop.example/api/preview/enable?sanity-preview-secret=s&sanity-preview-pathname=/api/preview/de/page/p1'))

describe('preview-enable', () => {
  beforeEach(() => {
    vi.stubEnv('SANITY_PROJECT_ID', 'abc123')
    vi.stubEnv('SANITY_DATASET', 'development')
    vi.stubEnv('SANITY_TOKEN', 'token')
    vi.stubEnv('PREVIEW_SESSION_SECRET', 'a'.repeat(64))
    vi.stubEnv('SERVER_FUNCTIONS_ALLOWED_ORIGINS', 'https://studio.example')
    validatePreviewUrl.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('invalid secret → 401, no cookie', async () => {
    validatePreviewUrl.mockResolvedValue({ isValid: false })
    const res = await call()
    expect(res.status).toBe(401)
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  it('validation throws (bad token, API error) → 500 with a fixed body', async () => {
    validatePreviewUrl.mockRejectedValue(new Error('Unauthorized - secret <b>'))
    const res = await call()
    expect(res.status).toBe(500)
    expect(await res.text()).toBe('Preview could not be enabled')
  })

  it('valid without a path → 400', async () => {
    validatePreviewUrl.mockResolvedValue({ isValid: true })
    expect((await call()).status).toBe(400)
  })

  it('redirectTo outside /api/preview/ → 400', async () => {
    validatePreviewUrl.mockResolvedValue({ isValid: true, redirectTo: '/de/konto/' })
    const res = await call()
    expect(res.status).toBe(400)
    expect(res.headers.get('location')).toBeNull()
  })

  it('valid → 307 to the preview path with a signed session cookie', async () => {
    const redirectTo = '/api/preview/de/page/p1?sanity-preview-perspective=drafts'
    validatePreviewUrl.mockResolvedValue({ isValid: true, redirectTo })
    const res = await call()
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(redirectTo)
    const cookie = res.headers.get('set-cookie')!
    for (const attr of ['HttpOnly', 'Secure', 'SameSite=None', 'Partitioned', 'Path=/api/preview', 'Max-Age=3600']) {
      expect(cookie).toContain(attr)
    }
    const value = cookie.split(';')[0].split('=')[1]
    expect(verifyPreviewSession(value)).toBe(true)
    expect(res.headers.get('content-security-policy')).toBe('frame-ancestors https://studio.example')
    expect(res.headers.get('cache-control')).toBe('private, no-store')
  })

  it('no allowed origins → frame-ancestors none', async () => {
    vi.stubEnv('SERVER_FUNCTIONS_ALLOWED_ORIGINS', '')
    validatePreviewUrl.mockResolvedValue({ isValid: false })
    expect((await call()).headers.get('content-security-policy')).toBe("frame-ancestors 'none'")
  })
})
