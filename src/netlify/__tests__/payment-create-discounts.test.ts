import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Context } from '@netlify/functions'
import type { SanityCheckoutQueryResult, SanityShippingMethodResult, SanityVariantResult } from '../types/checkout'
import type { RawDiscount } from '../../shared/discounts'

const fetchCheckoutData = vi.hoisted(() => vi.fn())
const countOrdersWithDiscountForEmail = vi.hoisted(() => vi.fn())
const fetchOrderMeta = vi.hoisted(() => vi.fn())
vi.mock('../services/sanity', () => ({
  fetchCheckoutData,
  createOrderMeta: vi.fn(),
  fetchOrderMeta,
  countOrdersWithDiscountForEmail,
}))
const createPaymentIntent = vi.hoisted(() => vi.fn())
const updatePaymentIntent = vi.hoisted(() => vi.fn())
vi.mock('../services/stripe', () => ({ createPaymentIntent, updatePaymentIntent }))
vi.mock('../utils/logger', () => ({ log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() } }))

import { createPaymentHandler } from '../functions/payment-create'
import { createOrderMeta } from '../services/sanity'

const handler = createPaymentHandler({ defaultLocale: 'de', features: { shop: { coupons: true } } } as never)
const de = (value: string) => [{ language: 'de', value }]
const AT = { countryCode: 'AT', rules: [{ taxCategoryCode: 'wine', rate: 13 }, { taxCategoryCode: 'juice', rate: 20 }] }

const delivery = (id: string, price: number, threshold: number | null = null): SanityShippingMethodResult => ({
  _id: id, title: de(id), methodType: 'delivery', pickupFee: null, freeShippingThreshold: threshold,
  taxCategoryCode: null, rates: [{ maxWeight: 100, price }], packagingGroups: null,
})
const pickup = (fee: number): SanityShippingMethodResult => ({
  _id: 'pu1', title: de('Abholung'), methodType: 'pickup', pickupFee: fee, freeShippingThreshold: null,
  taxCategoryCode: null, rates: null, packagingGroups: null,
  pickupAddress: { line1: 'Hauptstr. 1', line2: null, zip: '7061', city: de('Trausdorf'), country: 'AT' },
})

const wine = (id: string, price: number, over: Partial<SanityVariantResult> = {}): SanityVariantResult => ({
  _id: id, status: 'active', kind: 'wine', title: de(id), sku: null, price, weight: 1300, stock: null,
  productId: `p-${id}`, taxCategoryCode: 'wine', productTitle: de(id), productWeight: null, productPrice: null,
  productTaxCategoryCode: null, wine: { vintage: '2022', volume: 750 }, options: null, bundleItems: null, ...over,
})
const bundle = (id: string, price: number): SanityVariantResult => ({
  ...wine(id, price), kind: 'bundle', wine: null, taxCategoryCode: null,
  bundleItems: [{ _key: 'a', quantity: 2, variant: { ...wine(`${id}-w`, 1500), weight: 1300 } as never }],
})

const raw = (over: Partial<RawDiscount> = {}): RawDiscount => ({
  _id: 'discount-c1', title: de('Sommer'), trigger: 'code', code: 'TEN', enabled: true,
  target: 'order', valueType: 'percent', value: 10, appliesTo: null, minSubtotalBasis: 'wholeCart',
  redemptionCount: 0, combinesWith: { shipping: true }, ...over,
})
const bundleShipping = raw({
  _id: 'discount-product-free-shipping', title: de('Versandkostenfrei mit Weinpaket'), trigger: 'automatic',
  code: null, target: 'shipping', valueType: 'free', value: null,
  appliesTo: { include: { kinds: ['bundle'] } }, appliesToPickup: false, combinesWith: { items: true, order: true },
})

function data(o: {
  variants: SanityVariantResult[]
  methods: SanityShippingMethodResult[]
  code?: RawDiscount | null
  automatic?: RawDiscount[]
  exclusions?: SanityCheckoutQueryResult['shopSettings']['discountExclusions']
  calc?: 'beforeDiscount' | 'afterDiscount'
}): SanityCheckoutQueryResult {
  return {
    variants: o.variants,
    taxCountry: AT,
    shippingMethods: o.methods,
    pickupTaxCountries: [AT],
    shopSettings: {
      defaultCountryCode: 'AT', freeShippingCalculation: o.calc ?? 'beforeDiscount', defaultTaxCategoryCode: 'wine',
      orderNumberPrefix: null, invoiceNumberPrefix: null, lastInvoiceNumber: 0, discountExclusions: o.exclusions ?? null,
    },
    supportedCountries: [{ countryCode: 'AT' }],
    categories: [],
    codeDiscount: o.code ?? null,
    automaticDiscounts: o.automatic ?? [],
  }
}

const address = { name: 'Max Muster', line1: 'Hauptstr. 1', zip: '7000', city: 'Eisenstadt', country: 'AT' }

async function call(items: { variantId: string; quantity: number }[], body: Record<string, unknown> = {}) {
  const res = await handler(new Request('https://shop.example/api/payment/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cart: { items }, locale: 'de', createPayment: false, partialAddress: { country: 'AT' }, ...body }),
  }), {} as Context)
  return { status: res.status, body: await res.json() }
}

describe('payment-create — discounts', () => {
  beforeEach(() => {
    fetchCheckoutData.mockReset()
    countOrdersWithDiscountForEmail.mockReset().mockResolvedValue(0)
    fetchOrderMeta.mockReset()
    vi.mocked(createOrderMeta).mockReset()
    createPaymentIntent.mockReset().mockResolvedValue({ id: 'pi_1', client_secret: 'pi_1_secret_x' })
    updatePaymentIntent.mockReset().mockResolvedValue({ id: 'pi_1', client_secret: 'pi_1_secret_x' })
  })

  it('automatic bundle shipping: default pick = cheapest real price, every delivery shown free, pickup not', async () => {
    fetchCheckoutData.mockResolvedValue(data({
      variants: [bundle('b1', 3000)],
      // Query order puts the expensive method first — a tie at 0 used to pick it.
      methods: [delivery('express', 1500), delivery('standard', 700), pickup(300)],
      automatic: [bundleShipping],
    }))
    const { body } = await call([{ variantId: 'b1', quantity: 1 }])
    expect(body.selectedShippingMethodId).toBe('standard')
    expect(body.totals.shipping).toBe(0)
    expect(body.totals.grandTotal).toBe(3000)
    const byId = Object.fromEntries(body.shippingMethods.map((m: { _id: string; price: number }) => [m._id, m.price]))
    expect(byId).toEqual({ express: 0, standard: 0, pu1: 300 })
    expect(body.appliedDiscounts).toEqual([
      { title: 'Versandkostenfrei mit Weinpaket', trigger: 'automatic', target: 'shipping', amount: 700 },
    ])
  })

  it('exclusions: a code skips the bundle, the hint lists it, the order stores line discounts', async () => {
    fetchCheckoutData.mockResolvedValue(data({
      variants: [bundle('b1', 3000), wine('w1', 2000)],
      methods: [delivery('standard', 700)],
      code: raw(),
      automatic: [bundleShipping],
      exclusions: { include: { kinds: ['bundle'] } },
    }))
    const items = [{ variantId: 'b1', quantity: 1 }, { variantId: 'w1', quantity: 1 }]
    const { body } = await call(items, { appliedCouponCode: 'TEN' })
    expect(body.totals.discount).toBe(200)
    expect(body.notDiscountedVariantIds).toEqual(['b1'])
    expect(body.appliedDiscounts.map((d: { trigger: string; amount: number }) => [d.trigger, d.amount])).toEqual([
      ['code', 200], ['automatic', 700],
    ])

    await call(items, { appliedCouponCode: 'TEN', createPayment: true, address: { shipping: address, contactEmail: 'a@b.at' } })
    const meta = vi.mocked(createOrderMeta).mock.calls[0][1]
    expect(meta.orderItems.map(i => i.discount)).toEqual([undefined, 200])
    expect(meta.appliedDiscounts!.map(d => d.discountRef?._ref)).toEqual(['discount-c1', 'discount-product-free-shipping'])
    expect(meta.fulfillment.freeShippingReason).toBe('discount')
    expect(meta).not.toHaveProperty('appliedCoupons')
  })

  it('afterDiscount threshold sees the subtotal minus items + order discounts', async () => {
    const setup = (calc: 'beforeDiscount' | 'afterDiscount') => data({
      variants: [wine('w1', 10000)], methods: [delivery('standard', 700, 10000)], code: raw(), calc,
    })
    fetchCheckoutData.mockResolvedValue(setup('beforeDiscount'))
    expect((await call([{ variantId: 'w1', quantity: 1 }], { appliedCouponCode: 'TEN' })).body.totals.shipping).toBe(0)
    fetchCheckoutData.mockResolvedValue(setup('afterDiscount'))
    expect((await call([{ variantId: 'w1', quantity: 1 }], { appliedCouponCode: 'TEN' })).body.totals.shipping).toBe(700)
  })

  it('per-email limit: checked on createPayment only; over the limit the code is dropped with its error', async () => {
    fetchCheckoutData.mockResolvedValue(data({
      variants: [wine('w1', 2000)], methods: [delivery('standard', 700)], code: raw({ maxPerEmail: 1 }),
    }))
    const items = [{ variantId: 'w1', quantity: 1 }]
    const calc = await call(items, { appliedCouponCode: 'TEN' })
    expect(calc.body.totals.discount).toBe(200)
    expect(countOrdersWithDiscountForEmail).not.toHaveBeenCalled()

    countOrdersWithDiscountForEmail.mockResolvedValue(1)
    const created = await call(items, { appliedCouponCode: 'TEN', createPayment: true, address: { shipping: address, contactEmail: 'A@B.at' } })
    expect(countOrdersWithDiscountForEmail).toHaveBeenCalledWith('discount-c1', 'A@B.at')
    expect(created.body.totals.discount).toBe(0)
    expect(created.body.appliedDiscounts).toEqual([])
    expect(created.body.couponError).toMatchObject({ code: 'TEN', errorCode: 'COUPON_LIMIT_PER_EMAIL' })
    expect(createPaymentIntent.mock.calls[0][0].amount).toBe(2700)
  })

  it('COUPON_NOT_COMBINABLE names the winning automatic discount', async () => {
    const auto = raw({ _id: 'auto', title: de('Herbstaktion'), trigger: 'automatic', code: null, value: 20, combinesWith: {} })
    fetchCheckoutData.mockResolvedValue(data({ variants: [wine('w1', 2000)], methods: [delivery('standard', 700)], code: raw(), automatic: [auto] }))
    const { body } = await call([{ variantId: 'w1', quantity: 1 }], { appliedCouponCode: 'TEN' })
    expect(body.totals.discount).toBe(400)
    expect(body.couponError).toMatchObject({ errorCode: 'COUPON_NOT_COMBINABLE', discountTitle: 'Herbstaktion' })
  })

  it('a total below Stripe minimum (100 % code + free shipping): clear error, no PaymentIntent', async () => {
    fetchCheckoutData.mockResolvedValue(data({
      variants: [bundle('b1', 3000)], methods: [delivery('standard', 700)],
      code: raw({ value: 100 }), automatic: [bundleShipping],
    }))
    const items = [{ variantId: 'b1', quantity: 1 }]
    const calc = await call(items, { appliedCouponCode: 'ten' })
    expect(calc.status).toBe(200)
    expect(calc.body.totals.grandTotal).toBe(0)

    const created = await call(items, { appliedCouponCode: 'TEN', createPayment: true, address: { shipping: address, contactEmail: 'a@b.at' } })
    expect(created.status).toBe(400)
    expect(created.body.error).toMatchObject({ code: 'ORDER_TOTAL_BELOW_MINIMUM', message: 'Der Bestellbetrag muss mindestens 0,50 € betragen' })
    expect(createPaymentIntent).not.toHaveBeenCalled()
    expect(createOrderMeta).not.toHaveBeenCalled()
  })

  it('passes the typed code on as typed (the query matches case-insensitively)', async () => {
    fetchCheckoutData.mockResolvedValue(data({ variants: [wine('w1', 2000)], methods: [delivery('standard', 700)], code: raw() }))
    const { body } = await call([{ variantId: 'w1', quantity: 1 }], { appliedCouponCode: ' ten ' })
    expect(fetchCheckoutData.mock.calls[0][2]).toBe('ten')
    expect(body.appliedDiscounts[0]).toMatchObject({ code: 'TEN', trigger: 'code' })
  })

  it('re-submit replaces the orderMeta (a dropped code leaves no entry)', async () => {
    fetchCheckoutData.mockResolvedValue(data({ variants: [wine('w1', 2000)], methods: [delivery('standard', 700)] }))
    fetchOrderMeta.mockResolvedValue({ _id: 'orderMeta-1', paymentIntentId: 'pi_1', appliedCoupons: [{ code: 'OLD' }] })
    await call([{ variantId: 'w1', quantity: 1 }], {
      createPayment: true, orderMetaId: 'orderMeta-1', address: { shipping: address, contactEmail: 'a@b.at' },
    })
    const [id, meta] = vi.mocked(createOrderMeta).mock.calls[0]
    expect(id).toBe('orderMeta-1')
    expect(meta).not.toHaveProperty('appliedDiscounts')
    expect(meta).not.toHaveProperty('appliedCoupons')
  })
})
