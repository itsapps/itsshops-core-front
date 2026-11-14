import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchVinofactWines, vinofactEndpoint } from '../vinofact'
import { resolveLocaleMaps } from '../resolve/variants'

const config = {
  enabled: true,
  fields: ['year'] as any,
  integration: { endpoint: 'https://vinofact.test/graphql', accessToken: 't', profileSlug: 'p' },
}
const ok = (wines: any[]) => new Response(JSON.stringify({ data: { wines } }), { status: 200 })
const status = (s: number) => new Response('nope', { status: s })
const run = () => fetchVinofactWines(config, ['1', '2'], ['de'], { retryDelayMs: 0 })

function stubFetch(...results: Array<Response | Error>) {
  const fn = vi.fn()
  for (const r of results) r instanceof Error ? fn.mockRejectedValueOnce(r) : fn.mockResolvedValueOnce(r)
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('fetchVinofactWines', () => {
  it('returns wines keyed by id', async () => {
    stubFetch(ok([{ id: 1 }, { id: 2 }]))
    const map = await run()
    expect([...map.keys()]).toEqual(['1', '2'])
  })

  it('retries once after a network error', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetch = stubFetch(new TypeError('fetch failed'), ok([{ id: 1 }, { id: 2 }]))
    expect((await run()).size).toBe(2)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('retries once after a 5xx and then fails the build', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetch = stubFetch(status(503), status(502))
    await expect(run()).rejects.toThrow(/after 2 attempts[\s\S]*status 502/)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('fails immediately on 401 without retrying', async () => {
    const fetch = stubFetch(status(401))
    await expect(run()).rejects.toThrow(/API token/)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('fails on GraphQL errors', async () => {
    stubFetch(new Response(JSON.stringify({ errors: [{ message: 'bad field' }] }), { status: 200 }))
    await expect(run()).rejects.toThrow(/GraphQL error: bad field/)
  })

  it('warns (does not fail) when some wine IDs are missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    stubFetch(ok([{ id: 1 }]))
    expect((await run()).size).toBe(1)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('1 of 2 wine ID(s): 2'))
  })
})

describe('VinoFact dated API', () => {
  it('builds the dated endpoint from the origin only', () => {
    expect(vinofactEndpoint('https://www.vinofact.com/api/v1/graphql')).toBe('https://www.vinofact.com/api/graphql/v2026-11-14/')
    expect(vinofactEndpoint('http://192.168.178.48:8000/api/v1/graphql')).toBe('http://192.168.178.48:8000/api/graphql/v2026-11-14/')
    expect(vinofactEndpoint('')).toBe('https://www.vinofact.com/api/graphql/v2026-11-14/')
    expect(vinofactEndpoint(undefined)).toBe('https://www.vinofact.com/api/graphql/v2026-11-14/')
    expect(() => vinofactEndpoint('not a url')).toThrow()
  })

  it('requests the dated endpoint of the configured origin', async () => {
    const fetch = stubFetch(ok([{ id: 1 }, { id: 2 }]))
    await run()
    expect(fetch.mock.calls[0][0]).toBe('https://vinofact.test/api/graphql/v2026-11-14/')
  })

  it('defaults to www.vinofact.com without an endpoint', async () => {
    const fetch = stubFetch(ok([]))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await fetchVinofactWines({ enabled: true, integration: { accessToken: 't', profileSlug: 'p' } }, ['1'], ['de'])
    expect(fetch.mock.calls[0][0]).toBe('https://www.vinofact.com/api/graphql/v2026-11-14/')
  })

  it('selects image alts per locale', async () => {
    const fetch = stubFetch(ok([]))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await fetchVinofactWines({ ...config, fields: ['bottleImage', 'certificates'] }, ['1'], ['de'])
    const { query } = JSON.parse(fetch.mock.calls[0][1].body)
    expect(query).toContain('bottleImage { url alt { de } }')
    expect(query).toContain('image { url alt { de } }')
  })

  it('fails without a request on an invalid endpoint', async () => {
    const fetch = stubFetch(ok([]))
    await expect(fetchVinofactWines(
      { ...config, integration: { ...config.integration, endpoint: 'not a url' } }, ['1'], ['de'],
    )).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('resolveLocaleMaps', () => {
  const data = { bottleImage: { url: 'u', alt: { de: 'x', en: null } } }

  it('falls back to the default locale', () => {
    expect(resolveLocaleMaps(data, 'en', 'de')).toEqual({ bottleImage: { url: 'u', alt: 'x' } })
    expect(resolveLocaleMaps(data, 'de', 'de')).toEqual({ bottleImage: { url: 'u', alt: 'x' } })
  })

  it('gives null when no locale has a value', () => {
    expect(resolveLocaleMaps({ bottleImage: { url: 'u', alt: { de: null, en: null } } }, 'en', 'de'))
      .toEqual({ bottleImage: { url: 'u', alt: null } })
  })

  it('recurses into arrays', () => {
    expect(resolveLocaleMaps({ certificates: [{ image: { url: 'u', alt: { de: 'Bio' } } }] }, 'de', 'de'))
      .toEqual({ certificates: [{ image: { url: 'u', alt: 'Bio' } }] })
  })
})
