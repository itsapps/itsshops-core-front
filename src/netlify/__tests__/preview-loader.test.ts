// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Context } from '@netlify/functions'

vi.mock('@11ty/eleventy', () => ({ default: vi.fn() }))

import { preview } from '../functions/preview'

async function loaderScript(): Promise<string> {
  vi.stubEnv('SERVER_FUNCTIONS_ALLOWED_ORIGINS', 'https://studio.example')
  const res = await preview({
    request: new Request('https://shop.example/api/preview/de'),
    context: { params: { locale: 'de' } } as unknown as Context,
  })
  return (await res.text()).match(/<script>([\s\S]*)<\/script>/)![1]
}

// The script ends in an async IIFE; wait for its fetch + document.write.
const run = async (script: string) => {
  new Function(script)()
  await new Promise((r) => setTimeout(r, 0))
  await new Promise((r) => setTimeout(r, 0))
}

describe('preview loader page (browser side)', () => {
  beforeEach(() => sessionStorage.clear())
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('fetches the same URL with the stored token and writes the result', async () => {
    sessionStorage.setItem('itsshops_preview', 'tok.sig')
    const fetchMock = vi.fn().mockResolvedValue({ text: async () => '<html><body><h1>Draft page</h1></body></html>' })
    vi.stubGlobal('fetch', fetchMock)
    await run(await loaderScript())
    expect(fetchMock).toHaveBeenCalledWith(location.href, expect.objectContaining({
      headers: { 'x-preview-session': 'tok.sig' },
      cache: 'no-store',
    }))
    expect(document.querySelector('h1')?.textContent).toBe('Draft page')
  })

  it('without a stored token → "session expired", no fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await run(await loaderScript())
    expect(fetchMock).not.toHaveBeenCalled()
    expect(document.querySelector('h1')?.textContent).toMatch(/Preview session expired/)
  })

  it('a network error → "could not be loaded"', async () => {
    sessionStorage.setItem('itsshops_preview', 'tok.sig')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await run(await loaderScript())
    expect(document.querySelector('h1')?.textContent).toBe('Preview could not be loaded')
  })
})
