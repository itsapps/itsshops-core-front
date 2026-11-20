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
  FreeShippingReason,
  AddressStrict,
  OrderStatusHistoryEntry,
  AppliedDiscountSnapshot,
  OrderPaymentMethod,
} from '../types/checkout'
import type { AddressInput } from '../types/api'
import type { AppliedDiscountResult, LineDiscount } from '../../shared/discounts'
import { findTaxRate } from './tax'
import { convertLegacyOrderMeta, type OrderLike } from './discount-migration'
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

function buildOrderItems(items: ValidatedCartItem[], lineDiscounts: LineDiscount[] = []): OrderItem[] {
  return items.map((item, index) => {
    const line = lineDiscounts[index]
    const orderItem: OrderItem = {
      _key: generateKey(),
      _type: 'orderItem',
      kind: item.kind,
      variantId: item.variantId,
      productId: item.productId,
      title: item.title,
      quantity: item.quantity,
      price: item.price,
      vatRate: item.vatRate,
      vatAmount: item.vatAmount,
      packed: false,
    }

    // The stored allocation (never recomputed); lines without a discount carry no field.
    if (line && line.discount > 0) orderItem.discount = line.discount

    if (item.subtitle) orderItem.subtitle = item.subtitle
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
        // Snapshot of the contents and the VAT split (stored, never recomputed).
        items: item.bundleItems.map((bi, c) => ({
          _key: bi.key,
          _type: 'orderItemBundleItem' as const,
          variantId: bi.variantId,
          productId: bi.productId,
          title: bi.title,
          ...(bi.subtitle && { subtitle: bi.subtitle }),
          ...(bi.sku && { sku: bi.sku }),
          quantity: bi.quantity,
          price: bi.price,
          vatRate: bi.vatRate,
          vatAmount: bi.vatAmount,
          ...((line?.children?.[c] ?? 0) > 0 && { discount: line!.children![c] }),
        })),
      }
    }

    return orderItem
  })
}

/**
 * The order snapshot of the applied discounts (pipeline result, apply order). `title` is already
 * in the order's locale (`toDiscountInput`). Shipping discounts are kept with `amount: 0` when
 * the selected method was already free (still counted on the webhook).
 */
export function buildAppliedDiscountSnapshots(applied: AppliedDiscountResult[]): AppliedDiscountSnapshot[] {
  return applied.map(({ discount, amount }) => ({
    _key: generateKey(),
    _type: 'appliedDiscount' as const,
    discountRef: { _type: 'reference' as const, _ref: discount._id, _weak: true as const },
    ...(discount.trigger === 'code' && discount.code && { code: discount.code }),
    title: discount.title,
    trigger: discount.trigger,
    target: discount.target,
    valueType: discount.valueType,
    ...(discount.valueType !== 'free' && typeof discount.value === 'number' && { value: discount.value }),
    amount,
  }))
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
  freeShippingReason?: FreeShippingReason,
): Fulfillment {
  const vat = shippingVatRate > 0
    ? Math.round(shippingCost - shippingCost / (1 + shippingVatRate / 100))
    : 0

  // Pickup: snapshot the location so a later change on the method moves no existing order.
  const isPickup = selectedShipping.methodType === 'pickup'
  const pickupAddress = selectedShipping.pickupAddress
  if (isPickup && !pickupAddress) {
    throw new Error(`Pickup method ${selectedShipping._id} has no pickup address`)
  }

  const packagingLines = selectedShipping.packagingLines?.map((line, i) => ({
    _key: `pkg_${i}`,
    _type: 'fulfillmentPackagingLine' as const,
    ...line,
  }))

  return {
    _type: 'fulfillment',
    methodTitle: selectedShipping.title,
    ...(selectedShipping.deliveryTime && { deliveryTime: selectedShipping.deliveryTime }),
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
    ...(isPickup && pickupAddress && {
      pickupAddress: {
        line1: pickupAddress.line1,
        ...(pickupAddress.line2 && { line2: pickupAddress.line2 }),
        zip: pickupAddress.zip,
        city: pickupAddress.city,
        country: pickupAddress.country,
      },
      ...(selectedShipping.pickupInstructions && { pickupInstructions: selectedShipping.pickupInstructions }),
      ...(selectedShipping.pickupHoldDays && { pickupHoldDays: selectedShipping.pickupHoldDays }),
    }),
    ...(freeShippingReason && selectedShipping.methodType === 'delivery' && shippingCost === 0 && {
      freeShippingReason,
    }),
  }
}

export type BuildOrderMetaInput = {
  items: ValidatedCartItem[]
  totals: CalculatedTotals
  selectedShipping: AvailableShippingMethod
  shippingVatRate: number
  /** Delivery only (required then); ignored for pickup — no shipping address is stored. */
  shippingAddress?: AddressInput
  billingAddress: AddressInput
  contactEmail: string
  locale: string
  paymentIntentId: string
  /** `evaluateDiscounts(...).lines`, aligned with `items` (unset = no discounts). */
  lineDiscounts?: LineDiscount[]
  appliedDiscounts?: AppliedDiscountSnapshot[]
  /** Why shipping is free (`freeShippingReason()` in `shipping.ts`); stored only for delivery at 0. */
  freeShippingReason?: FreeShippingReason
}

export function buildOrderMeta(input: BuildOrderMetaInput): OrderMetaDocument {
  // The method type decides, not whether the caller passed an address.
  const isDelivery = input.selectedShipping.methodType === 'delivery'
  if (isDelivery && !input.shippingAddress) {
    throw new Error('A delivery order needs a shipping address')
  }
  return {
    _type: 'orderMeta',
    paymentIntentId: input.paymentIntentId,
    orderItems: buildOrderItems(input.items, input.lineDiscounts),
    customer: {
      _type: 'orderCustomer',
      locale: input.locale,
      contactEmail: input.contactEmail,
      billingAddress: buildAddressStrict(input.billingAddress),
      ...(isDelivery && input.shippingAddress && {
        shippingAddress: buildAddressStrict(input.shippingAddress),
      }),
    },
    totals: buildOrderTotals(input.totals),
    fulfillment: buildFulfillment(
      input.selectedShipping,
      input.shippingVatRate,
      input.totals.shipping,
      input.freeShippingReason,
    ),
    ...(input.appliedDiscounts?.length && { appliedDiscounts: input.appliedDiscounts }),
  }
}

export type BuildOrderInput = {
  orderMeta: OrderMetaDocument
  orderNumber: string
  invoiceNumber: string
  /** When the customer placed the order — PaymentIntent `created` (ISO). */
  orderDate?: string
  /** What was charged (webhook, from the Stripe charge). */
  payment?: OrderPaymentMethod | null
}

export function buildOrder(input: BuildOrderInput): OrderDocument {
  const now = new Date().toISOString()
  // Transition (remove ≥ 30 days after the last live shop's 6.0.0 release — an unpaid
  // `orderMeta` lives that long): an `orderMeta` written by the old frontend (`appliedCoupons`,
  // reason `product`/`coupon`) becomes a migrated order.
  const orderMeta = convertLegacyOrderMeta(input.orderMeta as unknown as OrderLike) as unknown as OrderMetaDocument

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
    paymentIntentId: orderMeta.paymentIntentId,
    ...(input.orderDate && { orderDate: input.orderDate }),
    ...(input.payment && { payment: input.payment }),
    orderItems: orderMeta.orderItems,
    customer: orderMeta.customer,
    totals: orderMeta.totals,
    fulfillment: orderMeta.fulfillment,
    ...(orderMeta.appliedDiscounts?.length && {
      appliedDiscounts: orderMeta.appliedDiscounts,
    }),
  }
}

export function formatOrderNumber(prefix: string | null, counter: number): string {
  const padded = String(counter).padStart(6, '0')
  return prefix ? `${prefix}${padded}` : padded
}
