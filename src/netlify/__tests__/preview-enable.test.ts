import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { validatePreviewUrl } = vi.hoisted(() => ({ validatePreviewUrl: vi.fn() }))
vi.mock('@sanity/preview-url-secret', () => ({ validatePreviewUrl }))

import { createPreviewEnableHandler } from '../functions/preview-enable'
import { verifyPreviewSession } from '../utils/preview-session'

const handler = createPreviewEnableHandler()
const call = () => handler(new Request('https://shop.example/api/preview-enable?sanity-preview-secret=s&sanity-preview-pathname=/api/preview/de/page/p1'))

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

  it('invalid secret → 401, no token', async () => {
    validatePreviewUrl.mockResolvedValue({ isValid: false })
    const res = await call()
    expect(res.status).toBe(401)
    expect(await res.text()).toBe('Invalid preview secret')
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
    expect((await call()).status).toBe(400)
  })

  it('valid → a page that stores a signed token and replaces itself with the preview path', async () => {
    const redirectTo = '/api/preview/de/page/p1?sanity-preview-perspective=drafts'
    validatePreviewUrl.mockResolvedValue({ isValid: true, redirectTo })
    const res = await call()
    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie')).toBeNull()
    const html = await res.text()
    const token = html.match(/setItem\("itsshops_preview","([^"]+)"\)/)?.[1]
    expect(verifyPreviewSession(token)).toBe(true)
    expect(html).toContain(`location.replace(${JSON.stringify(redirectTo)})`)
    const nonce = html.match(/<script nonce="([^"]+)">/)?.[1]
    expect(res.headers.get('content-security-policy')).toBe(
      `frame-ancestors https://studio.example; default-src 'none'; script-src 'nonce-${nonce}'`,
    )
    expect(res.headers.get('cache-control')).toBe('private, no-store')
  })

  it('a redirect path with < cannot break out of the script', async () => {
    validatePreviewUrl.mockResolvedValue({ isValid: true, redirectTo: '/api/preview/</script><script>alert(1)' })
    const html = await (await call()).text()
    expect(html.match(/<\/script>/g)).toHaveLength(1)
  })

  it('no allowed origins → frame-ancestors none', async () => {
    vi.stubEnv('SERVER_FUNCTIONS_ALLOWED_ORIGINS', '')
    validatePreviewUrl.mockResolvedValue({ isValid: false })
    expect((await call()).headers.get('content-security-policy')).toBe("frame-ancestors 'none'")
  })
})
