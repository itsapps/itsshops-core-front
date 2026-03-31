import { describe, it, expect } from 'vitest'
import { buildOrderMeta, buildOrder, formatOrderNumber, type BuildOrderMetaInput } from '../lib/order-builder'
import type { ValidatedCartItem, AvailableShippingMethod, CalculatedTotals } from '../types/checkout'

function makeInput(overrides: Partial<BuildOrderMetaInput> = {}): BuildOrderMetaInput {
  const items: ValidatedCartItem[] = [{
    variantId: 'v1',
    productId: 'p1',
    kind: 'wine',
    title: 'Blaufränkisch',
    variantTitle: '2023 0.75l',
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
    vatBreakdown: [{ rate: 20, net: 2917, vat: 583, label: '20% VAT' }],
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
    expect(meta.customer.shippingAddress.city).toBe('Eisenstadt')
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

  it('handles items with options', () => {
    const input = makeInput({
      items: [{
        variantId: 'v2',
        productId: 'p2',
        kind: 'physical',
        title: 'T-Shirt',
        variantTitle: 'Large Red',
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
      }],
    })
    const meta = buildOrderMeta(input)
    const item = meta.orderItems[0]
    expect(item.options).toHaveLength(2)
    expect(item.options![0]._type).toBe('orderItemOption')
    expect(item.options![0].groupTitle).toBe('Size')
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
