import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../services/sanity', () => ({ fetchOrderById: vi.fn(), fetchEmailSettings: vi.fn() }))
vi.mock('../services/email', () => ({ sendMail: vi.fn(async () => ({ id: 'msg-1' })) }))

import { fetchOrderById, fetchEmailSettings, type EmailSettingsQueryResult } from '../services/sanity'
import { sendMail } from '../services/email'
import { sendOrderNotification } from '../lib/order-notifier'
import { buildEmailShopSettings } from '../lib/email-settings'
import type { OrderDocument } from '../types/checkout'

const rawSettings = (over: Partial<EmailSettingsQueryResult> = {}): EmailSettingsQueryResult => ({
  shopName: 'Weingut Test',
  senderName: 'Weingut Test',
  senderEmail: 'noreply@shop.example',
  billingAddress: { line1: 'Hauptstraße 1', line2: null, zip: '3550', city: 'Langenlois', country: 'AT' },
  bankAccount: null,
  orderNumberPrefix: null,
  invoiceNumberPrefix: null,
  returnAddress: null,
  returnShippingBorneBy: null,
  returnPolicyNote: null,
  shopNotificationEmail: null,
  company: null,
  withdrawalPeriodStart: null,
  withdrawalExceptions: null,
  ...over,
})

const address = { _type: 'addressStrict' as const, name: 'Anna Muster', line1: 'Gasse 2', zip: '1010', city: 'Wien', country: 'AT' }

const order = (over: Partial<OrderDocument> = {}): OrderDocument & { _id: string; _createdAt: string; _updatedAt: string } => ({
  _id: 'o1',
  _createdAt: '2026-10-08T10:00:00Z',
  _updatedAt: '2026-10-08T10:00:00Z',
  _type: 'order',
  orderNumber: '000042',
  invoiceNumber: '000042',
  status: 'created',
  paymentStatus: 'succeeded',
  statusHistory: [{ _key: 'h', _type: 'orderStatusHistory', type: 'payment', status: 'succeeded', timestamp: '2026-10-08T10:00:00Z', source: 'stripe' }],
  paymentIntentId: 'pi_1',
  orderItems: [],
  customer: { _type: 'orderCustomer', locale: 'de', contactEmail: 'anna@example.com', billingAddress: address, shippingAddress: address },
  totals: { _type: 'orderTotals', grandTotal: 3000, subtotal: 2500, shipping: 500, discount: 0, totalVat: 500, vatBreakdown: [], currency: 'EUR' },
  fulfillment: {
    _type: 'fulfillment',
    methodTitle: 'Post',
    methodType: 'delivery',
    shippingCost: 500,
    taxSnapshot: { _type: 'vatBreakdownItem', rate: 20, net: 417, vat: 83 },
    method: { _type: 'reference', _ref: 'sm1', _weak: true },
  },
  ...over,
} as OrderDocument & { _id: string; _createdAt: string; _updatedAt: string })

async function sent() {
  const call = vi.mocked(sendMail).mock.calls.at(-1)![0]
  return { ...call, html: call.html as string }
}

/** Visible text of the rendered mail (tags stripped, entities for the bullets decoded). */
const textOf = (html: string) => html.replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ')

describe('order confirmation email', () => {
  beforeEach(() => {
    vi.stubEnv('URL', 'https://shop.example')
    vi.stubEnv('SHOP_FORMALITY', '')
    vi.stubEnv('SHOP_TIMEZONE', '')
    vi.mocked(fetchEmailSettings).mockResolvedValue(rawSettings())
    vi.mocked(sendMail).mockClear()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('shows order date, payment and shipping method with delivery time', async () => {
    vi.mocked(fetchOrderById).mockResolvedValue(order({
      orderDate: '2026-10-05T20:00:00Z',
      payment: { _type: 'orderPaymentMethod', type: 'card', brand: 'visa', last4: '4242', wallet: 'apple_pay' },
      fulfillment: { ...order().fulfillment, deliveryTime: '2–4 Werktage' },
    }))
    await sendOrderNotification('o1', 'orderConfirmation')
    const { html } = await sent()
    const text = textOf(html)
    expect(text).toContain('Bestelldatum: 5. Oktober 2026')
    expect(text).toContain('Zahlungsart: Apple Pay (Visa •••• 4242)')
    expect(text).toContain('Versandart: Post')
    expect(text).toContain('Lieferzeit: 2–4 Werktage')
    expect(html).toContain('https://shop.example/assets/legal/legal-guarantee-notice-de.png')
  })

  it('older orders: no payment line, order date from the first status entry', async () => {
    vi.mocked(fetchOrderById).mockResolvedValue(order())
    await sendOrderNotification('o1', 'orderConfirmation')
    const text = textOf((await sent()).html)
    expect(text).not.toContain('Zahlungsart')
    expect(text).toContain('Bestelldatum: 8. Oktober 2026')
  })

  it('withdrawal section is on by default and can be turned off', async () => {
    vi.mocked(fetchOrderById).mockResolvedValue(order())
    await sendOrderNotification('o1', 'orderConfirmation')
    let html = (await sent()).html
    expect(html).toContain('https://shop.example/de/widerruf/')
    expect(textOf(html)).toContain('Vertrag widerrufen')

    await sendOrderNotification('o1', 'orderConfirmation', { withdrawalNotice: false })
    html = (await sent()).html
    expect(html).not.toContain('/de/widerruf/')
  })

  it('confirmation carries the full withdrawal instructions + model form', async () => {
    vi.mocked(fetchOrderById).mockResolvedValue(order())
    vi.mocked(fetchEmailSettings).mockResolvedValue(rawSettings({
      returnShippingBorneBy: 'merchant',
      withdrawalExceptions: ['alcoholMarketPrice'],
      returnPolicyNote: 'Bitte in versandgeeigneter Verpackung.',
    }))
    await sendOrderNotification('o1', 'orderConfirmation')
    const text = textOf((await sent()).html)
    expect(text).toContain('Sie haben das Recht, binnen vierzehn Tagen')
    expect(text).toContain('müssen Sie uns (Weingut Test, Hauptstraße 1, 3550 Langenlois, Österreich, E-Mail noreply@shop.example)')
    expect(text).toContain('auch online unter https://shop.example/de/widerruf/ ausüben')
    expect(text).toContain('Wir tragen die Kosten der Rücksendung')
    expect(text).toContain('Muster-Widerrufsformular')
    expect(text).toContain('Ausschluss des Widerrufsrechts')
    expect(text).toContain('Bitte in versandgeeigneter Verpackung.')
  })

  it('incomplete settings → short notice instead of a half-filled legal text', async () => {
    vi.mocked(fetchOrderById).mockResolvedValue(order())
    vi.mocked(fetchEmailSettings).mockResolvedValue(rawSettings({ billingAddress: null }))
    await sendOrderNotification('o1', 'orderConfirmation')
    const text = textOf((await sent()).html)
    expect(text).not.toContain('Muster-Widerrufsformular')
    expect(text).toContain('Vertrag widerrufen')
  })

  it('BCC goes to the shop inbox, falling back to the sender', async () => {
    vi.mocked(fetchOrderById).mockResolvedValue(order())
    await sendOrderNotification('o1', 'orderConfirmation', { bccSender: true })
    expect((await sent()).bcc).toBe('noreply@shop.example')

    vi.mocked(fetchEmailSettings).mockResolvedValue(rawSettings({ shopNotificationEmail: 'orders@shop.example' }))
    await sendOrderNotification('o1', 'orderConfirmation', { bccSender: true })
    expect((await sent()).bcc).toBe('orders@shop.example')
  })

  it('footer renders only the company fields that are set', async () => {
    vi.mocked(fetchOrderById).mockResolvedValue(order())
    vi.mocked(fetchEmailSettings).mockResolvedValue(rawSettings({
      company: {
        name: 'Weingut Test GmbH', owner: null, email: 'office@shop.example', phone: '+43 1 234',
        vatId: 'ATU12345678', registerNumber: 'FN 123456a', registerCourt: null, address: null,
      },
    }))
    await sendOrderNotification('o1', 'orderConfirmation')
    const text = textOf((await sent()).html)
    expect(text).toContain('Weingut Test GmbH')
    expect(text).toContain('UID: ATU12345678')
    expect(text).toContain('Firmenbuchnummer: FN 123456a')
    expect(text).toContain('Tel.: +43 1 234')
    expect(text).toContain('office@shop.example')
    expect(text).not.toContain('Firmenbuchgericht')
    expect(text).not.toContain('Inhaber')
    // No company address → billing address
    expect(text).toContain('Hauptstraße 1')
  })

  it('follows the form of address and the locale', async () => {
    vi.mocked(fetchOrderById).mockResolvedValue(order())
    await sendOrderNotification('o1', 'orderConfirmation')
    expect(textOf((await sent()).html)).toContain('Ihre Bestellung')

    vi.stubEnv('SHOP_FORMALITY', 'informal')
    await sendOrderNotification('o1', 'orderConfirmation')
    expect(textOf((await sent()).html)).toContain('Deine Bestellung')

    vi.mocked(fetchOrderById).mockResolvedValue(order({ customer: { ...order().customer, locale: 'en' } }))
    await sendOrderNotification('o1', 'orderConfirmation')
    const text = textOf((await sent()).html)
    expect(text).toContain('Withdraw from contract here')
    expect((await sent()).html).toContain('/assets/legal/legal-guarantee-notice-en.png')
  })
})

describe('buildEmailShopSettings', () => {
  it('shop inbox falls back to the sender', () => {
    expect(buildEmailShopSettings(rawSettings(), '').shopNotificationEmail).toBe('noreply@shop.example')
    expect(buildEmailShopSettings(rawSettings({ shopNotificationEmail: 'o@x.example' }), '').shopNotificationEmail).toBe('o@x.example')
  })
})
