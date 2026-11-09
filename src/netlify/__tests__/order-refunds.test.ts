import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Stripe from 'stripe'

vi.mock('../services/sanity', () => ({ fetchOrderRevision: vi.fn(), writeOrderRefunds: vi.fn() }))
vi.mock('../services/stripe', () => ({ listRefunds: vi.fn() }))
vi.mock('../utils/logger', () => ({ log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() } }))

import { fetchOrderRevision, writeOrderRefunds } from '../services/sanity'
import { listRefunds } from '../services/stripe'
import { latestRefund, syncOrderRefunds } from '../lib/order-refunds'
import type { OrderRefund } from '../types/checkout'

const revisionMock = vi.mocked(fetchOrderRevision)
const writeMock = vi.mocked(writeOrderRefunds)
const listMock = vi.mocked(listRefunds)

const stripeRefund = (over: Partial<Stripe.Refund> = {}): Stripe.Refund =>
  ({
    id: 're_1',
    object: 'refund',
    amount: 1000,
    created: 1_762_000_000,
    status: 'succeeded',
    metadata: { itsshopsSource: 'studio' },
    reason: null,
    payment_intent: 'pi_1',
    ...over,
  }) as Stripe.Refund

const conflict = () => Object.assign(new Error('Conflict'), { statusCode: 409 })

describe('syncOrderRefunds', () => {
  beforeEach(() => {
    revisionMock.mockReset().mockResolvedValue({ _id: 'order-1', _rev: 'rev1' })
    writeMock.mockReset().mockResolvedValue()
    listMock.mockReset()
  })

  it('maps Stripe refunds, sorted oldest first, with the source from metadata', async () => {
    listMock.mockResolvedValue([
      stripeRefund({ id: 're_3', amount: 1500, created: 300, metadata: {} }),
      stripeRefund({ id: 're_1', amount: 500, created: 100, reason: 'requested_by_customer' }),
      stripeRefund({ id: 're_2', amount: 700, created: 200 }),
    ])
    const refunds = await syncOrderRefunds('pi_1')
    expect(refunds).toEqual([
      {
        _key: 're_1', _type: 'orderRefund', refundId: 're_1', amount: 500,
        createdAt: new Date(100_000).toISOString(), status: 'succeeded', source: 'studio',
        reason: 'requested_by_customer',
      },
      {
        _key: 're_2', _type: 'orderRefund', refundId: 're_2', amount: 700,
        createdAt: new Date(200_000).toISOString(), status: 'succeeded', source: 'studio',
      },
      {
        _key: 're_3', _type: 'orderRefund', refundId: 're_3', amount: 1500,
        createdAt: new Date(300_000).toISOString(), status: 'succeeded', source: 'stripe',
      },
    ])
    expect(writeMock).toHaveBeenCalledWith({ _id: 'order-1', _rev: 'rev1' }, refunds)
  })

  it('the same refunds twice → an identical array', async () => {
    listMock.mockResolvedValue([stripeRefund(), stripeRefund({ id: 're_2', created: 1_762_000_100 })])
    const first = await syncOrderRefunds('pi_1')
    const second = await syncOrderRefunds('pi_1')
    expect(second).toEqual(first)
    expect(writeMock.mock.calls[0][1]).toEqual(writeMock.mock.calls[1][1])
  })

  it('status null → pending; failure_reason → failureReason, absent → no key', async () => {
    listMock.mockResolvedValue([
      stripeRefund({ id: 're_1', created: 1, status: null }),
      stripeRefund({ id: 're_2', created: 2, status: 'failed', failure_reason: 'expired_or_canceled_card' }),
    ])
    const [pending, failed] = (await syncOrderRefunds('pi_1'))!
    expect(pending.status).toBe('pending')
    expect(pending).not.toHaveProperty('failureReason')
    expect(pending).not.toHaveProperty('reason')
    expect(failed).toMatchObject({ status: 'failed', failureReason: 'expired_or_canceled_card' })
  })

  it('writes nothing when the stored refunds already match (fields in another order)', async () => {
    listMock.mockResolvedValue([stripeRefund()])
    revisionMock.mockResolvedValue({
      _id: 'order-1',
      _rev: 'rev1',
      refunds: [{
        status: 'succeeded', source: 'studio', refundId: 're_1', amount: 1000, _type: 'orderRefund',
        _key: 're_1', createdAt: new Date(1_762_000_000 * 1000).toISOString(),
      }],
    })
    expect(await syncOrderRefunds('pi_1')).toHaveLength(1)
    expect(writeMock).not.toHaveBeenCalled()
  })

  it('a revision conflict re-reads revision and Stripe list and writes again', async () => {
    revisionMock
      .mockResolvedValueOnce({ _id: 'order-1', _rev: 'rev1' })
      .mockResolvedValueOnce({ _id: 'order-1', _rev: 'rev2' })
    listMock.mockResolvedValueOnce([stripeRefund()]).mockResolvedValueOnce([stripeRefund(), stripeRefund({ id: 're_2', created: 1_762_000_100 })])
    writeMock.mockRejectedValueOnce(conflict()).mockResolvedValueOnce()
    const refunds = await syncOrderRefunds('pi_1')
    expect(revisionMock).toHaveBeenCalledTimes(2)
    expect(listMock).toHaveBeenCalledTimes(2)
    expect(writeMock).toHaveBeenLastCalledWith({ _id: 'order-1', _rev: 'rev2' }, refunds)
    expect(refunds).toHaveLength(2)
  })

  it('a conflict on the third attempt is thrown', async () => {
    listMock.mockResolvedValue([stripeRefund()])
    const err = conflict()
    writeMock.mockRejectedValue(err)
    await expect(syncOrderRefunds('pi_1')).rejects.toBe(err)
    expect(writeMock).toHaveBeenCalledTimes(3)
  })

  it('other errors are thrown without a retry', async () => {
    listMock.mockRejectedValue(new Error('stripe down'))
    await expect(syncOrderRefunds('pi_1')).rejects.toThrow('stripe down')
    expect(revisionMock).toHaveBeenCalledTimes(1)
  })

  it('no order for the payment → null, nothing listed or written', async () => {
    revisionMock.mockResolvedValue(null)
    expect(await syncOrderRefunds('pi_1')).toBeNull()
    expect(listMock).not.toHaveBeenCalled()
    expect(writeMock).not.toHaveBeenCalled()
  })
})

describe('latestRefund', () => {
  const r = (id: string, createdAt: string, status = 'succeeded'): OrderRefund => ({
    _key: id, _type: 'orderRefund', refundId: id, amount: 100, createdAt, status, source: 'studio',
  })

  it('newest counted refund wins; failed / canceled are skipped', () => {
    expect(latestRefund({
      refunds: [
        r('re_1', '2026-11-01T00:00:00.000Z'),
        r('re_2', '2026-11-03T00:00:00.000Z', 'pending'),
        r('re_3', '2026-11-04T00:00:00.000Z', 'failed'),
        r('re_4', '2026-11-05T00:00:00.000Z', 'canceled'),
      ],
    })?.refundId).toBe('re_2')
  })

  it('no refunds → undefined', () => {
    expect(latestRefund({})).toBeUndefined()
    expect(latestRefund({ refunds: [r('re_1', '2026-11-01T00:00:00.000Z', 'failed')] })).toBeUndefined()
  })
})
