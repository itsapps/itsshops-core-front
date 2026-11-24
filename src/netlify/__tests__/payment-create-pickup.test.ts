import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Context } from '@netlify/functions'
import type { SanityCheckoutQueryResult, SanityShippingMethodResult } from '../types/checkout'

const fetchCheckoutData = vi.hoisted(() => vi.fn())
vi.mock('../services/sanity', () => ({
  fetchCheckoutData,
  createOrderMeta: vi.fn(),
  fetchOrderMeta: vi.fn(),
  countOrdersWithDiscountForEmail: vi.fn(),
}))
const createPaymentIntent = vi.hoisted(() => vi.fn())
vi.mock('../services/stripe', () => ({ createPaymentIntent, updatePaymentIntent: vi.fn() }))
vi.mock('../utils/logger', () => ({ log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() } }))

import { createPaymentHandler } from '../functions/payment-create'
import { createOrderMeta } from '../services/sanity'

const handler = createPaymentHandler({ defaultLocale: 'de', features: { shop: { coupons: true } } } as never)

const de = (value: string) => [{ language: 'de', value }]

// AT 13 % wine; DE 19 % wine (different rates, so the tax country is visible in the totals).
const AT = { countryCode: 'AT', rules: [{ taxCategoryCode: 'wine', rate: 13 }] }
const DE = { countryCode: 'DE', rules: [{ taxCategoryCode: 'wine', rate: 19 }] }

const delivery = (id: string, price = 700): SanityShippingMethodResult => ({
  _id: id, title: de('DPD'), methodType: 'delivery', pickupFee: null, freeShippingThreshold: null,
  taxCategoryCode: null, rates: [{ maxWeight: 100, price }], packagingGroups: null,
})
const pickup = (over: Partial<SanityShippingMethodResult> = {}): SanityShippingMethodResult => ({
  _id: 'pu1', title: de('Abholung im Weingut'), methodType: 'pickup', pickupFee: 0,
  freeShippingThreshold: null, taxCategoryCode: null, rates: null, packagingGroups: null,
  pickupAddress: { line1: 'Eisenstätter Straße 10', line2: null, zip: '7061', city: de('Trausdorf'), country: 'AT' },
  pickupInstructions: de('Mo–Fr 9–17'),
  pickupHoldDays: 14,
  pickupAnnounceReady: true,
  deliveryTime: de('1–2 Werktage'),
  ...over,
})

function data(country: 'AT' | 'DE' | 'CH', methods: SanityShippingMethodResult[], codeDiscount: unknown = null): SanityCheckoutQueryResult {
  return {
    variants: [{
      _id: 'v1', status: 'active', kind: 'wine', title: de('Blaufränkisch'), sku: null, price: 11900,
      weight: 1300, stock: null, productId: 'p1', taxCategoryCode: 'wine', productTitle: de('Blaufränkisch'),
      productWeight: null, productPrice: null, productTaxCategoryCode: null,
      wine: { vintage: '2022', volume: 750 }, options: null, bundleItems: null,
    }],
    taxCountry: country === 'AT' ? AT : country === 'DE' ? DE : null,
    shippingMethods: methods,
    pickupTaxCountries: [AT],
    shopSettings: {
      defaultCountryCode: 'AT', freeShippingCalculation: 'beforeDiscount', defaultTaxCategoryCode: 'wine',
      orderNumberPrefix: null, invoiceNumberPrefix: null, lastInvoiceNumber: 0,
    },
    supportedCountries: [{ countryCode: 'AT' }, { countryCode: 'DE' }],
    categories: [],
    codeDiscount: codeDiscount as never,
    automaticDiscounts: [],
  }
}

const address = (country: string) => ({
  name: 'Max Muster', prename: 'Max', lastname: 'Muster', line1: 'Hauptstr. 1', zip: '80331', city: 'München', country,
})

async function call(body: Record<string, unknown>) {
  const res = await handler(new Request('https://shop.example/api/payment/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cart: { items: [{ variantId: 'v1', quantity: 1 }] }, locale: 'de', createPayment: false, ...body }),
  }), {} as Context)
  return { status: res.status, body: await res.json() }
}

describe('payment-create — pickup', () => {
  beforeEach(() => {
    fetchCheckoutData.mockReset()
    vi.mocked(createOrderMeta).mockReset()
    createPaymentIntent.mockReset().mockResolvedValue({ id: 'pi_1', client_secret: 'pi_1_secret_x' })
  })

  it('lists pickup next to delivery; default selection stays delivery; response carries pickup fields', async () => {
    fetchCheckoutData.mockResolvedValue(data('DE', [delivery('dpd-de'), pickup()]))
    const { body } = await call({ partialAddress: { country: 'DE' } })
    expect(body.selectedShippingMethodId).toBe('dpd-de')
    const pu = body.shippingMethods.find((m: { _id: string }) => m._id === 'pu1')
    expect(pu).toMatchObject({
      methodType: 'pickup', deliveryTime: '1–2 Werktage', pickupHoldDays: 14, pickupAnnounceReady: true, pickupInstructions: 'Mo–Fr 9–17',
      pickupAddress: { line1: 'Eisenstätter Straße 10', zip: '7061', city: 'Trausdorf', country: 'AT' },
    })
    // DE address, delivery → DE rules (19 %)
    expect(body.totals.vatBreakdown.map((v: { rate: number }) => v.rate)).toEqual([19])
  })

  it('pickup from a DE address is taxed by the pickup country (AT 13 %)', async () => {
    fetchCheckoutData.mockResolvedValue(data('DE', [delivery('dpd-de'), pickup()]))
    const { body } = await call({ partialAddress: { country: 'DE' }, shippingMethodId: 'pu1' })
    expect(body.selectedShippingMethodId).toBe('pu1')
    expect(body.totals.vatBreakdown.map((v: { rate: number }) => v.rate)).toEqual([13])
    expect(body.totals.shipping).toBe(0)
  })

  it('tax country with pickups but no delivery: no silent pickup (selection null)', async () => {
    fetchCheckoutData.mockResolvedValue(data('DE', [pickup()]))
    const { body } = await call({ partialAddress: { country: 'DE' } })
    expect(body.selectedShippingMethodId).toBeNull()
    const created = await call({ createPayment: true, address: { shipping: address('DE'), contactEmail: 'm@x.de' } })
    expect(created.body.error.code).toBe('SHIPPING_UNAVAILABLE')
  })

  it('non-tax country (CH): pickups only, pickup country rules; without a pickup id no order', async () => {
    fetchCheckoutData.mockResolvedValue(data('CH', [pickup()]))
    const calc = await call({ partialAddress: { country: 'CH' } })
    expect(calc.status).toBe(200)
    expect(calc.body.shippingMethods.map((m: { _id: string }) => m._id)).toEqual(['pu1'])
    expect(calc.body.selectedShippingMethodId).toBeNull()
    expect(calc.body.totals.vatBreakdown.map((v: { rate: number }) => v.rate)).toEqual([13])

    const noId = await call({ createPayment: true, address: { shipping: address('CH'), contactEmail: 'm@x.ch' } })
    expect(noId.body.error.code).toBe('SHIPPING_UNAVAILABLE')
    // a delivery id for that country → still nothing (only pickups exist)
    const deliveryId = await call({ createPayment: true, shippingMethodId: 'dpd-de', address: { shipping: address('CH'), contactEmail: 'm@x.ch' } })
    expect(deliveryId.body.error.code).toBe('SHIPPING_UNAVAILABLE')
  })

  it('CH + pickup id: order meta has the billing address only and the pickup snapshot', async () => {
    fetchCheckoutData.mockResolvedValue(data('CH', [pickup()]))
    const { status } = await call({
      createPayment: true, shippingMethodId: 'pu1', address: { shipping: address('CH'), contactEmail: 'm@x.ch' },
    })
    expect(status).toBe(200)
    const meta = vi.mocked(createOrderMeta).mock.calls[0][1]
    expect(meta.customer).not.toHaveProperty('shippingAddress')
    expect(meta.customer.billingAddress.country).toBe('CH')
    expect(meta.fulfillment.methodType).toBe('pickup')
    expect(meta.fulfillment.pickupAddress).toEqual({ line1: 'Eisenstätter Straße 10', zip: '7061', city: 'Trausdorf', country: 'AT' })
    expect(meta.fulfillment.pickupHoldDays).toBe(14)
    expect(meta.fulfillment.pickupAnnounceReady).toBe(true)
  })

  it('no pickup method + non-tax country → SHIPPING_UNAVAILABLE as before', async () => {
    fetchCheckoutData.mockResolvedValue(data('CH', [delivery('dpd-de')]))
    const { body } = await call({ partialAddress: { country: 'CH' } })
    expect(body.error.code).toBe('SHIPPING_UNAVAILABLE')
  })

  it('an invalid country code is rejected', async () => {
    const { body } = await call({ partialAddress: { country: 'XX' } })
    expect(body.error.code).toBe('INVALID_ADDRESS')
    expect(fetchCheckoutData).not.toHaveBeenCalled()
  })

  it('a pickup method without a country is taxed by the default country, not dropped', async () => {
    fetchCheckoutData.mockResolvedValue(data('DE', [delivery('dpd-de'), pickup({
      pickupAddress: { line1: 'X', line2: null, zip: '1', city: de('Y'), country: null },
    })]))
    const { body } = await call({ partialAddress: { country: 'DE' }, shippingMethodId: 'pu1' })
    expect(body.selectedShippingMethodId).toBe('pu1')
    expect(body.totals.vatBreakdown.map((v: { rate: number }) => v.rate)).toEqual([13])
  })

  it('a pickup whose country is no tax country is dropped', async () => {
    fetchCheckoutData.mockResolvedValue(data('DE', [delivery('dpd-de'), pickup({
      pickupAddress: { line1: 'X', line2: null, zip: '1', city: de('Y'), country: 'IT' },
    })]))
    const { body } = await call({ partialAddress: { country: 'DE' }, shippingMethodId: 'pu1' })
    expect(body.shippingMethods.map((m: { _id: string }) => m._id)).toEqual(['dpd-de'])
  })

  it('free-shipping code: free pickup accepted with 0 discount; a pickup fee is waived', async () => {
    const code = {
      _id: 'discount-c1', title: de('Gratis Versand'), trigger: 'code', code: 'FREE', enabled: true,
      target: 'shipping', valueType: 'free', value: null, appliesTo: null, appliesToPickup: true,
      minSubtotalBasis: 'wholeCart', redemptionCount: 0, combinesWith: { items: false, order: false, shipping: true },
    }
    fetchCheckoutData.mockResolvedValue(data('AT', [delivery('dpd-at'), pickup()], code))
    const free = await call({ partialAddress: { country: 'AT' }, shippingMethodId: 'pu1', appliedCouponCode: 'FREE' })
    expect(free.body.appliedDiscounts).toEqual([expect.objectContaining({ code: 'FREE', trigger: 'code', amount: 0 })])

    fetchCheckoutData.mockResolvedValue(data('AT', [delivery('dpd-at'), pickup({ pickupFee: 300 })], code))
    const paid = await call({ partialAddress: { country: 'AT' }, shippingMethodId: 'pu1', appliedCouponCode: 'FREE' })
    expect(paid.body.totals.shipping).toBe(0)
    expect(paid.body.appliedDiscounts[0].amount).toBe(300)
  })
})
