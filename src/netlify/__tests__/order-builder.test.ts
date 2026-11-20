import { describe, it, expect } from 'vitest'
import {
  buildOrderMeta,
  buildOrder,
  buildAppliedDiscountSnapshots,
  formatOrderNumber,
  type BuildOrderMetaInput,
} from '../lib/order-builder'
import { discount, bundleFreeShipping } from '../../shared/__tests__/discounts-fixtures'
import type { ValidatedCartItem, AvailableShippingMethod, CalculatedTotals } from '../types/checkout'

function makeInput(overrides: Partial<BuildOrderMetaInput> = {}): BuildOrderMetaInput {
  const items: ValidatedCartItem[] = [{
    variantId: 'v1',
    productId: 'p1',
    kind: 'wine',
    title: 'Blaufränkisch',
    subtitle: '2023 · 750 ml',
    sku: 'BF-2023',
    price: 1500,
    weight: 1200,
    quantity: 2,
    taxCategoryCode: 'standard',
    vatRate: 20,
    vatAmount: 500,
    wine: { vintage: '2023', volume: 750 },
    options: null,
    bundleItems: null,
    selector: { variantId: 'v1', productId: 'p1', kind: 'wine', categoryIds: [], manufacturerIds: [], hasCompareAtPrice: false },
  }]

  const selectedShipping: AvailableShippingMethod = {
    _id: 'sm1',
    title: 'Standard Shipping',
    methodType: 'delivery',
    price: 500,
    isFree: false,
    taxCategoryCode: 'standard',
  }

  const totals: CalculatedTotals = {
    subtotal: 3000,
    shipping: 500,
    discount: 0,
    tax: 583,
    grandTotal: 3500,
    vatBreakdown: [{ rate: 20, net: 2917, vat: 583 }],
  }

  return {
    items,
    totals,
    selectedShipping,
    shippingVatRate: 20,
    shippingAddress: {
      name: 'Max Mustermann',
      prename: 'Max',
      lastname: 'Mustermann',
      line1: 'Hauptstr. 1',
      zip: '7000',
      city: 'Eisenstadt',
      country: 'AT',
    },
    billingAddress: {
      name: 'Max Mustermann',
      prename: 'Max',
      lastname: 'Mustermann',
      line1: 'Rechnungsstr. 2',
      zip: '1010',
      city: 'Wien',
      country: 'AT',
    },
    contactEmail: 'max@example.com',
    locale: 'de',
    paymentIntentId: 'pi_test123',
    ...overrides,
  }
}

describe('buildOrderMeta', () => {
  it('builds a complete orderMeta document', () => {
    const meta = buildOrderMeta(makeInput())
    expect(meta._type).toBe('orderMeta')
    expect(meta.paymentIntentId).toBe('pi_test123')
  })

  it('builds correct orderItems', () => {
    const meta = buildOrderMeta(makeInput())
    expect(meta.orderItems).toHaveLength(1)
    const item = meta.orderItems[0]
    expect(item._type).toBe('orderItem')
    expect(item.kind).toBe('wine')
    expect(item.variantId).toBe('v1')
    expect(item.price).toBe(1500)
    expect(item.quantity).toBe(2)
    expect(item.vatRate).toBe(20)
    expect(item.packed).toBe(false)
    expect(item.wine).toEqual({ _type: 'orderItemWine', vintage: '2023', volume: 750 })
  })

  it('builds correct customer', () => {
    const meta = buildOrderMeta(makeInput())
    expect(meta.customer._type).toBe('orderCustomer')
    expect(meta.customer.contactEmail).toBe('max@example.com')
    expect(meta.customer.locale).toBe('de')
    expect(meta.customer.shippingAddress!.city).toBe('Eisenstadt')
    expect(meta.customer.billingAddress.city).toBe('Wien')
  })

  it('builds correct totals', () => {
    const meta = buildOrderMeta(makeInput())
    expect(meta.totals._type).toBe('orderTotals')
    expect(meta.totals.grandTotal).toBe(3500)
    expect(meta.totals.subtotal).toBe(3000)
    expect(meta.totals.shipping).toBe(500)
    expect(meta.totals.currency).toBe('EUR')
    expect(meta.totals.vatBreakdown).toHaveLength(1)
    expect(meta.totals.vatBreakdown[0]._type).toBe('vatBreakdownItem')
  })

  it('builds correct fulfillment', () => {
    const meta = buildOrderMeta(makeInput())
    expect(meta.fulfillment._type).toBe('fulfillment')
    expect(meta.fulfillment.methodTitle).toBe('Standard Shipping')
    expect(meta.fulfillment.methodType).toBe('delivery')
    expect(meta.fulfillment.shippingCost).toBe(500)
    expect(meta.fulfillment.method._ref).toBe('sm1')
    expect(meta.fulfillment.method._weak).toBe(true)
    expect(meta.fulfillment.taxSnapshot._type).toBe('vatBreakdownItem')
    expect(meta.fulfillment.taxSnapshot.rate).toBe(20)
  })

  it('accepts name-only address (express checkout) without prename/lastname', () => {
    const input = makeInput({
      shippingAddress: {
        name: 'Apple Pay User',
        line1: 'Hauptstr. 1',
        zip: '7000',
        city: 'Eisenstadt',
        country: 'AT',
      },
      billingAddress: {
        name: 'Apple Pay User',
        line1: 'Hauptstr. 1',
        zip: '7000',
        city: 'Eisenstadt',
        country: 'AT',
      },
    })
    const meta = buildOrderMeta(input)
    expect(meta.customer.shippingAddress!.name).toBe('Apple Pay User')
    expect(meta.customer.shippingAddress!.prename).toBeUndefined()
    expect(meta.customer.shippingAddress!.lastname).toBeUndefined()
  })

  it('handles items with options', () => {
    const input = makeInput({
      items: [{
        variantId: 'v2',
        productId: 'p2',
        kind: 'physical',
        title: 'T-Shirt',
        subtitle: 'Size: Large · Color: Red',
        sku: 'TS-LR',
        price: 2500,
        weight: 200,
        quantity: 1,
        taxCategoryCode: 'standard',
        vatRate: 20,
        vatAmount: 417,
        wine: null,
        options: [
          { groupTitle: 'Size', optionTitle: 'Large' },
          { groupTitle: 'Color', optionTitle: 'Red' },
        ],
        bundleItems: null,
        selector: { variantId: 'v1', productId: 'p1', kind: 'wine', categoryIds: [], manufacturerIds: [], hasCompareAtPrice: false },
      }],
    })
    const meta = buildOrderMeta(input)
    const item = meta.orderItems[0]
    expect(item.options).toHaveLength(2)
    expect(item.options![0]._type).toBe('orderItemOption')
    expect(item.options![0].groupTitle).toBe('Size')
  })
})

describe('buildOrderMeta — free shipping reason', () => {
  const free = (o: Partial<BuildOrderMetaInput> = {}) => {
    const base = makeInput(o)
    return makeInput({
      selectedShipping: { ...base.selectedShipping, price: 0, isFree: true },
      totals: { ...base.totals, shipping: 0 },
      ...o,
    })
  }
  it('stores the reason for a delivery method at shipping 0', () => {
    expect(buildOrderMeta(free({ freeShippingReason: 'discount' })).fulfillment.freeShippingReason).toBe('discount')
  })
  it('no reason input → no field', () => {
    expect(buildOrderMeta(free()).fulfillment).not.toHaveProperty('freeShippingReason')
  })
  it('ignores a reason when shipping is charged', () => {
    expect(buildOrderMeta(makeInput({ freeShippingReason: 'discount' })).fulfillment).not.toHaveProperty('freeShippingReason')
  })
  it('ignores a reason for pickup', () => {
    const base = free()
    const meta = buildOrderMeta({ ...base, selectedShipping: { ...base.selectedShipping, methodType: 'pickup', pickupAddress: PICKUP_ADDRESS }, freeShippingReason: 'threshold' })
    expect(meta.fulfillment).not.toHaveProperty('freeShippingReason')
  })
})

const PICKUP_ADDRESS = { line1: 'Eisenstätter Straße 10', zip: '7061', city: 'Trausdorf', country: 'AT' }

describe('buildOrderMeta — pickup', () => {
  const pickupInput = (extra: Partial<AvailableShippingMethod> = {}) => {
    const base = makeInput()
    return makeInput({
      selectedShipping: {
        _id: 'pu1', title: 'Abholung im Weingut', methodType: 'pickup', price: 0, isFree: true,
        taxCategoryCode: null, pickupAddress: PICKUP_ADDRESS, ...extra,
      },
      totals: { ...base.totals, shipping: 0 },
    })
  }

  it('snapshots the pickup address, instructions and hold days; no shipping address', () => {
    const meta = buildOrderMeta(pickupInput({ pickupInstructions: 'Mo–Fr 9–17', pickupHoldDays: 14 }))
    expect(meta.fulfillment.pickupAddress).toEqual(PICKUP_ADDRESS)
    expect(meta.fulfillment.pickupInstructions).toBe('Mo–Fr 9–17')
    expect(meta.fulfillment.pickupHoldDays).toBe(14)
    // even though makeInput passes one
    expect(meta.customer).not.toHaveProperty('shippingAddress')
    expect(meta.customer.billingAddress.line1).toBe('Rechnungsstr. 2')
  })

  it('no line2 / instructions / hold days keys when empty', () => {
    const meta = buildOrderMeta(pickupInput())
    expect(meta.fulfillment.pickupAddress).not.toHaveProperty('line2')
    expect(meta.fulfillment).not.toHaveProperty('pickupInstructions')
    expect(meta.fulfillment).not.toHaveProperty('pickupHoldDays')
  })

  it('a pickup without address throws', () => {
    expect(() => buildOrderMeta(pickupInput({ pickupAddress: undefined }))).toThrow()
  })

  it('a delivery without shipping address throws', () => {
    expect(() => buildOrderMeta(makeInput({ shippingAddress: undefined }))).toThrow()
  })

  it('a delivery stores no pickup fields', () => {
    expect(buildOrderMeta(makeInput()).fulfillment).not.toHaveProperty('pickupAddress')
  })
})

describe('buildOrderMeta — bundle contents', () => {
  it('stores the items with per-bundle quantity and the VAT split', () => {
    const meta = buildOrderMeta(makeInput({
      items: [{
        variantId: 'b1', productId: 'pb', kind: 'bundle', title: 'Box', subtitle: '2× Wein, 1× Saft',
        sku: 'BOX', price: 3000, weight: 3500, quantity: 2, taxCategoryCode: '', vatRate: 13,
        vatAmount: 552 + 200, wine: null, options: null,
        selector: { variantId: 'b1', productId: 'pb', kind: 'bundle', categoryIds: [], manufacturerIds: [], hasCompareAtPrice: false },
        bundleItems: [
          { key: 'ka', variantId: 'w', productId: 'pw', title: 'Wein', subtitle: '2023 · 750 ml', sku: 'W', quantity: 2, kind: 'wine', weight: 1250, wine: { volume: 750 }, price: 2400, vatRate: 13, vatAmount: 552 },
          { key: 'kb', variantId: 'j', productId: 'pj', title: 'Saft', subtitle: null, sku: null, quantity: 1, kind: 'physical', weight: 1000, wine: null, price: 600, vatRate: 20, vatAmount: 200 },
        ],
      }],
    }))
    expect(meta.orderItems[0].bundle).toEqual({
      _type: 'orderItemBundle',
      itemCount: 3,
      items: [
        { _key: 'ka', _type: 'orderItemBundleItem', variantId: 'w', productId: 'pw', title: 'Wein', subtitle: '2023 · 750 ml', sku: 'W', quantity: 2, price: 2400, vatRate: 13, vatAmount: 552 },
        { _key: 'kb', _type: 'orderItemBundleItem', variantId: 'j', productId: 'pj', title: 'Saft', quantity: 1, price: 600, vatRate: 20, vatAmount: 200 },
      ],
    })
  })
})

describe('buildOrder', () => {
  it('builds from orderMeta with order-specific fields', () => {
    const meta = buildOrderMeta(makeInput())
    const order = buildOrder({
      orderMeta: meta,
      orderNumber: 'ORD-000042',
      invoiceNumber: 'INV-000042',
    })
    expect(order._type).toBe('order')
    expect(order.orderNumber).toBe('ORD-000042')
    expect(order.invoiceNumber).toBe('INV-000042')
    expect(order.status).toBe('created')
    expect(order.paymentStatus).toBe('succeeded')
    expect(order.statusHistory).toHaveLength(1)
    expect(order.statusHistory[0].type).toBe('payment')
    expect(order.statusHistory[0].status).toBe('succeeded')
    expect(order.statusHistory[0].source).toBe('stripe')
    expect(order.paymentIntentId).toBe('pi_test123')
    expect(order.orderItems).toEqual(meta.orderItems)
    expect(order.customer).toEqual(meta.customer)
    expect(order.totals).toEqual(meta.totals)
    expect(order.fulfillment).toEqual(meta.fulfillment)
    expect(order).not.toHaveProperty('payment')
    expect(order).not.toHaveProperty('orderDate')
  })

  it('snapshots order date, payment method and delivery time', () => {
    const meta = buildOrderMeta(makeInput({
      selectedShipping: { _id: 'sm1', title: 'Post', deliveryTime: '2–4 Werktage', methodType: 'delivery', price: 500, isFree: false, taxCategoryCode: null },
    }))
    const payment = { _type: 'orderPaymentMethod' as const, type: 'card', brand: 'visa', last4: '4242' }
    const order = buildOrder({ orderMeta: meta, orderNumber: '1', invoiceNumber: '1', orderDate: '2026-10-05T20:00:00.000Z', payment })
    expect(order.orderDate).toBe('2026-10-05T20:00:00.000Z')
    expect(order.payment).toEqual(payment)
    expect(order.fulfillment.deliveryTime).toBe('2–4 Werktage')
  })
})

describe('buildOrderMeta — discounts', () => {
  const bundleLine = (): ValidatedCartItem => ({
    variantId: 'b1', productId: 'pb', kind: 'bundle', title: 'Box', subtitle: null,
    sku: null, price: 3000, weight: 3500, quantity: 2, taxCategoryCode: '', vatRate: 13,
    vatAmount: 752, wine: null, options: null,
    selector: { variantId: 'b1', productId: 'pb', kind: 'bundle', categoryIds: [], manufacturerIds: [], hasCompareAtPrice: false },
    bundleItems: [
      { key: 'ka', variantId: 'w', productId: 'pw', title: 'Wein', subtitle: null, sku: null, quantity: 2, kind: 'wine', weight: 1250, wine: { volume: 750 }, price: 2400, vatRate: 13, vatAmount: 552 },
      { key: 'kb', variantId: 'j', productId: 'pj', title: 'Saft', subtitle: null, sku: null, quantity: 1, kind: 'physical', weight: 1000, wine: null, price: 600, vatRate: 20, vatAmount: 200 },
    ],
  })

  it('stores line and bundle-item discounts; lines without one carry no field', () => {
    const base = makeInput()
    const meta = buildOrderMeta(makeInput({
      items: [base.items[0], bundleLine()],
      lineDiscounts: [{ discount: 0, children: null }, { discount: 600, children: [480, 120] }],
    }))
    expect(meta.orderItems[0]).not.toHaveProperty('discount')
    expect(meta.orderItems[1].discount).toBe(600)
    expect(meta.orderItems[1].bundle!.items!.map(bi => bi.discount)).toEqual([480, 120])
  })

  it('a zero child share carries no field', () => {
    const meta = buildOrderMeta(makeInput({ items: [bundleLine()], lineDiscounts: [{ discount: 5, children: [5, 0] }] }))
    expect(meta.orderItems[0].bundle!.items![1]).not.toHaveProperty('discount')
  })

  it('snapshots applied discounts (code with code, automatic without; no value for free)', () => {
    const snaps = buildAppliedDiscountSnapshots([
      { discount: discount({ _id: 'discount-c1', title: 'Sommer', code: 'SUMMER' }), amount: 300, lineAmounts: [300] },
      { discount: bundleFreeShipping(), amount: 0, lineAmounts: [0] },
    ])
    expect(snaps.map(({ _key: _k, ...rest }) => rest)).toEqual([
      { _type: 'appliedDiscount', discountRef: { _type: 'reference', _ref: 'discount-c1', _weak: true }, code: 'SUMMER', title: 'Sommer', trigger: 'code', target: 'order', valueType: 'percent', value: 10, amount: 300 },
      { _type: 'appliedDiscount', discountRef: { _type: 'reference', _ref: 'auto-ship', _weak: true }, title: 'Versandkostenfrei mit Weinpaket', trigger: 'automatic', target: 'shipping', valueType: 'free', amount: 0 },
    ])
  })

  it('orderMeta and order carry appliedDiscounts; none → no field', () => {
    const appliedDiscounts = buildAppliedDiscountSnapshots([
      { discount: discount(), amount: 300, lineAmounts: [300] },
    ])
    const meta = buildOrderMeta(makeInput({ appliedDiscounts }))
    expect(meta.appliedDiscounts).toEqual(appliedDiscounts)
    expect(buildOrder({ orderMeta: meta, orderNumber: '1', invoiceNumber: '1' }).appliedDiscounts).toEqual(appliedDiscounts)
    expect(buildOrderMeta(makeInput())).not.toHaveProperty('appliedDiscounts')
    expect(meta).not.toHaveProperty('appliedCoupons')
  })
})

describe('buildOrder — old-shape orderMeta (webhook transition)', () => {
  it('converts appliedCoupons + reason to the discount shape', () => {
    const meta = buildOrderMeta(makeInput())
    const legacy = {
      ...meta,
      totals: { ...meta.totals, discount: 300, grandTotal: meta.totals.grandTotal - 300 },
      appliedCoupons: [{
        _key: 'c', _type: 'appliedCoupon', couponRef: { _type: 'reference', _ref: 'coupon-1', _weak: true },
        code: 'TEN', discountType: 'percent', value: 10, discountAmount: 300,
      }],
    }
    const order = buildOrder({ orderMeta: legacy as never, orderNumber: '1', invoiceNumber: '1' })
    expect(order).not.toHaveProperty('appliedCoupons')
    expect(order.appliedDiscounts).toEqual([expect.objectContaining({
      discountRef: { _type: 'reference', _ref: 'discount-coupon-1', _weak: true }, code: 'TEN', trigger: 'code', target: 'order', amount: 300,
    })])
    expect(order.orderItems.reduce((s, i) => s + (i.discount ?? 0), 0)).toBe(300)
  })

  it('a product reason becomes discount + a ref-less entry', () => {
    const meta = buildOrderMeta(makeInput())
    const legacy = { ...meta, fulfillment: { ...meta.fulfillment, shippingCost: 0, freeShippingReason: 'product' } }
    const order = buildOrder({ orderMeta: legacy as never, orderNumber: '1', invoiceNumber: '1' })
    expect(order.fulfillment.freeShippingReason).toBe('discount')
    expect(order.appliedDiscounts).toEqual([expect.objectContaining({ title: 'Versandkostenfrei durch Produkt', target: 'shipping' })])
    expect(order.appliedDiscounts![0]).not.toHaveProperty('discountRef')
  })
})

describe('formatOrderNumber', () => {
  it('formats with prefix', () => {
    expect(formatOrderNumber('ORD-', 42)).toBe('ORD-000042')
  })

  it('formats without prefix', () => {
    expect(formatOrderNumber(null, 1)).toBe('000001')
  })

  it('handles large numbers', () => {
    expect(formatOrderNumber('INV-', 123456)).toBe('INV-123456')
  })

  it('handles numbers longer than padding', () => {
    expect(formatOrderNumber('X', 1234567)).toBe('X1234567')
  })
})
