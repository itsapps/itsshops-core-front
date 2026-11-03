import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchVinofactWines } from '../vinofact'

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
