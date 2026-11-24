import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Context } from '@netlify/functions'

const { create, list } = vi.hoisted(() => ({ create: vi.fn(), list: vi.fn() }))
vi.mock('stripe', () => ({
  // a regular function: the service calls it with `new`
  default: vi.fn(function Stripe() {
    return { refunds: { create, list } }
  }),
}))
vi.mock('../services/sanity', () => ({ fetchOrderById: vi.fn() }))
vi.mock('../lib/order-refunds', () => ({ syncOrderRefunds: vi.fn() }))
vi.mock('../utils/logger', () => ({ log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() } }))

import { fetchOrderById } from '../services/sanity'
import { syncOrderRefunds } from '../lib/order-refunds'
import { log } from '../utils/logger'
import { createRefundHandler } from '../functions/payment-refund'

const SECRET = 'test-secret'
const handler = createRefundHandler()
const syncMock = vi.mocked(syncOrderRefunds)
const fetchOrderMock = vi.mocked(fetchOrderById)
const call = (body: unknown, secret = SECRET) =>
  handler(
    new Request('https://shop.example/api/payment/refund', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-server-secret': secret },
      body: JSON.stringify(body),
    }),
    {} as Context,
  )
const order = (fields: Record<string, unknown> = {}) =>
  ({ _id: 'order-1', _type: 'order', paymentIntentId: 'pi_1', ...fields }) as never
const refundResult = (headers: Record<string, string> = {}) => ({
  id: 're_1',
  status: 'succeeded',
  amount: 1250,
  lastResponse: { headers, requestId: 'req_1', statusCode: 200 },
})

describe('payment-refund', () => {
  beforeEach(() => {
    vi.stubEnv('STRIPE_SECRET_API_KEY', 'sk_test')
    vi.stubEnv('SERVER_FUNCTIONS_SECRET', SECRET)
    create.mockReset().mockResolvedValue(refundResult())
    list.mockReset().mockResolvedValue({ data: [] })
    fetchOrderMock.mockReset().mockResolvedValue(order())
    syncMock.mockReset().mockResolvedValue([])
    vi.mocked(log.error).mockClear()
    vi.mocked(log.warn).mockClear()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('wrong secret → 401, nothing loaded', async () => {
    const res = await call({ orderId: 'order-1' }, 'nope')
    expect(res.status).toBe(401)
    expect(fetchOrderMock).not.toHaveBeenCalled()
  })

  it('missing or non-string orderId → 400 (the old paymentIntentId body included)', async () => {
    expect((await call({ paymentIntentId: 'pi_1' })).status).toBe(400)
    expect((await call({ orderId: 42 })).status).toBe(400)
    expect(create).not.toHaveBeenCalled()
  })

  it('unknown order → 404 with a fixed message', async () => {
    fetchOrderMock.mockResolvedValue(null)
    const res = await call({ orderId: 'nope<b>' })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toEqual({ code: 'ORDER_NOT_FOUND', message: 'Order not found' })
    expect(create).not.toHaveBeenCalled()
  })

  it('a non-order document → 404', async () => {
    fetchOrderMock.mockResolvedValue(order({ _type: 'product' }))
    expect((await call({ orderId: 'product-1' })).status).toBe(404)
    expect(create).not.toHaveBeenCalled()
  })

  it('a drafts. id → 404 without loading it', async () => {
    expect((await call({ orderId: 'drafts.order-1' })).status).toBe(404)
    expect(fetchOrderMock).not.toHaveBeenCalled()
  })

  it('an order without paymentIntentId → 404', async () => {
    fetchOrderMock.mockResolvedValue(order({ paymentIntentId: undefined }))
    expect((await call({ orderId: 'order-1' })).status).toBe(404)
    expect(create).not.toHaveBeenCalled()
  })

  it("refunds the order's PaymentIntent with a derived key, tagged as a Studio refund", async () => {
    await call({ orderId: 'order-1', amount: 1250 })
    expect(list).toHaveBeenCalledWith({ payment_intent: 'pi_1', limit: 100 })
    expect(create).toHaveBeenLastCalledWith(
      { payment_intent: 'pi_1', amount: 1250, metadata: { itsshopsSource: 'studio' } },
      { idempotencyKey: 'refund:order-1:0:1250' },
    )
    await call({ orderId: 'order-1' })
    expect(create).toHaveBeenLastCalledWith(
      { payment_intent: 'pi_1', metadata: { itsshopsSource: 'studio' } },
      { idempotencyKey: 'refund:order-1:0:full' },
    )
  })

  it('the same request twice → the same key; one more refund in the list → a new key', async () => {
    await call({ orderId: 'order-1', amount: 500 })
    await call({ orderId: 'order-1', amount: 500 })
    expect(create.mock.calls[0][1]).toEqual(create.mock.calls[1][1])
    list.mockResolvedValue({ data: [{ id: 're_0', status: 'failed' }] })
    await call({ orderId: 'order-1', amount: 500 })
    expect(create.mock.calls[2][1]).toEqual({ idempotencyKey: 'refund:order-1:1:500' })
  })

  it('an idempotent replay → 409, sync still runs', async () => {
    create.mockResolvedValue(refundResult({ 'idempotent-replayed': 'true' }))
    const res = await call({ orderId: 'order-1', amount: 1250 })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toEqual({ code: 'REFUND_CONFLICT', message: 'Refund already processed' })
    expect(syncMock).toHaveBeenCalledWith('pi_1')
  })

  it('expectedRefunded matches Stripe (failed/canceled not counted) → refunds', async () => {
    list.mockResolvedValue({
      data: [
        { id: 're_a', amount: 500, status: 'succeeded' },
        { id: 're_b', amount: 300, status: 'pending' },
        { id: 're_c', amount: 999, status: 'failed' },
        { id: 're_d', amount: 999, status: 'canceled' },
      ],
    })
    const res = await call({ orderId: 'order-1', amount: 200, expectedRefunded: 800 })
    expect(res.status).toBe(200)
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('a refund made meanwhile (other tab) → 409 REFUND_CONFLICT, nothing refunded, no sync', async () => {
    // tab 2 opened with 0 refunded; tab 1's refund already exists in Stripe
    list.mockResolvedValue({ data: [{ id: 're_tab1', amount: 200, status: 'succeeded' }] })
    const res = await call({ orderId: 'order-1', amount: 200, expectedRefunded: 0 })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toEqual({ code: 'REFUND_CONFLICT', message: 'The order was refunded meanwhile' })
    expect(create).not.toHaveBeenCalled()
    expect(syncMock).not.toHaveBeenCalled()
  })

  it('without expectedRefunded no check (other callers)', async () => {
    list.mockResolvedValue({ data: [{ id: 're_x', amount: 200, status: 'succeeded' }] })
    expect((await call({ orderId: 'order-1', amount: 200 })).status).toBe(200)
  })

  it('an invalid expectedRefunded → 400', async () => {
    expect((await call({ orderId: 'order-1', expectedRefunded: -1 })).status).toBe(400)
    expect((await call({ orderId: 'order-1', expectedRefunded: 1.5 })).status).toBe(400)
    expect(create).not.toHaveBeenCalled()
  })

  it('syncs the order refunds after the refund was created', async () => {
    const res = await call({ orderId: 'order-1', amount: 1250 })
    expect(res.status).toBe(200)
    expect(syncMock).toHaveBeenCalledWith('pi_1')
    expect(create.mock.invocationCallOrder[0]).toBeLessThan(syncMock.mock.invocationCallOrder[0])
    expect(await res.json()).toEqual({ refundId: 're_1', status: 'succeeded', amount: 1250 })
  })

  it('a failed sync is logged, the refund still answers 200', async () => {
    syncMock.mockRejectedValue(new Error('conflict'))
    const res = await call({ orderId: 'order-1' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ refundId: 're_1', status: 'succeeded', amount: 1250 })
    expect(log.error).toHaveBeenCalledWith('Refund sync failed', expect.objectContaining({ paymentIntentId: 'pi_1' }))
  })

  it('a failed refund → 502, no sync', async () => {
    create.mockRejectedValue(new Error('charge already refunded'))
    const res = await call({ orderId: 'order-1' })
    expect(res.status).toBe(502)
    expect(syncMock).not.toHaveBeenCalled()
  })

  it('a failed order/refund lookup → 502, no refund', async () => {
    list.mockRejectedValue(new Error('stripe down'))
    const res = await call({ orderId: 'order-1' })
    expect(res.status).toBe(502)
    expect(create).not.toHaveBeenCalled()
  })
})
