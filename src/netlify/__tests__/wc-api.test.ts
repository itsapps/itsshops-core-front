import { describe, it, expect, vi } from 'vitest'

vi.mock('../services/sanity', () => ({ sanityClient: {} }))
vi.mock('../lib/order-notifier', () => ({ sendOrderNotification: vi.fn() }))
vi.mock('../utils/logger', () => ({ log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() } }))

import { createWcApiHandler, mapOrder, type SanityOrder } from '../functions/wc-api'
import { log } from '../utils/logger'
import { calculateTotals } from '../lib/totals'
import { extractVat } from '../lib/tax'

type Item = { price: number; quantity: number; vatRate: number }

/** Builds an order the way checkout does (calculateTotals + per-line vatAmount). */
function order(items: Item[], { shipping = 0, shippingRate = 13, discount = 0, country = '' } = {}): SanityOrder {
  const totals = calculateTotals(
    items.map(i => ({ ...i })) as never,
    shipping ? { price: shipping } as never : null,
    shippingRate,
    discount ? { discountAmount: discount, zeroShipping: false } : null,
  )
  const shippingVat = extractVat(shipping, shippingRate)
  return {
    _id: 'order-1',
    _createdAt: '2026-10-12T12:53:33Z',
    orderNumber: '000001',
    invoiceNumber: '000001',
    status: 'created',
    paymentStatus: 'succeeded',
    paymentIntentId: 'pi_1',
    payment: null,
    hasOpenWithdrawal: false,
    customer: {
      contactEmail: 'a@b.at', locale: 'de', billingAddress: null,
      shippingAddress: country ? { country } as never : null,
    },
    totals: { ...totals, totalVat: totals.tax, currency: 'EUR' },
    orderItems: items.map((i, n) => ({
      _key: `k${n}`, kind: 'wine', variantId: `v${n}`, productId: `p${n}`, title: `Wine ${n}`,
      subtitle: null, sku: null, weight: null, ...i,
      vatAmount: extractVat(i.price * i.quantity, i.vatRate),
    })),
    fulfillment: {
      methodTitle: 'DPD (AT)', methodType: 'delivery', shippingCost: shipping,
      taxSnapshot: { rate: shippingRate, net: shipping - shippingVat, vat: shippingVat },
      trackingCode: null, packagingLines: null,
    },
  }
}

const cents = (s: string) => Math.round(Number(s) * 100)
const map = (o: SanityOrder) => mapOrder(o, 'Europe/Vienna')

// Tinhof order 000001: 6 × 15.00 at 13 % + 2 × 5.00 at 20 %, free shipping.
const tinhof = order([{ price: 1500, quantity: 6, vatRate: 13 }, { price: 500, quantity: 2, vatRate: 20 }])

describe('wc-api mapOrder (WooCommerce-compatible amounts)', () => {
  it('price is the exact net unit price, never the gross one', () => {
    const wc = map(tinhof)
    expect(wc.line_items[0].price).toBeCloseTo(9000 / 1.13 / 6 / 100, 10)
    expect(wc.line_items[1].price).toBeCloseTo(1000 / 1.2 / 2 / 100, 10)
    expect(wc.line_items.map(li => [li.total, li.total_tax])).toEqual([['79.65', '10.35'], ['8.33', '1.67']])
    expect(wc.total).toBe('100.00')
    expect(wc.total_tax).toBe('12.02')
  })

  it('lists the shipping tax rate with 0.00 on free shipping, as WooCommerce does', () => {
    const wc = map(tinhof)
    const rate13 = wc.tax_lines.find(tl => tl.rate_percent === '13.00')!.rate_id
    expect(wc.shipping_lines[0].taxes).toEqual([{ id: rate13, total: '0.00', subtotal: '0.00' }])
    expect(map(order([{ price: 1500, quantity: 1, vatRate: 13 }], { shippingRate: 0 })).shipping_lines[0].taxes)
      .toEqual([])
  })

  it('rate_id is stable per country and rate across orders; taxes[].id refer to it', () => {
    const a = map(order([{ price: 3200, quantity: 1, vatRate: 20 }, { price: 1100, quantity: 1, vatRate: 13 }],
      { shipping: 1000, shippingRate: 20, country: 'AT' }))
    const b = map(order([{ price: 1100, quantity: 1, vatRate: 13 }, { price: 500, quantity: 1, vatRate: 20 }],
      { country: 'AT' }))
    const byRate = (wc: typeof a) => Object.fromEntries(wc.tax_lines.map(tl => [tl.rate_code, tl.rate_id]))
    expect(Object.keys(byRate(a))).toEqual(['AT-20', 'AT-13'])
    expect(byRate(b)).toEqual(byRate(a))                      // order of appearance doesn't matter
    expect(b.tax_lines.map(tl => tl.id)).toEqual([1, 2])      // the tax line's own id stays 1, 2, …
    const lineRates = (wc: typeof a) =>
      wc.line_items.map(li => wc.tax_lines.find(tl => tl.rate_id === li.taxes[0].id)!.rate_percent)
    expect(lineRates(a)).toEqual(['20.00', '13.00'])
    expect(lineRates(b)).toEqual(['13.00', '20.00'])
    expect(a.shipping_lines[0].taxes[0].id).toBe(byRate(a)['AT-20'])
    // Same percentage in another country is a different rate (WC: per-country tax rates).
    const de = map(order([{ price: 1100, quantity: 1, vatRate: 20 }], { country: 'de' }))
    expect(de.tax_lines[0].rate_code).toBe('DE-20')
    expect(de.tax_lines[0].rate_id).not.toBe(byRate(a)['AT-20'])
  })

  it('reports shipping tax only in shipping_tax_total, not in tax_total', () => {
    const wc = map(order([{ price: 1500, quantity: 6, vatRate: 13 }], { shipping: 1050 }))
    const line13 = wc.tax_lines.find(tl => tl.rate_percent === '13.00')!
    expect(line13.tax_total).toBe('10.35')
    expect(line13.shipping_tax_total).toBe('1.21')
    expect(wc.shipping_total).toBe('9.29')
    expect(wc.shipping_tax).toBe('1.21')
    expect(wc.total_tax).toBe('11.56')
    expect(wc.total).toBe('100.50')
  })

  it('splits a coupon into net discount_total + discount_tax', () => {
    const wc = map(order([{ price: 5500, quantity: 2, vatRate: 13 }], { discount: 1000 }))
    expect(wc.line_items[0].subtotal).toBe('97.35')
    expect(wc.line_items[0].total).toBe('88.50')
    expect(wc.discount_total).toBe('8.85')
    expect(wc.discount_tax).toBe('1.15')
    expect(wc.total).toBe('100.00')
  })

  it('keeps the WooCommerce invariants on random orders', () => {
    let seed = 42
    const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed % n }
    for (let n = 0; n < 2000; n++) {
      const items = [...Array(1 + rnd(5))].map(() => ({
        price: 300 + rnd(4000), quantity: 1 + rnd(12), vatRate: rnd(5) === 0 ? 20 : 13,
      }))
      const shipping = rnd(2) ? 0 : 500 + rnd(1500)
      const o = order(items, { shipping, discount: rnd(4) === 0 ? 1000 : 0 })
      const wc = map(o)
      const lineTax = (rate: string) => wc.line_items
        .filter((_, i) => o.orderItems[i].vatRate.toFixed(2) === rate)
        .reduce((s, li) => s + cents(li.total_tax), 0)

      // tax_total per rate = its item line taxes; order total_tax = all tax lines incl. shipping
      for (const tl of wc.tax_lines) expect(cents(tl.tax_total)).toBe(lineTax(tl.rate_percent))
      expect(wc.tax_lines.reduce((s, tl) => s + cents(tl.tax_total) + cents(tl.shipping_tax_total), 0))
        .toBe(cents(wc.total_tax))
      expect(cents(wc.total)).toBe(o.totals.grandTotal)

      wc.line_items.forEach((li, i) => {
        const rate = o.orderItems[i].vatRate
        const gross = cents(li.total) + cents(li.total_tax)
        // net × quantity rounds to the line total and net × (1 + rate) gives back the gross —
        // up to 1 cent at an exact half-cent net/tax (WooCommerce has the same tie)
        expect(Math.abs(Math.round(li.price * li.quantity * 100) - cents(li.total))).toBeLessThanOrEqual(1)
        expect(Math.abs(Math.round(li.price * li.quantity * (100 + rate)) - gross)).toBeLessThanOrEqual(1)
      })
    }
  })
})

describe('wc-api request logging', () => {
  it('logs param names and dp, never the credentials', async () => {
    process.env.WC_CONSUMER_KEY = 'ck_secret'
    process.env.WC_CONSUMER_SECRET = 'cs_secret'
    const handler = createWcApiHandler()
    await handler(
      new Request('https://shop.test/wp-json/wc/v3/system_status?consumer_key=ck_secret&consumer_secret=cs_secret&dp=4'),
      {} as never,
    )
    const call = vi.mocked(log.debug).mock.calls.find(([msg]) => msg === 'Request')!
    expect(call[1]).toMatchObject({ path: 'system_status', params: ['consumer_key', 'consumer_secret', 'dp'], dp: '4' })
    expect(JSON.stringify(call)).not.toMatch(/ck_secret|cs_secret/)
  })
})
