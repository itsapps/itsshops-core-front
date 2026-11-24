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
const call = (opts: { token?: string | null; params?: Record<string, string>; query?: string } = {}) => {
  const headers: Record<string, string> = {}
  const token = opts.token === undefined ? createPreviewSession() : opts.token
  if (token !== null) headers['x-preview-session'] = token
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

  it('no header → the loader page, no render', async () => {
    const res = await call({ token: null })
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('sessionStorage.getItem("itsshops_preview")')
    expect(html).toContain('"x-preview-session":t')
    expect(html).toContain('role="status"')
    expect(toJSON).not.toHaveBeenCalled()
    expect(res.headers.get('content-security-policy')).toBe('frame-ancestors https://studio.example')
  })

  it('invalid or empty header → 401', async () => {
    expect((await call({ token: 'forged.sig' })).status).toBe(401)
    expect((await call({ token: '' })).status).toBe(401)
    expect(toJSON).not.toHaveBeenCalled()
  })

  it.each([
    { ...params, locale: 'deu' },
    { ...params, documentType: '<script>' },
    { ...params, documentType: 'order' },
    { ...params, documentId: 'a b' },
    { ...params, documentId: 'x'.repeat(129) },
    { locale: 'de', documentType: 'page' },
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
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    expect(process.env.PREVIEW_PERSPECTIVE).toBe('drafts')
    expect(process.env.PREVIEW_ID).toBe('abc-123')
  })

  it('/api/preview/:locale renders the home page (type page, no id)', async () => {
    const res = await call({ params: { locale: 'de' } })
    expect(res.status).toBe(200)
    expect(process.env.PREVIEW_TYPE).toBe('page')
    expect(process.env.PREVIEW_ID).toBe('')
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

  it('OPTIONS → 204', async () => {
    const res = await preview({
      request: new Request('https://shop.example/api/preview/de/page/x', { method: 'OPTIONS' }),
      context: { params } as unknown as Context,
    })
    expect(res.status).toBe(204)
  })
})
