// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { lookupOrderStatus, pollOrderNumber, type OrderStatusLookup } from '../order-status'

const PI = 'pi_3TRUr5ImdKLyyYu027p4gDQp'
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

afterEach(() => vi.unstubAllGlobals())

describe('lookupOrderStatus', () => {
  it.each<[string, () => Promise<Response>, OrderStatusLookup['state']]>([
    ['found', async () => json(200, { orderNumber: '000008' }), 'found'],
    ['no order yet', async () => json(404, { error: { code: 'ORDER_NOT_FOUND' } }), 'pending'],
    ['rate limited', async () => json(429, {}), 'error'],
    ['server error', async () => json(500, {}), 'error'],
    ['network error', async () => { throw new TypeError('offline') }, 'error'],
    ['bad request', async () => json(400, {}), 'unavailable'],
    ['function not wired (HTML 404)', async () => new Response('<html>', { status: 404, headers: { 'content-type': 'text/html' } }), 'unavailable'],
  ])('%s → %s', async (_name, impl, state) => {
    vi.stubGlobal('fetch', vi.fn(impl))
    expect((await lookupOrderStatus(PI)).state).toBe(state)
  })

  it('sends only the PaymentIntent id', async () => {
    const fetchMock = vi.fn(async () => json(200, { orderNumber: '1' }))
    vi.stubGlobal('fetch', fetchMock)
    await lookupOrderStatus(PI)
    expect(fetchMock).toHaveBeenCalledWith(`/api/order/status?payment_intent=${PI}`, expect.anything())
  })

  it('never calls out for an invalid id', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect((await lookupOrderStatus('pi_1_secret_x')).state).toBe('unavailable')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('pollOrderNumber', () => {
  const sleep = vi.fn(async () => {})
  const seq = (...states: OrderStatusLookup[]) => {
    const lookup = vi.fn<typeof lookupOrderStatus>()
    states.forEach(s => lookup.mockResolvedValueOnce(s))
    return lookup
  }

  it('keeps asking while pending/error, returns the number when found', async () => {
    const lookup = seq({ state: 'pending' }, { state: 'error' }, { state: 'found', orderNumber: '000009' })
    expect(await pollOrderNumber(PI, { lookup, sleep })).toBe('000009')
    expect(lookup).toHaveBeenCalledTimes(3)
  })

  it('stops immediately when unavailable', async () => {
    const lookup = seq({ state: 'unavailable' })
    expect(await pollOrderNumber(PI, { lookup, sleep })).toBeNull()
    expect(lookup).toHaveBeenCalledTimes(1)
  })

  it('gives up after 5 attempts', async () => {
    const lookup = vi.fn<typeof lookupOrderStatus>(async () => ({ state: 'pending' }))
    expect(await pollOrderNumber(PI, { lookup, sleep })).toBeNull()
    expect(lookup).toHaveBeenCalledTimes(5)
  })
})
