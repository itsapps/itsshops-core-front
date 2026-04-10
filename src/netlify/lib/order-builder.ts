import type {
  ValidatedCartItem,
  AvailableShippingMethod,
  CalculatedTotals,
  OrderMetaDocument,
  OrderDocument,
  OrderItem,
  OrderCustomer,
  OrderTotals,
  Fulfillment,
  AddressStrict,
  OrderStatusHistoryEntry,
} from '../types/checkout'
import type { AddressInput } from '../types/api'
import { findTaxRate } from './tax'
import type { SanityTaxRuleResult } from '../types/checkout'

function generateKey(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}

function buildAddressStrict(input: AddressInput): AddressStrict {
  const out: AddressStrict = {
    _type: 'addressStrict',
    name: input.name,
    line1: input.line1,
    zip: input.zip,
    city: input.city,
    country: input.country,
  }
  if (input.prename) out.prename = input.prename
  if (input.lastname) out.lastname = input.lastname
  if (input.phone) out.phone = input.phone
  if (input.line2) out.line2 = input.line2
  if (input.state) out.state = input.state
  return out
}

function buildOrderItems(items: ValidatedCartItem[]): OrderItem[] {
  return items.map(item => {
    const orderItem: OrderItem = {
      _key: generateKey(),
      _type: 'orderItem',
      kind: item.kind,
      variantId: item.variantId,
      productId: item.productId,
      title: item.title,
      displayTitle: item.displayTitle,
      quantity: item.quantity,
      price: item.price,
      vatRate: item.vatRate,
      vatAmount: item.vatAmount,
      packed: false,
    }

    if (item.variantTitle) orderItem.variantTitle = item.variantTitle
    if (item.displaySubtitle) orderItem.displaySubtitle = item.displaySubtitle
    if (item.weight) orderItem.weight = item.weight
    if (item.sku) orderItem.sku = item.sku

    if (item.wine) {
      orderItem.wine = {
        _type: 'orderItemWine',
        ...(item.wine.vintage && { vintage: item.wine.vintage }),
        ...(item.wine.volume && { volume: item.wine.volume }),
      }
    }

    if (item.options && item.options.length > 0) {
      orderItem.options = item.options.map(o => ({
        _type: 'orderItemOption',
        _key: generateKey(),
        groupTitle: o.groupTitle,
        optionTitle: o.optionTitle,
      }))
    }

    if (item.bundleItems && item.bundleItems.length > 0) {
      orderItem.bundle = {
        _type: 'orderItemBundle',
        itemCount: item.bundleItems.reduce((sum, bi) => sum + bi.quantity, 0),
      }
    }

    return orderItem
  })
}

function buildOrderTotals(totals: CalculatedTotals): OrderTotals {
  return {
    _type: 'orderTotals',
    grandTotal: totals.grandTotal,
    subtotal: totals.subtotal,
    shipping: totals.shipping,
    discount: totals.discount,
    totalVat: totals.tax,
    vatBreakdown: totals.vatBreakdown.map(v => ({
      ...v,
      _key: generateKey(),
      _type: 'vatBreakdownItem',
    })),
    currency: 'EUR',
  }
}

function buildFulfillment(
  selectedShipping: AvailableShippingMethod,
  shippingVatRate: number,
  shippingCost: number,
): Fulfillment {
  const vat = shippingVatRate > 0
    ? Math.round(shippingCost - shippingCost / (1 + shippingVatRate / 100))
    : 0

  const packagingLines = selectedShipping.packagingLines?.map((line, i) => ({
    _key: `pkg_${i}`,
    _type: 'fulfillmentPackagingLine' as const,
    ...line,
  }))

  return {
    _type: 'fulfillment',
    methodTitle: selectedShipping.title,
    methodType: selectedShipping.methodType,
    shippingCost,
    taxSnapshot: {
      _type: 'vatBreakdownItem',
      rate: shippingVatRate,
      net: shippingCost - vat,
      vat,
    },
    method: {
      _type: 'reference',
      _ref: selectedShipping._id,
      _weak: true,
    },
    ...(packagingLines?.length && { packagingLines }),
  }
}

export type BuildOrderMetaInput = {
  items: ValidatedCartItem[]
  totals: CalculatedTotals
  selectedShipping: AvailableShippingMethod
  shippingVatRate: number
  shippingAddress: AddressInput
  billingAddress: AddressInput
  contactEmail: string
  locale: string
  paymentIntentId: string
}

export function buildOrderMeta(input: BuildOrderMetaInput): OrderMetaDocument {
  return {
    _type: 'orderMeta',
    paymentIntentId: input.paymentIntentId,
    orderItems: buildOrderItems(input.items),
    customer: {
      _type: 'orderCustomer',
      locale: input.locale,
      contactEmail: input.contactEmail,
      billingAddress: buildAddressStrict(input.billingAddress),
      shippingAddress: buildAddressStrict(input.shippingAddress),
    },
    totals: buildOrderTotals(input.totals),
    fulfillment: buildFulfillment(
      input.selectedShipping,
      input.shippingVatRate,
      input.totals.shipping,
    ),
  }
}

export type BuildOrderInput = {
  orderMeta: OrderMetaDocument
  orderNumber: string
  invoiceNumber: string
}

export function buildOrder(input: BuildOrderInput): OrderDocument {
  const now = new Date().toISOString()

  return {
    _type: 'order',
    orderNumber: input.orderNumber,
    invoiceNumber: input.invoiceNumber,
    status: 'created',
    paymentStatus: 'succeeded',
    statusHistory: [
      {
        _key: generateKey(),
        _type: 'orderStatusHistory',
        type: 'payment',
        status: 'succeeded',
        timestamp: now,
        source: 'stripe',
      },
    ],
    paymentIntentId: input.orderMeta.paymentIntentId,
    orderItems: input.orderMeta.orderItems,
    customer: input.orderMeta.customer,
    totals: input.orderMeta.totals,
    fulfillment: input.orderMeta.fulfillment,
  }
}

export function formatOrderNumber(prefix: string | null, counter: number): string {
  const padded = String(counter).padStart(6, '0')
  return prefix ? `${prefix}${padded}` : padded
}
