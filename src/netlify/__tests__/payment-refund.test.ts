import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Context } from '@netlify/functions'

const { create } = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('stripe', () => ({
  // a regular function: the service calls it with `new`
  default: vi.fn(function Stripe() {
    return { refunds: { create } }
  }),
}))
vi.mock('../lib/order-refunds', () => ({ syncOrderRefunds: vi.fn() }))
vi.mock('../utils/logger', () => ({ log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() } }))

import { syncOrderRefunds } from '../lib/order-refunds'
import { log } from '../utils/logger'
import { createRefundHandler } from '../functions/payment-refund'

const SECRET = 'test-secret'
const handler = createRefundHandler()
const syncMock = vi.mocked(syncOrderRefunds)
const call = (body: unknown) =>
  handler(
    new Request('https://shop.example/api/payment/refund', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-server-secret': SECRET },
      body: JSON.stringify(body),
    }),
    {} as Context,
  )

describe('payment-refund', () => {
  beforeEach(() => {
    vi.stubEnv('STRIPE_SECRET_API_KEY', 'sk_test')
    vi.stubEnv('SERVER_FUNCTIONS_SECRET', SECRET)
    create.mockReset().mockResolvedValue({ id: 're_1', status: 'succeeded', amount: 1250 })
    syncMock.mockReset().mockResolvedValue([])
    vi.mocked(log.error).mockClear()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('tags the refund as a Studio refund (partial and full)', async () => {
    await call({ paymentIntentId: 'pi_1', amount: 1250 })
    expect(create).toHaveBeenLastCalledWith({
      payment_intent: 'pi_1',
      amount: 1250,
      metadata: { itsshopsSource: 'studio' },
    })
    await call({ paymentIntentId: 'pi_1' })
    expect(create).toHaveBeenLastCalledWith({ payment_intent: 'pi_1', metadata: { itsshopsSource: 'studio' } })
  })

  it('syncs the order refunds after the refund was created', async () => {
    const res = await call({ paymentIntentId: 'pi_1', amount: 1250 })
    expect(res.status).toBe(200)
    expect(syncMock).toHaveBeenCalledWith('pi_1')
    expect(create.mock.invocationCallOrder[0]).toBeLessThan(syncMock.mock.invocationCallOrder[0])
    expect(await res.json()).toEqual({ refundId: 're_1', status: 'succeeded', amount: 1250 })
  })

  it('a failed sync is logged, the refund still answers 200', async () => {
    syncMock.mockRejectedValue(new Error('conflict'))
    const res = await call({ paymentIntentId: 'pi_1' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ refundId: 're_1', status: 'succeeded', amount: 1250 })
    expect(log.error).toHaveBeenCalledWith('Refund sync failed', expect.objectContaining({ paymentIntentId: 'pi_1' }))
  })

  it('a failed refund → 502, no sync', async () => {
    create.mockRejectedValue(new Error('charge already refunded'))
    const res = await call({ paymentIntentId: 'pi_1' })
    expect(res.status).toBe(502)
    expect(syncMock).not.toHaveBeenCalled()
  })
})
