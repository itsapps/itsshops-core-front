import { describe, it, expect, vi, beforeEach } from 'vitest'

// A fake Sanity client: `fetch` answers the order lookup, `patch` records what is set.
const client = vi.hoisted(() => {
  const commit = vi.fn(async () => ({}))
  const append = vi.fn(() => ({ commit }))
  const set = vi.fn(() => ({ append }))
  return { fetch: vi.fn(), patch: vi.fn(() => ({ set })), set, append, commit }
})
vi.mock('@sanity/client', () => ({ createClient: () => client }))
vi.mock('../utils/logger', () => ({ log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() } }))

import { updateOrderPaymentStatus } from '../services/sanity'

describe('updateOrderPaymentStatus — full refund auto-cancels a not-handed-over order', () => {
  beforeEach(() => {
    process.env.SANITY_PROJECT_ID = 'p'
    process.env.SANITY_DATASET = 'd'
    process.env.SANITY_TOKEN = 't'
    client.fetch.mockReset()
    client.set.mockClear()
  })
  const run = async (status: string, methodType?: string) => {
    client.fetch.mockResolvedValue({ _id: 'o1', status, methodType })
    await updateOrderPaymentStatus('pi_1', 'refunded')
    return (client.set.mock.calls.at(-1) as unknown[])[0]
  }

  it('pickup "ready for pickup" (shipped) → canceled', async () => {
    expect(await run('shipped', 'pickup')).toEqual({ paymentStatus: 'refunded', status: 'canceled' })
  })
  it('delivery shipped → only refunded', async () => {
    expect(await run('shipped', 'delivery')).toEqual({ paymentStatus: 'refunded' })
  })
  it('pickup collected (delivered) → only refunded', async () => {
    expect(await run('delivered', 'pickup')).toEqual({ paymentStatus: 'refunded' })
  })
  it('created / processing → canceled as before; canceled stays as is', async () => {
    expect(await run('processing')).toEqual({ paymentStatus: 'refunded', status: 'canceled' })
    expect(await run('canceled', 'pickup')).toEqual({ paymentStatus: 'refunded' })
  })
})
