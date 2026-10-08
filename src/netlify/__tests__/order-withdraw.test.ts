import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Context } from '@netlify/functions'

vi.mock('../services/sanity', () => ({
  fetchOrderByNumber: vi.fn(),
  findOpenWithdrawal: vi.fn(),
  findOpenUnmatchedWithdrawal: vi.fn(),
  createWithdrawalIfNotExists: vi.fn(),
  countWithdrawalIds: vi.fn(),
}))
vi.mock('../lib/order-withdraw-notifier', () => ({ sendWithdrawalNotifications: vi.fn() }))
vi.mock('../utils/logger', () => ({ log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() } }))

import * as sanity from '../services/sanity'
import { sendWithdrawalNotifications } from '../lib/order-withdraw-notifier'
import { createOrderWithdrawHandler } from '../functions/order-withdraw'
import type { OrderWithdrawalLookup, WithdrawalRecord } from '../services/sanity'

const handler = createOrderWithdrawHandler()
const m = {
  fetchOrder: vi.mocked(sanity.fetchOrderByNumber),
  findOpen: vi.mocked(sanity.findOpenWithdrawal),
  findUnmatched: vi.mocked(sanity.findOpenUnmatchedWithdrawal),
  create: vi.mocked(sanity.createWithdrawalIfNotExists),
  count: vi.mocked(sanity.countWithdrawalIds),
  notify: vi.mocked(sendWithdrawalNotifications),
}

const order: OrderWithdrawalLookup = {
  _id: 'order-abc',
  orderNumber: '000042',
  createdAt: '2026-10-01T10:00:00Z',
  status: 'shipped',
  customer: { contactEmail: 'Anna@Example.com', locale: 'de', name: 'Anna Muster' },
}

const valid = { name: 'Anna Muster', orderNumber: '000042', email: 'anna@example.com', reason: 'Zu viel' }

const call = (body: unknown) =>
  handler(
    new Request('https://shop.example/api/order/withdraw', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-locale': 'de' },
      body: JSON.stringify(body),
    }),
    {} as Context,
  )

const stored = (over: Partial<WithdrawalRecord> = {}): WithdrawalRecord => ({
  _id: 'withdrawal-order-abc-0',
  status: 'received',
  declaredAt: '2026-10-08T09:00:00.000Z',
  name: 'Anna Muster',
  email: 'anna@example.com',
  orderNumber: '000042',
  locale: 'de',
  reason: 'Zu viel',
  order,
  ...over,
})

describe('order-withdraw', () => {
  beforeEach(() => {
    vi.stubEnv('SKIP_AUTH_EMAILS', '')
    for (const fn of Object.values(m)) fn.mockReset()
    m.count.mockResolvedValue(0)
    m.findOpen.mockResolvedValue(null)
    m.findUnmatched.mockResolvedValue(null)
    m.notify.mockResolvedValue({ to: 'anna@example.com' })
  })
  afterEach(() => vi.unstubAllEnvs())

  it('requires name, order number and email', async () => {
    const res = await call({ email: 'x' })
    expect(res.status).toBe(400)
    const { error } = await res.json()
    expect(Object.keys(error.details).sort()).toEqual(['email', 'name', 'orderNumber'])
    expect(m.create).not.toHaveBeenCalled()
  })

  it('rejects URL-like names', async () => {
    for (const name of ['http://spam.example', 'Visit www.spam', 'spam.example.com', 'Max shop.at']) {
      const res = await call({ ...valid, name })
      expect(res.status, name).toBe(400)
      expect((await res.json()).error.details.name).toBeTruthy()
    }
  })

  it('accepts ordinary names', async () => {
    m.fetchOrder.mockResolvedValue(order)
    m.create.mockResolvedValue({ record: stored(), created: true })
    for (const name of ['Dr. Anna Müller-Lüdenscheidt', 'J.R.R. Tolkien', "O'Brien"]) {
      expect((await call({ ...valid, name })).status, name).toBe(200)
    }
  })

  it('matched → stores the record linked to the order and mails consumer + shop', async () => {
    m.fetchOrder.mockResolvedValue(order)
    m.create.mockResolvedValue({ record: stored(), created: true })
    const res = await call(valid)
    expect(res.status).toBe(200)
    expect((await res.json()).redirectUrl).toBe('/de/widerruf/erledigt/')
    expect(m.create).toHaveBeenCalledWith(expect.objectContaining({
      _id: 'withdrawal-order-abc-0',
      orderId: 'order-abc',
      name: 'Anna Muster',
      email: 'anna@example.com',
      orderNumber: '000042',
      reason: 'Zu viel',
    }))
    expect(m.notify).toHaveBeenCalledWith(stored(), expect.objectContaining({ audience: 'both', emailMismatch: false }))
  })

  it('unmatched → stores without order, same response, flagged shop mail', async () => {
    m.fetchOrder.mockResolvedValue(null)
    const record = stored({ status: 'unmatched', order: null, orderNumber: '99999' })
    m.create.mockResolvedValue({ record, created: true })
    const matchedRes = await (async () => {
      m.fetchOrder.mockResolvedValueOnce(order)
      m.create.mockResolvedValueOnce({ record: stored(), created: true })
      return (await call(valid)).json()
    })()
    const res = await call({ ...valid, orderNumber: '99999' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(matchedRes)
    const input = m.create.mock.calls[1][0]
    expect(input.orderId).toBeNull()
    expect(input._id).toMatch(/^withdrawal-u-[0-9a-f]{20}-0$/)
    expect(m.notify).toHaveBeenLastCalledWith(record, expect.objectContaining({ audience: 'both', emailMismatch: false }))
  })

  it('order exists but the email differs → unmatched with the shop-only hint', async () => {
    m.fetchOrder.mockResolvedValue(order)
    m.create.mockResolvedValue({ record: stored({ status: 'unmatched', order: null }), created: true })
    await call({ ...valid, email: 'someone@else.com' })
    expect(m.create.mock.calls[0][0].orderId).toBeNull()
    expect(m.findOpen).not.toHaveBeenCalled()
    expect(m.notify.mock.calls[0][1]).toMatchObject({ emailMismatch: true })
  })

  it('repeat submission (matched) → receipt again, no new record, no shop mail', async () => {
    m.fetchOrder.mockResolvedValue(order)
    const existing = stored({ declaredAt: '2026-10-05T08:00:00.000Z' })
    m.findOpen.mockResolvedValue(existing)
    expect((await call(valid)).status).toBe(200)
    expect(m.create).not.toHaveBeenCalled()
    expect(m.notify).toHaveBeenCalledWith(existing, expect.objectContaining({ audience: 'customer' }))
  })

  it('repeat submission (unmatched, same email + number) → deduped on the normalized email', async () => {
    m.fetchOrder.mockResolvedValue(null)
    const existing = stored({ status: 'unmatched', order: null })
    m.findUnmatched.mockResolvedValue(existing)
    await call({ ...valid, email: '  ANNA@example.com ', orderNumber: ' 000042 ' })
    expect(m.findUnmatched).toHaveBeenCalledWith('anna@example.com', '000042')
    expect(m.create).not.toHaveBeenCalled()
    expect(m.notify).toHaveBeenCalledWith(existing, expect.objectContaining({ audience: 'customer' }))
  })

  it('double submit race → createIfNotExists hit an existing record → receipt only', async () => {
    m.fetchOrder.mockResolvedValue(order)
    m.create.mockResolvedValue({ record: stored(), created: false })
    await call(valid)
    expect(m.notify.mock.calls[0][1]).toMatchObject({ audience: 'customer' })
  })

  it('honeypot filled → success, nothing stored or sent', async () => {
    const res = await call({ ...valid, website: 'http://bot' })
    expect(res.status).toBe(200)
    expect(m.fetchOrder).not.toHaveBeenCalled()
    expect(m.create).not.toHaveBeenCalled()
    expect(m.notify).not.toHaveBeenCalled()
  })

  it('a mail failure does not fail the request', async () => {
    m.fetchOrder.mockResolvedValue(order)
    m.create.mockResolvedValue({ record: stored(), created: true })
    m.notify.mockRejectedValue(new Error('mailgun down'))
    expect((await call(valid)).status).toBe(200)
  })

  it('a store failure is an error', async () => {
    m.fetchOrder.mockResolvedValue(order)
    m.create.mockRejectedValue(new Error('sanity down'))
    expect((await call(valid)).status).toBe(500)
  })
})
