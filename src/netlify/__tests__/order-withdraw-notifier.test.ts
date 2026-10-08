import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../services/sanity', () => ({ fetchEmailSettings: vi.fn() }))
vi.mock('../services/email', () => ({ sendMail: vi.fn() }))

import { buildWithdrawalMails } from '../lib/order-withdraw-notifier'
import type { WithdrawalRecord } from '../services/sanity'
import type { EmailContext, EmailShopSettings } from '../templates/email/types'
import { serverT } from '../utils/i18n'

const settings: EmailShopSettings = {
  shopName: 'Weingut Test',
  senderName: 'Weingut Test',
  senderEmail: 'noreply@shop.example',
  baseUrl: 'https://shop.example',
  billingAddress: { line1: 'Hauptstraße 1', zip: '3550', city: 'Langenlois', country: 'AT' },
  bankAccount: null,
  orderNumberPrefix: null,
  invoiceNumberPrefix: null,
  returnShippingBorneBy: 'customer',
  shopNotificationEmail: 'orders@shop.example',
}

const ctx = (over: Partial<EmailShopSettings> = {}): EmailContext => ({
  locale: 'de',
  t: (key, params) => serverT('de', key, params),
  formatPrice: (c) => `${c / 100} €`,
  settings: { ...settings, ...over },
})

const matched: WithdrawalRecord = {
  _id: 'w1',
  status: 'received',
  // 09:15 UTC = 11:15 in Vienna (CEST)
  declaredAt: '2026-10-08T09:15:00.000Z',
  name: 'Anna Muster',
  email: 'anna@example.com',
  orderNumber: '000042',
  locale: 'de',
  reason: 'Falsche Rebsorte',
  order: {
    _id: 'o1',
    orderNumber: '000042',
    createdAt: '2026-10-01T10:00:00Z',
    status: 'shipped',
    customer: { contactEmail: 'anna@example.com', locale: 'de', name: 'Anna Muster' },
  },
}

describe('withdrawal mails', () => {
  beforeEach(() => { vi.stubEnv('SHOP_TIMEZONE', ''); vi.stubEnv('SHOP_FORMALITY', '') })
  afterEach(() => vi.unstubAllEnvs())

  it('receipt repeats the submission with date and time from the record', () => {
    const { customer } = buildWithdrawalMails(matched, ctx())
    expect(customer.to).toBe('anna@example.com')
    expect(customer.text).toContain('Name: Anna Muster')
    expect(customer.text).toContain('Bestellnummer: 000042')
    expect(customer.text).toContain('Grund / Hinweis: Falsche Rebsorte')
    expect(customer.text).toContain('8. Oktober 2026')
    expect(customer.text).toContain('11:15')
    expect(customer.text).toContain('Bitte senden Sie die Ware')
  })

  it('shop notification goes to shopNotificationEmail, falling back to the sender', () => {
    expect(buildWithdrawalMails(matched, ctx()).shop.to).toBe('orders@shop.example')
    expect(buildWithdrawalMails(matched, ctx({ shopNotificationEmail: '' })).shop.to).toBe('noreply@shop.example')
  })

  it('unmatched receipt: to the submitted email, without the reason, says it will be checked', () => {
    const record: WithdrawalRecord = { ...matched, status: 'unmatched', order: null, email: 'x@typed.example' }
    const { customer, shop } = buildWithdrawalMails(record, ctx(), { emailMismatch: true })
    expect(customer.to).toBe('x@typed.example')
    expect(customer.text).not.toContain('Falsche Rebsorte')
    expect(customer.text).toContain('nicht automatisch einer Bestellung zuordnen')
    expect(customer.text).not.toContain('weicht')
    expect(shop.subject).toContain('ohne passende Bestellung')
    expect(shop.text).toContain('Falsche Rebsorte')
    expect(shop.text).toContain('weicht von der Bestellung ab')
  })

  it('studio-logged record without submitted name falls back to the order', () => {
    const record: WithdrawalRecord = { ...matched, name: null, email: null, orderNumber: null }
    const { customer } = buildWithdrawalMails(record, ctx())
    expect(customer.headline).toBe('Hallo Anna Muster!')
    expect(customer.text).toContain('Bestellnummer: 000042')
  })

  it('follows the form of address', () => {
    vi.stubEnv('SHOP_FORMALITY', 'informal')
    const { customer } = buildWithdrawalMails(matched, ctx())
    expect(customer.text).toContain('Deiner Widerrufserklärung')
    expect(customer.text).toContain('Bitte sende die Ware')
  })
})
