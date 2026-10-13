import { describe, it, expect, vi } from 'vitest'

vi.mock('../services/sanity', () => ({ sanityClient: {} }))
vi.mock('../lib/order-notifier', () => ({ sendOrderNotification: vi.fn() }))
vi.mock('../utils/logger', () => ({ log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() } }))

import { mapOrder, type SanityOrder } from '../functions/wc-api'
import { calculateTotals } from '../lib/totals'
import { extractVat } from '../lib/tax'

type Item = { price: number; quantity: number; vatRate: number }

/** Builds an order the way checkout does (calculateTotals + per-line vatAmount). */
function order(items: Item[], { shipping = 0, shippingRate = 13, discount = 0 } = {}): SanityOrder {
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
    customer: { contactEmail: 'a@b.at', locale: 'de', billingAddress: null, shippingAddress: null },
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
    expect(map(tinhof).shipping_lines[0].taxes).toEqual([{ id: 1, total: '0.00', subtotal: '0.00' }])
    expect(map(order([{ price: 1500, quantity: 1, vatRate: 13 }], { shippingRate: 0 })).shipping_lines[0].taxes)
      .toEqual([])
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
