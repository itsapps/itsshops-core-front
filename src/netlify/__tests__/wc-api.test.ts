import { describe, it, expect, vi, beforeEach } from 'vitest'

const sanity = vi.hoisted(() => ({ client: {} as Record<string, unknown> }))
vi.mock('../services/sanity', () => ({ sanityClient: sanity.client }))
vi.mock('../lib/order-notifier', () => ({ sendOrderNotification: vi.fn() }))
vi.mock('../utils/logger', () => ({ log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() } }))

import { createWcApiHandler, mapOrder, statusFilter, type SanityOrder } from '../functions/wc-api'
import { log } from '../utils/logger'
import { sendOrderNotification } from '../lib/order-notifier'
import { calculateTotals } from '../lib/totals'
import { extractVat } from '../lib/tax'
import { evaluateDiscounts, type DiscountResult } from '../../shared/discounts'
import { migrateOrderDiscounts, type OrderLike } from '../lib/discount-migration'
import legacy from './fixtures/wc-api-legacy-orders.json'

type Item = { price: number; quantity: number; vatRate: number }

/** A fixed order discount of `amount` cents over the lines, through the checkout pipeline. */
function pipeline(lines: { price: number; quantity: number; bundleItems?: { price: number }[] }[], amount: number): DiscountResult | null {
  if (!amount) return null
  return evaluateDiscounts({
    lines: lines.map((l, i) => ({
      selector: { variantId: `v${i}`, productId: `p${i}`, kind: 'wine', categoryIds: [], manufacturerIds: [], hasCompareAtPrice: false },
      unitPrice: l.price,
      quantity: l.quantity,
      childPrices: l.bundleItems?.map(bi => bi.price) ?? null,
    })),
    couponCode: 'X',
    codeDiscount: {
      _id: 'd', title: 'X', trigger: 'code', code: 'X', enabled: true, target: 'order', valueType: 'fixed', value: amount,
    },
  })
}

/** Builds an order the way checkout does (pipeline + calculateTotals + per-line vatAmount/discount). */
function order(items: Item[], { shipping = 0, shippingRate = 13, discount = 0, country = '' } = {}): SanityOrder {
  const discounts = pipeline(items, discount)
  const totals = calculateTotals(
    items.map(i => ({ ...i })) as never,
    shipping ? { price: shipping } as never : null,
    shippingRate,
    discounts,
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
    erpAcceptedAt: null,
    customer: {
      contactEmail: 'a@b.at', locale: 'de', billingAddress: null,
      shippingAddress: country ? { country } as never : null,
    },
    totals: { ...totals, totalVat: totals.tax, currency: 'EUR' },
    orderItems: items.map((i, n) => ({
      _key: `k${n}`, kind: 'wine', variantId: `v${n}`, productId: `p${n}`, title: `Wine ${n}`,
      subtitle: null, sku: null, weight: null, ...i,
      vatAmount: extractVat(i.price * i.quantity, i.vatRate),
      ...(discounts?.lines[n].discount && { discount: discounts.lines[n].discount }),
    })),
    fulfillment: {
      methodTitle: 'DPD (AT)', methodType: 'delivery', shippingCost: shipping,
      taxSnapshot: { rate: shippingRate, net: shipping - shippingVat, vat: shippingVat },
      trackingCode: null, packagingLines: null, pickupAddress: null, pickupInstructions: null,
    },
  }
}

const cents = (s: string) => Math.round(Number(s) * 100)
const map = (o: SanityOrder) => mapOrder(o, 'Europe/Vienna')

// First real order: 6 × 15.00 at 13 % + 2 × 5.00 at 20 %, free shipping.
const firstOrder = order([{ price: 1500, quantity: 6, vatRate: 13 }, { price: 500, quantity: 2, vatRate: 20 }])

describe('wc-api mapOrder (WooCommerce-compatible amounts)', () => {
  it('price is the exact net unit price, never the gross one', () => {
    const wc = map(firstOrder)
    expect(wc.line_items[0].price).toBeCloseTo(9000 / 1.13 / 6 / 100, 10)
    expect(wc.line_items[1].price).toBeCloseTo(1000 / 1.2 / 2 / 100, 10)
    expect(wc.line_items.map(li => [li.total, li.total_tax])).toEqual([['79.65', '10.35'], ['8.33', '1.67']])
    expect(wc.total).toBe('100.00')
    expect(wc.total_tax).toBe('12.02')
  })

  it('lists the shipping tax rate with 0.00 on free shipping, as WooCommerce does', () => {
    const wc = map(firstOrder)
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

describe('wc-api pickup orders (WC block checkout Local Pickup)', () => {
  const billing = {
    name: 'Max Muster', prename: 'Max', lastname: 'Muster', line1: 'Hauptstr. 1', line2: null,
    zip: '80331', city: 'München', country: 'DE', state: null, phone: null,
  }
  const pickupOrder = (): SanityOrder => {
    const o = order([{ price: 1500, quantity: 2, vatRate: 13 }])
    return {
      ...o,
      customer: { ...o.customer, billingAddress: billing, shippingAddress: null },
      fulfillment: {
        ...o.fulfillment!,
        methodTitle: 'Abholung im Weingut', methodType: 'pickup',
        pickupAddress: { line1: 'Eisenstätter Straße 10', line2: null, zip: '7061', city: 'Trausdorf', country: 'AT' },
        pickupInstructions: 'Mo–Fr 9–17 Uhr',
      },
    }
  }

  it('method_id pickup_location + the three meta entries', () => {
    const line = map(pickupOrder()).shipping_lines[0] as { method_id: string; method_title: string; meta_data: Array<{ id: number; key: string; value: string }> }
    expect(line.method_id).toBe('pickup_location')
    expect(line.method_title).toBe('Abholung im Weingut')
    expect(line.meta_data.map(m => [m.key, m.value])).toEqual([
      ['pickup_location', 'Abholung im Weingut'],
      ['pickup_address', 'Eisenstätter Straße 10, 7061 Trausdorf, AT'],
      ['pickup_details', 'Mo–Fr 9–17 Uhr'],
    ])
    expect(line.meta_data.every(m => Number.isInteger(m.id) && m.id > 0)).toBe(true)
  })

  it('shipping = a copy of billing; rate_ids by the pickup country', () => {
    const wc = map(pickupOrder())
    expect(wc.shipping.address_1).toBe('Hauptstr. 1')
    expect(wc.shipping.country).toBe('DE')
    expect(wc.tax_lines[0].rate_code).toBe('AT-13')
  })

  it('delivery stays as is', () => {
    const line = map(order([{ price: 1500, quantity: 1, vatRate: 13 }], { country: 'AT' })).shipping_lines[0]
    expect(line.method_id).toBe('delivery')
    expect(line).not.toHaveProperty('meta_data')
  })

  it('an open withdrawal on a ready-for-pickup (shipped) order stays completed', () => {
    const o = { ...pickupOrder(), status: 'shipped', hasOpenWithdrawal: true }
    expect(map(o).status).toBe('completed')
  })
})

describe('wc-api bundles → their items as ordinary lines', () => {
  type BI = { key: string; variant: string; product: string; quantity: number; price: number; vatRate: number }
  // €30 box = 2 × €12 wine (13 %) + €6 juice (20 %), split by single prices: 2400 + 600.
  const boxItems: BI[] = [
    { key: 'a', variant: 'wine-v', product: 'wine-p', quantity: 2, price: 2400, vatRate: 13 },
    { key: 'b', variant: 'juice-v', product: 'juice-p', quantity: 1, price: 600, vatRate: 20 },
  ]

  /** An order with one bundle line (+ optional loose lines), totals as checkout builds them. */
  function bundleOrder(bundleQty: number, items: BI[], { loose = [] as Item[], discount = 0, shipping = 0, withItems = true } = {}) {
    const unit = items.reduce((sum, bi) => sum + bi.price, 0)
    const bundleItems = items.map(bi => ({ ...bi, vatAmount: 0 }))
    const lines = [{ price: unit, quantity: bundleQty, vatRate: 13, bundleItems }, ...loose]
    const discounts = pipeline(lines, discount)
    const totals = calculateTotals(
      lines as never,
      shipping ? { price: shipping } as never : null,
      13,
      discounts,
    )
    const o = order(loose, { shipping })
    o.orderItems.forEach((item, n) => {
      const d = discounts?.lines[n + 1].discount
      if (d) item.discount = d
    })
    o.totals = { ...totals, totalVat: totals.tax, currency: 'EUR' }
    o.orderItems = [{
      _key: 'box', kind: 'bundle', variantId: 'box-v', productId: 'box-p', title: 'Weinbox',
      subtitle: '2× Wein, 1× Saft', sku: 'BOX', weight: null, quantity: bundleQty, price: unit, vatRate: 13,
      vatAmount: 0,
      ...(discounts?.lines[0].discount && { discount: discounts.lines[0].discount }),
      bundle: withItems ? { items: items.map((bi, c) => ({
        _key: bi.key, variantId: bi.variant, productId: bi.product, title: `T ${bi.variant}`,
        subtitle: '2023 · 750 ml', sku: `S-${bi.variant}`, quantity: bi.quantity, price: bi.price, vatRate: bi.vatRate,
        ...(discounts?.lines[0].children?.[c] && { discount: discounts.lines[0].children[c] }),
      })) } : null,
    }, ...o.orderItems]
    return o
  }

  it('no parent line; item lines carry the loose product/variant ids, sku, name and bundle meta', () => {
    const wc = map(bundleOrder(1, boxItems))
    expect(wc.line_items).toHaveLength(2)
    const wine = wc.line_items[0]
    // Same ids as the wine bought loose
    const looseOrder = order([{ price: 1200, quantity: 1, vatRate: 13 }])
    looseOrder.orderItems[0] = { ...looseOrder.orderItems[0], productId: 'wine-p', variantId: 'wine-v' }
    const [looseWine] = map(looseOrder).line_items
    expect([wine.product_id, wine.variation_id]).toEqual([looseWine.product_id, looseWine.variation_id])
    expect(wine).toMatchObject({ name: 'T wine-v - 2023 · 750 ml', sku: 'S-wine-v', quantity: 2 })
    expect(wine.meta_data).toEqual([
      { key: '_sanity_product_id', value: 'wine-p' },
      { key: '_sanity_variant_id', value: 'wine-v' },
      { key: '_bundle_title', value: 'Weinbox' },
      { key: '_bundle_sku', value: 'BOX' },
      { key: '_bundle_variant_id', value: 'box-v' },
    ])
    expect(wc.tax_lines.map(tl => tl.rate_percent).sort()).toEqual(['13.00', '20.00'])
  })

  it('item qty 3 in a bundle of qty 2 → quantity 6, subtotal = share × 2 exactly', () => {
    const wc = map(bundleOrder(2, [{ key: 'a', variant: 'w', product: 'p', quantity: 3, price: 2500, vatRate: 13 }]))
    const [line] = wc.line_items
    expect(line.quantity).toBe(6)
    expect(cents(line.subtotal) + cents(line.subtotal_tax)).toBe(5000)
  })

  it('10 % coupon on the box: lines + shipping = grand total, tax_lines match', () => {
    const wc = map(bundleOrder(1, boxItems, { discount: 300, shipping: 790 }))
    const [wine, juice] = wc.line_items
    expect([wine.total, wine.total_tax]).toEqual(['19.12', '2.48'])
    expect([juice.total, juice.total_tax]).toEqual(['4.50', '0.90'])
    expect(wine.price).toBeCloseTo(2160 / 1.13 / 2 / 100, 10)
    const lineSum = wc.line_items.reduce((sum, li) => sum + cents(li.total) + cents(li.total_tax), 0)
    expect(lineSum + cents(wc.shipping_total) + cents(wc.shipping_tax)).toBe(cents(wc.total))
    for (const tl of wc.tax_lines) {
      const id = tl.rate_id
      const fromLines = wc.line_items.flatMap(li => li.taxes).filter(t => t.id === id).reduce((s, t) => s + cents(t.total), 0)
      expect(cents(tl.tax_total)).toBe(fromLines)
    }
  })

  it('unique line ids, also with the same variant twice in one bundle', () => {
    const twice: BI[] = [
      { key: 'a', variant: 'w', product: 'p', quantity: 1, price: 1000, vatRate: 13 },
      { key: 'b', variant: 'w', product: 'p', quantity: 1, price: 1000, vatRate: 13 },
    ]
    const wc = map(bundleOrder(1, twice, { loose: [{ price: 500, quantity: 1, vatRate: 20 }] }))
    const ids = wc.line_items.map(li => li.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(map(bundleOrder(1, twice)).line_items.map(li => li.id)).toEqual(map(bundleOrder(1, twice)).line_items.map(li => li.id))
  })

  it('older bundle orders without items stay one line', () => {
    const wc = map(bundleOrder(1, boxItems, { withItems: false }))
    expect(wc.line_items).toHaveLength(1)
    expect(wc.line_items[0].name).toBe('Weinbox - 2× Wein, 1× Saft')
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

describe('wc-api auth and params', () => {
  const basic = (v: string) => ({ authorization: `Basic ${v}` })
  const call = (path: string, headers: Record<string, string> = {}) =>
    createWcApiHandler()(new Request(`https://shop.test/wp-json/wc/v3/${path}`, { headers }), {} as never)

  it('a malformed Basic header → 401, not a throw', async () => {
    process.env.WC_CONSUMER_KEY = 'ck_x'
    process.env.WC_CONSUMER_SECRET = 'cs_x'
    expect((await call('system_status', basic('%%%not-base64'))).status).toBe(401)
    expect((await call('system_status', basic(btoa('no-colon')))).status).toBe(401)
  })

  it('a secret containing ":" authenticates; a wrong one does not', async () => {
    process.env.WC_CONSUMER_KEY = 'ck_x'
    process.env.WC_CONSUMER_SECRET = 'cs:with:colons'
    expect((await call('system_status', basic(btoa('ck_x:cs:with:colons')))).status).toBe(200)
    expect((await call('system_status', basic(btoa('ck_x:cs:with')))).status).toBe(401)
    expect((await call('system_status?consumer_key=ck_x&consumer_secret=nope')).status).toBe(401)
  })

  it('an invalid after/before date → 400 rest_invalid_param', async () => {
    process.env.WC_CONSUMER_KEY = 'ck_x'
    process.env.WC_CONSUMER_SECRET = 'cs_x'
    const auth = basic(btoa('ck_x:cs_x'))
    for (const q of ['after=not-a-date', 'before=2026-13-45T99:00:00']) {
      const res = await call(`orders?${q}`, auth)
      expect(res.status).toBe(400)
      expect((await res.json()).code).toBe('rest_invalid_param')
    }
  })
})

describe('wc-api completedMeans: accepted — reported status', () => {
  const base = order([{ price: 1500, quantity: 1, vatRate: 13 }])
  const accepted = { ...base, erpAcceptedAt: '2026-11-17T10:00:00Z' }
  const status = (o: SanityOrder, mode?: 'shipped' | 'accepted') => mapOrder(o, 'Europe/Vienna', mode).status

  it('an accepted undispatched order reports completed, also with an open withdrawal', () => {
    expect(status({ ...accepted, status: 'created' }, 'accepted')).toBe('completed')
    expect(status({ ...accepted, status: 'processing' }, 'accepted')).toBe('completed')
    expect(status({ ...accepted, status: 'processing', hasOpenWithdrawal: true }, 'accepted')).toBe('completed')
  })

  it('fully refunded still wins', () => {
    expect(status({ ...accepted, paymentStatus: 'refunded' }, 'accepted')).toBe('refunded')
  })

  it('without erpAcceptedAt, or in shipped mode, as before', () => {
    expect(status({ ...base, status: 'processing' }, 'accepted')).toBe('processing')
    expect(status({ ...accepted, status: 'processing' }, 'shipped')).toBe('processing')
    expect(status({ ...accepted, status: 'processing' })).toBe('processing')
    expect(status({ ...accepted, hasOpenWithdrawal: true })).toBe('cancelled')
    expect(status({ ...accepted, status: 'canceled' }, 'accepted')).toBe('cancelled')
  })
})

describe('wc-api statusFilter', () => {
  const poll = ['pending', 'processing', 'on-hold']

  it('shipped mode keeps the plain filter', () => {
    expect(statusFilter(poll, 'shipped')).toEqual({
      filter: 'status in $statuses', params: { statuses: ['created', 'processing'] },
    })
    expect(statusFilter([], 'shipped')).toEqual({ filter: null, params: {} })
    expect(statusFilter(['pending'], 'accepted')).toEqual({ filter: 'false', params: {} })
  })

  it('accepted mode: processing excludes accepted undispatched orders, completed includes them', () => {
    const p = statusFilter(poll, 'accepted')
    expect(p.filter).toBe(
      '((status in $statuses && !(defined(erpAcceptedAt) && status in ["created","processing"])) '
      + '|| ($wantsCompleted && defined(erpAcceptedAt) && status in ["created","processing"]))',
    )
    expect(p.params).toEqual({ statuses: ['created', 'processing'], wantsCompleted: false })
    expect(statusFilter(['completed'], 'accepted').params)
      .toEqual({ statuses: ['shipped', 'delivered'], wantsCompleted: true })
  })
})

describe('wc-api PUT orders/:id', () => {
  type Chain = Record<'set' | 'setIfMissing' | 'unset' | 'append' | 'commit', ReturnType<typeof vi.fn>>
  let chain: Chain

  beforeEach(() => {
    process.env.WC_CONSUMER_KEY = 'ck_x'
    process.env.WC_CONSUMER_SECRET = 'cs_x'
    chain = {} as Chain
    for (const k of ['set', 'setIfMissing', 'unset', 'append'] as const) chain[k] = vi.fn(() => chain)
    chain.commit = vi.fn(async () => ({}))
    sanity.client.patch = vi.fn(() => chain)
    vi.mocked(sendOrderNotification).mockReset().mockResolvedValue(undefined as never)
  })

  async function put(o: Partial<SanityOrder>, wcStatus: string, completedMeans?: 'shipped' | 'accepted') {
    sanity.client.fetch = vi.fn(async () => ({ ...order([{ price: 1500, quantity: 1, vatRate: 13 }]), ...o }))
    const handler = createWcApiHandler({ completedMeans, notify: {} as never })
    const res = await handler(new Request('https://shop.test/wp-json/wc/v3/orders/1', {
      method: 'PUT',
      headers: { authorization: `Basic ${btoa('ck_x:cs_x')}`, 'content-type': 'application/json' },
      body: JSON.stringify({ status: wcStatus }),
    }), { waitUntil: vi.fn() } as never)
    return { res, body: await res.json() }
  }
  const appended = () => chain.append.mock.calls.flatMap(([, entries]) => entries as Array<{ type: string; status: string }>)
    .map(e => `${e.type}/${e.status}`)

  it('accepted: completed on created → processing + erpAcceptedAt, no mail, reported completed', async () => {
    const { res, body } = await put({ status: 'created' }, 'completed', 'accepted')
    expect(res.status).toBe(200)
    expect(chain.set).toHaveBeenCalledWith({ status: 'processing' })
    expect(chain.setIfMissing).toHaveBeenCalledWith({ erpAcceptedAt: expect.any(String) })
    expect(appended()).toEqual(['erp/accepted', 'fulfillment/processing'])
    expect(sendOrderNotification).not.toHaveBeenCalled()
    expect(body.status).toBe('completed')
  })

  it('accepted: completed on a shipped order → status untouched, only the erp entry', async () => {
    const { body } = await put({ status: 'shipped' }, 'completed', 'accepted')
    expect(chain.set).not.toHaveBeenCalled()
    expect(appended()).toEqual(['erp/accepted'])
    expect(body.status).toBe('completed')
  })

  it('accepted: a repeat PUT appends nothing', async () => {
    const { body } = await put({ status: 'processing', erpAcceptedAt: '2026-11-17T10:00:00Z' }, 'completed', 'accepted')
    expect(chain.set).not.toHaveBeenCalled()
    expect(chain.append).not.toHaveBeenCalled()
    expect(chain.setIfMissing).toHaveBeenCalled()
    expect(body.status).toBe('completed')
  })

  it('accepted: refunded / withdrawn / canceled → 409', async () => {
    for (const o of [{ paymentStatus: 'refunded' }, { hasOpenWithdrawal: true }, { status: 'canceled' }]) {
      const { res } = await put(o, 'completed', 'accepted')
      expect(res.status).toBe(409)
    }
    expect(chain.commit).not.toHaveBeenCalled()
  })

  it('accepted: processing takes the acceptance back', async () => {
    const { body } = await put({ status: 'processing', erpAcceptedAt: '2026-11-17T10:00:00Z' }, 'processing', 'accepted')
    expect(chain.unset).toHaveBeenCalledWith(['erpAcceptedAt'])
    expect(chain.set).toHaveBeenCalledWith({ status: 'processing' })
    expect(body.status).toBe('processing')
  })

  it('shipped (default): completed still ships and notifies', async () => {
    const { body } = await put({ status: 'processing' }, 'completed')
    expect(chain.set).toHaveBeenCalledWith({ status: 'shipped' })
    expect(chain.setIfMissing).not.toHaveBeenCalled()
    expect(chain.unset).not.toHaveBeenCalled()
    expect(appended()).toEqual(['fulfillment/shipped'])
    expect(sendOrderNotification).toHaveBeenCalledOnce()
    expect(body.status).toBe('completed')
  })
})

/** An old-shape order as `itsshops sanity migrate-discounts` patches it. */
function migrated(order: OrderLike): OrderLike {
  const m = migrateOrderDiscounts(order)
  if (!m) return order
  const { appliedCoupons: _old, ...rest } = order
  return {
    ...rest,
    orderItems: m.orderItems,
    ...(m.appliedDiscounts.length > 0 && { appliedDiscounts: m.appliedDiscounts }),
    ...(m.freeShippingReason && order.fulfillment && {
      fulfillment: { ...order.fulfillment, freeShippingReason: m.freeShippingReason },
    }),
  }
}

describe('wc-api — orders migrated from the coupon shape', () => {
  const fixtures = legacy as unknown as { order: SanityOrder & OrderLike; wc: unknown }[]
  it.each(fixtures.map(f => [f.order.orderNumber, f] as const))(
    'order %s: mapOrder(migrated) equals what wineNET already received',
    (_n, f) => {
      const order = migrated(structuredClone(f.order)) as unknown as SanityOrder
      expect(JSON.stringify(map(order))).toBe(JSON.stringify(f.wc))
    },
  )
})
