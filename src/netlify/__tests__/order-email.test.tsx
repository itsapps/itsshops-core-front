import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../services/sanity', () => ({
  fetchOrderById: vi.fn(),
  fetchEmailSettings: vi.fn(),
  appendOrderHistory: vi.fn(),
  fetchShippingTrackingUrl: vi.fn(async () => null),
  // imported by lib/order-refunds (the notifier uses its real latestRefund)
  fetchOrderRevision: vi.fn(),
  writeOrderRefunds: vi.fn(),
}))
vi.mock('../services/email', () => ({ sendMail: vi.fn(async () => ({ id: 'msg-1' })) }))

import { appendOrderHistory, fetchOrderById, fetchEmailSettings, fetchShippingTrackingUrl, type EmailSettingsQueryResult } from '../services/sanity'
import { sendMail } from '../services/email'
import { sendOrderNotification, sendShopOrderNotification, studioOrderUrlFor } from '../lib/order-notifier'
import { buildEmailShopSettings } from '../lib/email-settings'
import { trackingCodes, trackingLink } from '../lib/tracking'
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
    expect(html).toContain('https://shop.example/assets/legal/legal-guarantee-notice-de-1200.png')
  })

  it('one summary row per items/order discount (title + amount); shipping discounts none', async () => {
    const ad = (over: Partial<NonNullable<OrderDocument['appliedDiscounts']>[number]>) => ({ _key: 'k', _type: 'appliedDiscount' as const, title: '', trigger: 'code' as const, target: 'order' as const, valueType: 'percent' as const, ...over })
    vi.mocked(fetchOrderById).mockResolvedValue(order({
      totals: { ...order().totals, discount: 450, grandTotal: 2050, shipping: 0 },
      appliedDiscounts: [
        ad({ title: 'Herbstaktion', trigger: 'automatic', target: 'items', amount: 250 }),
        ad({ title: 'SOMMER', code: 'SOMMER', amount: 200 }),
        ad({ title: 'Versandkostenfrei mit Weinpaket', trigger: 'automatic', target: 'shipping', valueType: 'free', amount: 500 }),
      ],
    }))
    await sendOrderNotification('o1', 'orderConfirmation')
    const text = textOf((await sent()).html)
    expect(text).toContain('Herbstaktion -2,50 €')
    expect(text).toContain('SOMMER -2,00 €')
    expect(text).not.toContain('Versandkostenfrei mit Weinpaket')
    expect(text).not.toContain('Rabatt -')
  })

  it('a discount without matching entries falls back to one "Rabatt" row', async () => {
    vi.mocked(fetchOrderById).mockResolvedValue(order({ totals: { ...order().totals, discount: 300, grandTotal: 2700 } }))
    await sendOrderNotification('o1', 'orderConfirmation')
    expect(textOf((await sent()).html)).toContain('Rabatt -3,00 €')
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
    const { html } = await sent()
    const text = textOf(html)
    expect(text).toContain('Sie haben das Recht, binnen vierzehn Tagen')
    expect(text).toContain('müssen Sie uns (Weingut Test, Hauptstraße 1, 3550 Langenlois, Österreich, E-Mail noreply@shop.example')
    expect(html).toMatch(/href="mailto:noreply@shop.example"/)
    expect(text).toContain('auch online unter https://shop.example/de/widerruf/')
    expect(html).toMatch(/href="https:\/\/shop.example\/de\/widerruf\/"/)
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
    expect((await sent()).html).toContain('/assets/legal/legal-guarantee-notice-en-1200.png')
  })
})

describe('bundle contents in the mail', () => {
  beforeEach(() => {
    vi.stubEnv('URL', 'https://shop.example')
    vi.mocked(fetchEmailSettings).mockResolvedValue(rawSettings())
    vi.mocked(sendMail).mockClear()
  })
  afterEach(() => vi.unstubAllEnvs())

  const bundleLine = (items?: boolean) => ({
    _key: 'l1', _type: 'orderItem' as const, kind: 'bundle' as const, variantId: 'b', productId: 'pb',
    title: 'Weinbox', subtitle: '2× Blaufränkisch, 1× Traubensaft', quantity: 2, price: 3000,
    vatRate: 13, vatAmount: 750, packed: false,
    bundle: {
      _type: 'orderItemBundle' as const,
      itemCount: 3,
      ...(items && { items: [
        { _key: 'a', _type: 'orderItemBundleItem' as const, variantId: 'w', productId: 'pw', title: 'Blaufränkisch', subtitle: '2023 · 750 ml', quantity: 2, price: 2400, vatRate: 13, vatAmount: 552 },
        { _key: 'b', _type: 'orderItemBundleItem' as const, variantId: 'j', productId: 'pj', title: 'Traubensaft', quantity: 1, price: 600, vatRate: 20, vatAmount: 200 },
      ] }),
    },
  })

  it('lists the items (per bundle) as a nested list, without the subtitle', async () => {
    vi.mocked(fetchOrderById).mockResolvedValue(order({ orderItems: [bundleLine(true)] }))
    await sendOrderNotification('o1', 'orderConfirmation')
    const { html } = await sent()
    expect(html).toMatch(/<ul[^>]*>\s*<li[^>]*>2 × Blaufränkisch – 2023 · 750 ml<\/li>\s*<li[^>]*>1 × Traubensaft<\/li>/)
    expect(textOf(html)).not.toContain('2× Blaufränkisch, 1× Traubensaft')
  })

  it('older bundle orders without items keep their subtitle', async () => {
    vi.mocked(fetchOrderById).mockResolvedValue(order({ orderItems: [bundleLine(false)] }))
    await sendOrderNotification('o1', 'orderConfirmation')
    const { html } = await sent()
    expect(textOf(html)).toContain('2× Blaufränkisch, 1× Traubensaft')
    expect(html).not.toContain('<ul')
  })
})

describe('invoices: false (invoices issued elsewhere)', () => {
  beforeEach(() => {
    vi.stubEnv('URL', 'https://shop.example')
    vi.mocked(fetchEmailSettings).mockResolvedValue(rawSettings())
    vi.mocked(fetchOrderById).mockResolvedValue(order())
    vi.mocked(sendMail).mockClear()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('refuses the invoice mail and an attached invoice, sends nothing', async () => {
    await expect(sendOrderNotification('o1', 'orderInvoice', { invoices: false })).rejects.toMatchObject({ httpStatus: 400 })
    await expect(sendOrderNotification('o1', 'orderShipping', { invoices: false, attachInvoice: true })).rejects.toMatchObject({ httpStatus: 400 })
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('other mails go out as before', async () => {
    await sendOrderNotification('o1', 'orderShipping', { invoices: false })
    expect(vi.mocked(sendMail).mock.calls.at(-1)![0].attachment).toBeUndefined()
  })
})

const refund = (id: string, amount: number, createdAt: string, status = 'succeeded') => ({
  _key: id, _type: 'orderRefund' as const, refundId: id, amount, createdAt, status, source: 'studio' as const,
})

describe('refund mails', () => {
  beforeEach(() => {
    vi.stubEnv('URL', 'https://shop.example')
    vi.mocked(fetchEmailSettings).mockResolvedValue(rawSettings())
    vi.mocked(fetchOrderById).mockResolvedValue(order())
    vi.mocked(sendMail).mockClear()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('states the refunded amount, never the order total', async () => {
    await sendOrderNotification('o1', 'orderRefundedPartially', { refundAmount: 1250 })
    const { html } = await sent()
    expect(textOf(html)).toContain('12,50')
    expect(textOf(html)).not.toContain('30,00')
  })

  it('partial mail is refused without an amount or stored refund (would otherwise state the total)', async () => {
    await expect(sendOrderNotification('o1', 'orderRefundedPartially')).rejects.toMatchObject({ httpStatus: 400 })
    expect(fetchOrderById).toHaveBeenCalled()
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('states the latest stored refund when no amount is passed (skipping failed ones)', async () => {
    vi.mocked(fetchOrderById).mockResolvedValue(order({
      refunds: [
        refund('re_1', 500, '2026-11-01T10:00:00.000Z'),
        refund('re_2', 750, '2026-11-02T10:00:00.000Z'),
        refund('re_3', 990, '2026-11-03T10:00:00.000Z', 'failed'),
      ],
    }))
    await sendOrderNotification('o1', 'orderRefundedPartially')
    const text = textOf((await sent()).html)
    expect(text).toContain('7,50')
    expect(text).not.toContain('9,90')
  })

  it('an explicit refundAmount wins over the stored refunds', async () => {
    vi.mocked(fetchOrderById).mockResolvedValue(order({ refunds: [refund('re_1', 500, '2026-11-01T10:00:00.000Z')] }))
    await sendOrderNotification('o1', 'orderRefundedPartially', { refundAmount: 1250 })
    expect(textOf((await sent()).html)).toContain('12,50')
  })

  it('full-refund mail without stored refunds states the order total', async () => {
    await sendOrderNotification('o1', 'orderRefunded')
    const { html, text } = await sent()
    expect(textOf(html)).toContain('30,00')
    expect(textOf(html)).toContain('den vollen Betrag von 30,00')
    expect(text).toContain('30,00')
  })

  it('full-refund mail for less than the total names the remainder and the total', async () => {
    await sendOrderNotification('o1', 'orderRefunded', { refundAmount: 1750 })
    const { html, text } = await sent()
    expect(textOf(html)).toContain('Restbetrag von 17,50')
    expect(textOf(html)).toContain('Zahlung von 30,00')
    expect(text).toContain('Restbetrag von 17,50')
  })

  it('"Send mail" full-refund mail is refused while the stored refunds do not cover the total', async () => {
    vi.mocked(fetchOrderById).mockResolvedValue(order({
      refunds: [
        refund('re_1', 1000, '2026-11-01T10:00:00.000Z'),
        refund('re_2', 2000, '2026-11-02T10:00:00.000Z', 'failed'),
      ],
    }))
    await expect(sendOrderNotification('o1', 'orderRefunded')).rejects.toMatchObject({ httpStatus: 400 })
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('"Send mail" full-refund mail after partial refunds covering the total names the remainder', async () => {
    vi.mocked(fetchOrderById).mockResolvedValue(order({
      refunds: [
        refund('re_1', 1250, '2026-11-01T10:00:00.000Z'),
        refund('re_2', 1750, '2026-11-02T10:00:00.000Z'),
      ],
    }))
    await sendOrderNotification('o1', 'orderRefunded')
    const text = textOf((await sent()).html)
    expect(text).toContain('Restbetrag von 17,50')
    expect(text).toContain('Zahlung von 30,00')
  })

  it('order mail subjects name the order', async () => {
    await sendOrderNotification('o1', 'orderShipping')
    expect((await sent()).subject).toBe('Bestellung 000042 versendet 📦')
    await sendOrderNotification('o1', 'orderConfirmation')
    expect((await sent()).subject).toBe('Bestellbestätigung 000042')
  })

  it('names the order in the subject, the body and the plain-text part', async () => {
    await sendOrderNotification('o1', 'orderRefundedPartially', { refundAmount: 1250 })
    const { html, text, subject } = await sent()
    const number = order().orderNumber
    expect(subject).toContain(`Bestellung ${number}`)
    expect(textOf(html)).toContain(`Bestellung ${number}`)
    expect(text).toContain(`Bestellung ${number}`)
    expect(subject).not.toContain('{{')
  })

  it('the plain-text part states the amount, no placeholder left', async () => {
    await sendOrderNotification('o1', 'orderRefundedPartially', { refundAmount: 1250 })
    const { text } = await sent()
    expect(text).toContain('12,50')
    expect(text).not.toContain('{{')
  })
})

describe('customer message', () => {
  beforeEach(() => {
    vi.stubEnv('URL', 'https://shop.example')
    vi.mocked(fetchEmailSettings).mockResolvedValue(rawSettings())
    vi.mocked(fetchOrderById).mockResolvedValue(order())
    vi.mocked(sendMail).mockClear()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('shows the message as plain text in the HTML and the plain-text part', async () => {
    await sendOrderNotification('o1', 'orderShipping', {
      customerMessage: '  Zwei Pakete.\n<b>Danke</b>  ',
    })
    const { html, text } = await sent()
    expect(textOf(html)).toContain('Zwei Pakete.')
    expect(html).toContain('&lt;b&gt;Danke&lt;/b&gt;')
    expect(html).not.toContain('<b>Danke</b>')
    expect(text).toMatch(/\n\nZwei Pakete\.\n<b>Danke<\/b>$/)
  })

  it('also works in the refund (simple) mails; blank message renders nothing', async () => {
    await sendOrderNotification('o1', 'orderRefunded', { customerMessage: 'Jahrgang 2019 ausverkauft.' })
    expect(textOf((await sent()).html)).toContain('Jahrgang 2019 ausverkauft.')

    await sendOrderNotification('o1', 'orderRefunded', { customerMessage: '   ' })
    const { html, text } = await sent()
    expect(html).not.toContain('border-left')
    expect(text).not.toContain('\n\n')
  })
})

describe('buildEmailShopSettings', () => {
  it('shop inbox falls back to the sender', () => {
    expect(buildEmailShopSettings(rawSettings(), '').shopNotificationEmail).toBe('noreply@shop.example')
    expect(buildEmailShopSettings(rawSettings({ shopNotificationEmail: 'o@x.example' }), '').shopNotificationEmail).toBe('o@x.example')
  })
})

describe('mail history entry', () => {
  beforeEach(() => {
    vi.stubEnv('URL', 'https://shop.example')
    vi.mocked(fetchEmailSettings).mockResolvedValue(rawSettings())
    vi.mocked(fetchOrderById).mockResolvedValue(order())
    vi.mocked(sendMail).mockClear()
    vi.mocked(appendOrderHistory).mockReset()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('appends one mail entry after a successful send (default source admin, trimmed message)', async () => {
    await sendOrderNotification('o1', 'orderShipping', { customerMessage: '  Zwei Pakete.  ' })
    expect(appendOrderHistory).toHaveBeenCalledTimes(1)
    const [orderId, entries] = vi.mocked(appendOrderHistory).mock.calls[0]!
    expect(orderId).toBe('o1')
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      _type: 'orderStatusHistory',
      type: 'mail',
      status: 'orderShipping',
      source: 'admin',
      customerMessage: 'Zwei Pakete.',
    })
    expect(entries[0]!._key).toBeTruthy()
    expect(entries[0]!.timestamp).toBeTruthy()
  })

  it('takes historySource and leaves out an empty message', async () => {
    await sendOrderNotification('o1', 'orderConfirmation', { historySource: 'system', customerMessage: '  ' })
    const entry = vi.mocked(appendOrderHistory).mock.calls[0]![1][0]!
    expect(entry).toMatchObject({ type: 'mail', status: 'orderConfirmation', source: 'system' })
    expect(entry).not.toHaveProperty('customerMessage')
  })

  it('appends nothing when the mail fails', async () => {
    vi.mocked(sendMail).mockRejectedValueOnce(new Error('smtp down'))
    await expect(sendOrderNotification('o1', 'orderShipping')).rejects.toThrow('smtp down')
    expect(appendOrderHistory).not.toHaveBeenCalled()
  })

  it('a failing history write does not fail the send', async () => {
    vi.mocked(appendOrderHistory).mockRejectedValueOnce(new Error('409'))
    const result = await sendOrderNotification('o1', 'orderShipping')
    expect(result).toMatchObject({ messageId: 'msg-1', mailType: 'orderShipping' })
  })

  it('the shop-inbox mail appends nothing', async () => {
    await sendShopOrderNotification('o1', { locale: 'de' })
    expect(sendMail).toHaveBeenCalled()
    expect(appendOrderHistory).not.toHaveBeenCalled()
  })
})

describe('shop new-order notification', () => {
  beforeEach(() => {
    vi.stubEnv('URL', 'https://shop.example')
    vi.mocked(fetchEmailSettings).mockResolvedValue(rawSettings({ shopNotificationEmail: 'orders@shop.example' }))
    vi.mocked(sendMail).mockClear()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('goes to the shop inbox in the shop locale, Reply-To the customer, without customer-only parts', async () => {
    vi.mocked(fetchOrderById).mockResolvedValue(order({
      customer: { ...order().customer, locale: 'en', billingAddress: { ...address, phone: '+43 660 1234567' } },
    }))
    await sendShopOrderNotification('o1', { locale: 'de' })
    const { to, replyTo, bcc, subject, html, text } = await sent()
    expect(to).toBe('orders@shop.example')
    expect(replyTo).toBe('anna@example.com')
    expect(bcc).toBeUndefined()
    expect(subject).toBe('Neue Bestellung 000042 – Anna Muster')
    const visible = textOf(html)
    expect(visible).toContain('Neue Bestellung 000042')
    expect(visible).toContain('anna@example.com')
    expect(visible).toContain('+43 660 1234567')
    expect(visible).toContain('Sprache: Englisch')
    expect(visible).toContain('Gesamtsumme')
    expect(visible).not.toContain('Hallo')
    expect(visible).not.toContain('widerrufen')
    expect(html).not.toContain('legal-guarantee-notice')
    expect(visible).not.toContain('Hauptstraße 1') // no footer with the shop's own address
    expect(text).toContain('Anna Muster <anna@example.com>')
  })

  it('links the order in the Studio when SANITY_STUDIO_URL is set', async () => {
    vi.mocked(fetchOrderById).mockResolvedValue(order())
    await sendShopOrderNotification('o1', { locale: 'de' })
    expect((await sent()).html).not.toContain('intent/edit')

    vi.stubEnv('SANITY_STUDIO_URL', 'https://studio.example/')
    await sendShopOrderNotification('o1', { locale: 'de' })
    const { html, text } = await sent()
    expect(html).toContain('href="https://studio.example/de/intent/edit/id=o1;type=order"')
    expect(textOf(html)).toContain('Bestellung im Studio öffnen')
    expect(text).toContain('https://studio.example/de/intent/edit/id=o1;type=order')
    expect(studioOrderUrlFor(undefined, 'de', 'o1')).toBeUndefined()
  })

  it('falls back to the sender address', async () => {
    vi.mocked(fetchEmailSettings).mockResolvedValue(rawSettings())
    vi.mocked(fetchOrderById).mockResolvedValue(order())
    await sendShopOrderNotification('o1', { locale: 'de' })
    expect((await sent()).to).toBe('noreply@shop.example')
  })
})

describe('pickup orders', () => {
  const pickupFulfillment = (over: Partial<OrderDocument['fulfillment']> = {}): OrderDocument['fulfillment'] => ({
    _type: 'fulfillment',
    methodTitle: 'Abholung im Weingut',
    methodType: 'pickup',
    deliveryTime: '1–2 Werktage',
    shippingCost: 0,
    taxSnapshot: { _type: 'vatBreakdownItem', rate: 0, net: 0, vat: 0 },
    method: { _type: 'reference', _ref: 'pu1', _weak: true },
    pickupAddress: { line1: 'Eisenstätter Straße 10', zip: '7061', city: 'Trausdorf', country: 'AT' },
    pickupInstructions: 'Mo–Fr 9–17 Uhr\nBitte Ausweis mitbringen',
    ...over,
  })
  const billing = { ...address, name: 'Max Muster', line1: 'Bahnhofstr. 1', zip: '8001', city: 'Zürich', country: 'CH' }
  const pickupOrder = (over: Partial<OrderDocument> = {}, f: Partial<OrderDocument['fulfillment']> = {}) => order({
    customer: { _type: 'orderCustomer', locale: 'de', contactEmail: 'max@example.com', billingAddress: billing },
    totals: { ...order().totals, shipping: 0 },
    fulfillment: pickupFulfillment(f),
    ...over,
  })
  const shippedAt = (timestamp: string) => ({
    _key: 's', _type: 'orderStatusHistory' as const, type: 'fulfillment' as const, status: 'shipped', timestamp, source: 'admin',
  })

  beforeEach(() => {
    vi.stubEnv('URL', 'https://shop.example')
    vi.stubEnv('SHOP_FORMALITY', '')
    vi.stubEnv('SHOP_TIMEZONE', '')
    vi.mocked(fetchEmailSettings).mockResolvedValue(rawSettings())
    vi.mocked(sendMail).mockClear()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('confirmation: pickup text + hold period (HTML and text), billing + pickup location, no shipping address', async () => {
    vi.mocked(fetchOrderById).mockResolvedValue(pickupOrder({}, { pickupHoldDays: 14, pickupAnnounceReady: true }))
    await sendOrderNotification('o1', 'orderConfirmation')
    const { html, text } = await sent()
    const visible = textOf(html)
    expect(visible).toContain('sobald sie zur Abholung bereit ist')
    expect(visible).toContain('14 Tage für Sie auf')
    expect(text).toContain('sobald sie zur Abholung bereit ist')
    expect(text).toContain('14 Tage für Sie auf')
    expect(visible).toContain('Rechnungsadresse')
    expect(visible).toContain('Abholort')
    expect(visible).toContain('Eisenstätter Straße 10')
    expect(visible).toContain('Bitte Ausweis mitbringen')
    expect(visible).toContain('Schweiz')
    expect(visible).not.toContain('Lieferadresse')
    expect(visible).toContain('Abholung: Abholung im Weingut')
    expect(visible).toContain('Abholbereit in: 1–2 Werktage')
  })

  it('confirmation without pickupAnnounceReady: collectable right away, no ready mail announced', async () => {
    vi.mocked(fetchOrderById).mockResolvedValue(pickupOrder())
    await sendOrderNotification('o1', 'orderConfirmation')
    const { html, text } = await sent()
    const visible = textOf(html)
    expect(visible).toContain('Ihre Bestellung ist bei uns eingegangen.')
    expect(visible).not.toContain('Abholung bereit')
    expect(visible).not.toContain('in Kürze bearbeitet')
    expect(text).not.toContain('Abholung bereit')
    await sendOrderNotification('o1', 'orderProcessing')
    const processing = textOf((await sent()).html)
    expect(processing).toContain('Ihre Bestellung wird nun bearbeitet.')
    expect(processing).not.toContain('Abholung bereit')
    expect(processing).not.toContain('versendet')
  })

  it('confirmation without hold days: no period line', async () => {
    vi.mocked(fetchOrderById).mockResolvedValue(pickupOrder())
    await sendOrderNotification('o1', 'orderConfirmation')
    expect(textOf((await sent()).html)).not.toContain('Tage für Sie auf')
  })

  it('ready mail: pickup subject, text and the deadline (latest shipped entry + days, with weekday)', async () => {
    vi.mocked(fetchOrderById).mockResolvedValue(pickupOrder(
      { status: 'shipped', statusHistory: [shippedAt('2026-11-18T09:00:00Z')] },
      { pickupHoldDays: 7 },
    ))
    await sendOrderNotification('o1', 'orderShipping')
    const { subject, html, text } = await sent()
    expect(subject).toBe('Bestellung 000042 ist abholbereit 🛍️')
    expect(textOf(html)).toContain('liegt für Sie zur Abholung bereit')
    expect(textOf(html)).toContain('bis Mittwoch, 25. November 2026 ab')
    expect(text).toContain('bis Mittwoch, 25. November 2026 ab')
    expect(textOf(html)).not.toContain('Sendungsnummer')
  })

  it('ready mail without hold days: no deadline', async () => {
    vi.mocked(fetchOrderById).mockResolvedValue(pickupOrder({ status: 'shipped', statusHistory: [shippedAt('2026-11-18T09:00:00Z')] }))
    await sendOrderNotification('o1', 'orderShipping')
    expect(textOf((await sent()).html)).not.toContain('Bitte holen Sie')
  })

  it('collected mail and processing text', async () => {
    vi.mocked(fetchOrderById).mockResolvedValue(pickupOrder())
    await sendOrderNotification('o1', 'orderDelivered')
    expect((await sent()).subject).toBe('Bestellung 000042 abgeholt 🛍️')
    vi.mocked(fetchOrderById).mockResolvedValue(pickupOrder({}, { pickupAnnounceReady: true }))
    await sendOrderNotification('o1', 'orderProcessing')
    expect(textOf((await sent()).html)).toContain('sobald sie zur Abholung bereit ist')
  })

  it('totals say "Abholung"; a delivery order keeps "Versand"', async () => {
    vi.mocked(fetchOrderById).mockResolvedValue(pickupOrder())
    await sendOrderNotification('o1', 'orderConfirmation')
    expect(textOf((await sent()).html)).toMatch(/Abholung\s+€\s?0,00|Abholung\s+0,00/)
    vi.mocked(fetchOrderById).mockResolvedValue(order())
    await sendOrderNotification('o1', 'orderConfirmation')
    expect(textOf((await sent()).html)).toContain('Versand')
  })

  it('cancel mail: generic text without "Falls"; not-collected text after "ready" (with / without period)', async () => {
    vi.mocked(fetchOrderById).mockResolvedValue(order({ status: 'canceled' }))
    await sendOrderNotification('o1', 'orderCanceled')
    let visible = textOf((await sent()).html)
    expect(visible).not.toContain('Falls')
    expect(visible).toContain('Den bezahlten Betrag erstatten wir Ihnen')

    vi.mocked(fetchOrderById).mockResolvedValue(pickupOrder({ status: 'canceled' }))
    await sendOrderNotification('o1', 'orderCanceled')
    expect(textOf((await sent()).html)).not.toContain('nicht abgeholt')

    vi.mocked(fetchOrderById).mockResolvedValue(pickupOrder(
      { status: 'canceled', statusHistory: [shippedAt('2026-11-10T09:00:00Z')] }, { pickupHoldDays: 7 },
    ))
    await sendOrderNotification('o1', 'orderCanceled')
    visible = textOf((await sent()).html)
    expect(visible).toContain('nicht innerhalb der Abholfrist abgeholt')

    vi.mocked(fetchOrderById).mockResolvedValue(pickupOrder(
      { status: 'canceled', statusHistory: [shippedAt('2026-11-10T09:00:00Z')] },
    ))
    await sendOrderNotification('o1', 'orderCanceled')
    visible = textOf((await sent()).html)
    expect(visible).toContain('Da Sie Ihre Bestellung nicht abgeholt haben')
    expect(visible).not.toContain('Abholfrist')
  })

  it('shop mail: pickup banner first (HTML and text), no shipping address needed', async () => {
    vi.mocked(fetchEmailSettings).mockResolvedValue(rawSettings({ shopNotificationEmail: 'orders@shop.example' }))
    vi.mocked(fetchOrderById).mockResolvedValue(pickupOrder({
      customer: { _type: 'orderCustomer', locale: 'de', contactEmail: 'max@example.com', billingAddress: { ...billing, phone: '+41 44 1234567' } },
    }))
    await sendShopOrderNotification('o1', { locale: 'de' })
    const { html, text } = await sent()
    expect(textOf(html)).toContain('ABHOLUNG – nicht versenden')
    expect(textOf(html)).toContain('+41 44 1234567')
    expect(text.startsWith('ABHOLUNG – nicht versenden')).toBe(true)
  })
})

describe('tracking numbers', () => {
  const DPD = 'https://tracking.dpd.de/status/de_DE/parcel/{code}'
  const shipped = (trackingCode: string | undefined, over: Partial<OrderDocument['fulfillment']> = {}) =>
    order({ status: 'shipped', fulfillment: { ...order().fulfillment, trackingCode, ...over } })

  beforeEach(() => {
    vi.stubEnv('URL', 'https://shop.example')
    vi.stubEnv('SHOP_FORMALITY', '')
    vi.mocked(fetchEmailSettings).mockResolvedValue(rawSettings())
    vi.mocked(fetchShippingTrackingUrl).mockReset().mockResolvedValue(null)
    vi.mocked(sendMail).mockClear()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('splits several numbers, links each via the method template (HTML and text)', async () => {
    vi.mocked(fetchShippingTrackingUrl).mockResolvedValue(DPD)
    vi.mocked(fetchOrderById).mockResolvedValue(shipped('0123, 0456'))
    await sendOrderNotification('o1', 'orderShipping')
    expect(fetchShippingTrackingUrl).toHaveBeenCalledWith('sm1')
    const { html, text } = await sent()
    expect(html).toContain('href="https://tracking.dpd.de/status/de_DE/parcel/0123"')
    expect(html).toContain('href="https://tracking.dpd.de/status/de_DE/parcel/0456"')
    expect(textOf(html)).toContain('Sendungsnummern:')
    expect(textOf(html)).toContain('Mit den Sendungsnummern können Sie verfolgen')
    expect(text).toContain('Sendungsnummern:\n0123 – https://tracking.dpd.de/status/de_DE/parcel/0123\n0456 – ')
  })

  it('without a template: the plain number, no link', async () => {
    vi.mocked(fetchOrderById).mockResolvedValue(shipped('0123'))
    await sendOrderNotification('o1', 'orderShipping')
    const { html, text } = await sent()
    expect(textOf(html)).toContain('Sendungsnummer: 0123')
    expect(textOf(html)).toContain('Mit der Sendungsnummer können Sie verfolgen')
    expect(html).not.toContain('parcel/')
    expect(text).toContain('Sendungsnummer:\n0123')
  })

  it('no number: no lookup, no tracking line, no hint', async () => {
    vi.mocked(fetchOrderById).mockResolvedValue(shipped(undefined))
    await sendOrderNotification('o1', 'orderShipping')
    expect(fetchShippingTrackingUrl).not.toHaveBeenCalled()
    const { html } = await sent()
    expect(textOf(html)).not.toContain('Sendungsnummer')
    expect(textOf(html)).toContain('Gute Nachricht: Ihre Bestellung ist verpackt und auf dem Weg zu Ihnen.')
  })

  it('a failed lookup still sends the mail with the plain number', async () => {
    vi.mocked(fetchShippingTrackingUrl).mockRejectedValue(new Error('down'))
    vi.mocked(fetchOrderById).mockResolvedValue(shipped('0123'))
    await sendOrderNotification('o1', 'orderShipping')
    expect(textOf((await sent()).html)).toContain('Sendungsnummer: 0123')
  })

  it('helpers: separators, encoding, only https templates with {code}', () => {
    expect(trackingCodes(' 01, 02;03  04 ')).toEqual(['01', '02', '03', '04'])
    expect(trackingCodes(undefined)).toEqual([])
    expect(trackingLink('https://x.example/?n={code}', 'A B/1')).toBe('https://x.example/?n=A%20B%2F1')
    expect(trackingLink('http://x.example/{code}', '1')).toBeUndefined()
    expect(trackingLink('https://x.example/', '1')).toBeUndefined()
    expect(trackingLink('  ', '1')).toBeUndefined()
  })
})
