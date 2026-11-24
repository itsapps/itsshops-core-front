import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Context } from '@netlify/functions'

vi.mock('../services/sanity', () => ({ fetchOrderNumberByPaymentIntent: vi.fn() }))
vi.mock('../utils/logger', () => ({ log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() } }))

import { fetchOrderNumberByPaymentIntent } from '../services/sanity'
import { createOrderStatusHandler } from '../functions/order-status'

const handler = createOrderStatusHandler()
const fetchMock = vi.mocked(fetchOrderNumberByPaymentIntent)
const call = (query: string, method = 'GET') =>
  handler(new Request(`https://shop.example/api/order/status${query}`, { method }), {} as Context)

describe('order-status', () => {
  beforeEach(() => fetchMock.mockReset())

  it('returns only the order number, never cached', async () => {
    fetchMock.mockResolvedValue('000008')
    const res = await call('?payment_intent=pi_3TRUr5ImdKLyyYu027p4gDQp')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ orderNumber: '000008' })
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(fetchMock).toHaveBeenCalledWith('pi_3TRUr5ImdKLyyYu027p4gDQp')
  })

  it('404 while the webhook has not created the order yet', async () => {
    fetchMock.mockResolvedValue(null)
    const res = await call('?payment_intent=pi_3TRUr5ImdKLyyYu027p4gDQp')
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('ORDER_NOT_FOUND')
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('rejects anything that is not a PaymentIntent id, without querying', async () => {
    for (const q of ['', '?payment_intent=', '?payment_intent=pi_1', '?payment_intent=order-123',
      '?payment_intent=pi_abc"]{orderNumber}', '?payment_intent=pi_3TRUr5ImdKLyyYu0_secret_x']) {
      expect((await call(q)).status).toBe(400)
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('only allows GET', async () => {
    expect((await call('?payment_intent=pi_3TRUr5ImdKLyyYu027p4gDQp', 'POST')).status).toBe(405)
  })

  it('500 without details when the lookup fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('sanity down'))
    const res = await call('?payment_intent=pi_3TRUr5ImdKLyyYu027p4gDQp')
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('sanity down')
  })
})
