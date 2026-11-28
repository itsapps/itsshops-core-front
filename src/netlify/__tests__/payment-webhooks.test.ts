import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Context } from '@netlify/functions'

vi.mock('../services/stripe', () => ({ constructWebhookEvent: vi.fn(), retrievePaymentIntentWithCharge: vi.fn() }))
vi.mock('../services/sanity', () => ({
  updateOrderPaymentStatus: vi.fn(),
  fetchOrderMeta: vi.fn(),
  commitOrderTransaction: vi.fn(),
  findOrderByPaymentIntent: vi.fn(),
  getNextInvoiceNumber: vi.fn(),
}))
vi.mock('../lib/order-refunds', () => ({ syncOrderRefunds: vi.fn() }))
vi.mock('../lib/order-notifier', () => ({ sendOrderNotification: vi.fn(), sendShopOrderNotification: vi.fn() }))
vi.mock('../utils/logger', () => ({ log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() } }))

import { constructWebhookEvent } from '../services/stripe'
import { updateOrderPaymentStatus } from '../services/sanity'
import { syncOrderRefunds } from '../lib/order-refunds'
import { log } from '../utils/logger'
import { createWebhookHandler } from '../functions/payment-webhooks'

const handler = createWebhookHandler()
const eventMock = vi.mocked(constructWebhookEvent)
const syncMock = vi.mocked(syncOrderRefunds)
const statusMock = vi.mocked(updateOrderPaymentStatus)

const deliver = (type: string, object: unknown) => {
  eventMock.mockReturnValue({ type, data: { object } } as never)
  return handler(
    new Request('https://shop.example/api/payment/webhooks', {
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=x' },
      body: '{}',
    }),
    {} as Context,
  )
}

describe('payment-webhooks refunds', () => {
  beforeEach(() => {
    eventMock.mockReset()
    syncMock.mockReset().mockResolvedValue([])
    statusMock.mockReset().mockResolvedValue()
    vi.mocked(log.error).mockClear()
  })

  it('charge.refunded syncs the refunds before updating the payment status', async () => {
    const res = await deliver('charge.refunded', { id: 'ch_1', payment_intent: 'pi_1', amount: 3000, amount_refunded: 1000 })
    expect(res.status).toBe(200)
    expect(syncMock).toHaveBeenCalledWith('pi_1')
    expect(statusMock).toHaveBeenCalledWith('pi_1', 'partiallyRefunded')
    expect(syncMock.mock.invocationCallOrder[0]).toBeLessThan(statusMock.mock.invocationCallOrder[0])
  })

  it('charge.refunded: a sync throw → 400, no status update (Stripe retries)', async () => {
    syncMock.mockRejectedValue(Object.assign(new Error('Conflict'), { statusCode: 409 }))
    const res = await deliver('charge.refunded', { id: 'ch_1', payment_intent: 'pi_1', amount: 3000, amount_refunded: 3000 })
    expect(res.status).toBe(400)
    expect(statusMock).not.toHaveBeenCalled()
  })

  it('refund.updated syncs the refunds of its payment (id or expanded object), no status update', async () => {
    await deliver('refund.updated', { id: 're_1', payment_intent: 'pi_1', status: 'succeeded' })
    expect(syncMock).toHaveBeenLastCalledWith('pi_1')
    await deliver('refund.updated', { id: 're_1', payment_intent: { id: 'pi_2' }, status: 'succeeded' })
    expect(syncMock).toHaveBeenLastCalledWith('pi_2')
    expect(statusMock).not.toHaveBeenCalled()
    expect(log.error).not.toHaveBeenCalled()
  })

  it('refund.updated with status failed logs the failure reason', async () => {
    const res = await deliver('refund.updated', {
      id: 're_1', payment_intent: 'pi_1', status: 'failed', failure_reason: 'expired_or_canceled_card',
    })
    expect(res.status).toBe(200)
    expect(log.error).toHaveBeenCalledWith('Refund failed asynchronously', {
      paymentIntentId: 'pi_1', refundId: 're_1', failureReason: 'expired_or_canceled_card',
    })
  })

  it('refund.updated without payment_intent → 200, no sync', async () => {
    const res = await deliver('refund.updated', { id: 're_1', payment_intent: null, status: 'succeeded' })
    expect(res.status).toBe(200)
    expect(syncMock).not.toHaveBeenCalled()
  })

  it('refund.updated: a sync throw → 400', async () => {
    syncMock.mockRejectedValue(new Error('sanity down'))
    const res = await deliver('refund.updated', { id: 're_1', payment_intent: 'pi_1', status: 'succeeded' })
    expect(res.status).toBe(400)
  })

  it('an unhandled event type → 200 without calls', async () => {
    const res = await deliver('refund.created', { id: 're_1', payment_intent: 'pi_1' })
    expect(res.status).toBe(200)
    expect(syncMock).not.toHaveBeenCalled()
    expect(statusMock).not.toHaveBeenCalled()
  })
})

describe('payment-webhooks — order creation, discount increments', () => {
  const sanity = async () => await import('../services/sanity')
  const orderMeta = (extra: Record<string, unknown>) => ({
    _id: 'orderMeta-1', _type: 'orderMeta', paymentIntentId: 'pi_9',
    orderItems: [{ _key: 'l1', _type: 'orderItem', kind: 'wine', variantId: 'v1', productId: 'p1', title: 'W', quantity: 1, price: 2000, vatRate: 13, vatAmount: 230, packed: false }],
    customer: { _type: 'orderCustomer', locale: 'de', contactEmail: 'a@b.at', billingAddress: {} },
    totals: { _type: 'orderTotals', subtotal: 2000, shipping: 0, discount: 0, grandTotal: 2000, totalVat: 230, vatBreakdown: [], currency: 'EUR' },
    fulfillment: { _type: 'fulfillment', methodTitle: 'DPD', methodType: 'delivery', shippingCost: 0 },
    ...extra,
  })

  beforeEach(async () => {
    const s = await sanity()
    vi.mocked(s.findOrderByPaymentIntent).mockReset().mockResolvedValue(null)
    vi.mocked(s.getNextInvoiceNumber).mockReset().mockResolvedValue({ invoiceNumber: 7, orderNumberPrefix: null, invoiceNumberPrefix: null })
    vi.mocked(s.commitOrderTransaction).mockReset().mockResolvedValue({ _id: 'order-1' })
    vi.mocked(s.fetchOrderMeta).mockReset()
  })

  const succeed = () => deliver('payment_intent.succeeded', { id: 'pi_9', created: 1, metadata: { orderMetaId: 'orderMeta-1' } })

  it('increments every applied discount with a ref, once per id', async () => {
    const s = await sanity()
    vi.mocked(s.fetchOrderMeta).mockResolvedValue(orderMeta({
      appliedDiscounts: [
        { _key: 'a', _type: 'appliedDiscount', discountRef: { _type: 'reference', _ref: 'discount-c1', _weak: true }, title: 'C', trigger: 'code', target: 'order', valueType: 'percent', amount: 0 },
        { _key: 'b', _type: 'appliedDiscount', title: 'Versandkostenfrei durch Produkt', trigger: 'automatic', target: 'shipping', valueType: 'free' },
      ],
    }) as never)
    await succeed()
    expect(vi.mocked(s.commitOrderTransaction).mock.calls[0][0].discountIncrements).toEqual([{ discountId: 'discount-c1', by: 1 }])
  })
})
