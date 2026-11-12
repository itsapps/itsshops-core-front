import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Context } from '@netlify/functions'

const { toJSON } = vi.hoisted(() => ({ toJSON: vi.fn() }))
vi.mock('@11ty/eleventy', () => ({
  default: vi.fn(function Eleventy() {
    return { toJSON, destroy: vi.fn() }
  }),
}))

import { preview } from '../functions/preview'
import { createPreviewSession } from '../utils/preview-session'

const params = { locale: 'de', documentType: 'page', documentId: 'abc-123' }
const call = (opts: { cookie?: string | null; params?: Record<string, string>; query?: string } = {}) => {
  const headers: Record<string, string> = {}
  const cookie = opts.cookie === undefined ? `itsshops_preview=${createPreviewSession()}` : opts.cookie
  if (cookie) headers.cookie = cookie
  return preview({
    request: new Request(`https://shop.example/api/preview/de/page/abc-123${opts.query ?? ''}`, { headers }),
    context: { params: opts.params ?? params } as unknown as Context,
  })
}

describe('preview', () => {
  beforeEach(() => {
    vi.stubEnv('PREVIEW_SESSION_SECRET', 'a'.repeat(64))
    vi.stubEnv('SERVER_FUNCTIONS_ALLOWED_ORIGINS', 'https://studio.example')
    toJSON.mockReset().mockResolvedValue([{ inputPath: 'x', content: '<p>ok</p>' }])
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('no cookie → 401', async () => {
    const res = await call({ cookie: null })
    expect(res.status).toBe(401)
    expect(toJSON).not.toHaveBeenCalled()
  })

  it('bad cookie → 401', async () => {
    expect((await call({ cookie: 'itsshops_preview=forged.sig' })).status).toBe(401)
  })

  it.each([
    { ...params, locale: 'deu' },
    { ...params, documentType: '<script>' },
    { ...params, documentType: 'order' },
    { ...params, documentId: 'a b' },
    { ...params, documentId: 'x'.repeat(129) },
  ])('bad params → 400 (%o)', async (p) => {
    const res = await call({ params: p })
    expect(res.status).toBe(400)
    expect(toJSON).not.toHaveBeenCalled()
  })

  it('renders with security headers', async () => {
    const res = await call()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('<p>ok</p>')
    expect(res.headers.get('content-security-policy')).toBe('frame-ancestors https://studio.example')
    expect(res.headers.get('x-robots-tag')).toBe('noindex')
    expect(process.env.PREVIEW_PERSPECTIVE).toBe('drafts')
  })

  it('keeps published, maps anything else to drafts', async () => {
    await call({ query: '?sanity-preview-perspective=published' })
    expect(process.env.PREVIEW_PERSPECTIVE).toBe('published')
    await call({ query: '?sanity-preview-perspective=rABC,drafts' })
    expect(process.env.PREVIEW_PERSPECTIVE).toBe('drafts')
  })

  it('an Eleventy throw → generic 500 without the input', async () => {
    toJSON.mockRejectedValue(new Error('boom abc-123'))
    const res = await call()
    expect(res.status).toBe(500)
    const body = await res.text()
    expect(body).not.toContain('abc-123')
    expect(body).not.toContain('boom')
    expect(res.headers.get('content-security-policy')).toContain('frame-ancestors')
  })

  it('OPTIONS → 204 without a cookie', async () => {
    const res = await preview({
      request: new Request('https://shop.example/api/preview/de/page/x', { method: 'OPTIONS' }),
      context: { params } as unknown as Context,
    })
    expect(res.status).toBe(204)
  })
})
