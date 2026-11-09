/**
 * Server-side types matching Sanity schemas exactly.
 * All prices are in cents (integers).
 */

import type { VatBreakdownItem } from '../../shared/checkout-api'
export type { VatBreakdownItem }

// ── Sanity query result types ───────────────────────────────────────────────

export type SanityVariantResult = {
  _id: string
  status: 'active' | 'comingSoon' | 'soldOut' | 'archived'
  kind: 'wine' | 'physical' | 'digital' | 'bundle'
  title: LocaleString[] | null
  sku: string | null
  price: number | null
  weight: number | null
  stock: number | null
  productId: string | null
  taxCategoryCode: string | null
  productTitle: LocaleString[] | null
  productWeight: number | null
  productPrice: number | null
  productTaxCategoryCode: string | null
  wine: {
    vintage: string | null
    volume: number | null
  } | null
  options: SanityOptionResult[] | null
  bundleItems: SanityBundleItemResult[] | null
}

export type SanityOptionResult = {
  title: LocaleString[] | null
  groupTitle: LocaleString[] | null
}

/**
 * One entry of a bundle's `bundleItems` in the checkout query. `variant` is the item variant
 * (`null` when the reference dangles, e.g. the variant was unpublished).
 */
export type SanityBundleItemResult = {
  _key?: string
  quantity: number
  variant: {
    _id: string
    status?: 'active' | 'comingSoon' | 'soldOut' | 'archived'
    kind: 'wine' | 'physical' | 'digital' | 'bundle'
    title: LocaleString[] | null
    sku?: string | null
    price?: number | null
    weight: number | null
    productId?: string | null
    productTitle?: LocaleString[] | null
    productWeight: number | null
    productPrice?: number | null
    taxCategoryCode?: string | null
    productTaxCategoryCode?: string | null
    stock: number | null
    wine: {
      vintage: string | null
      volume: number | null
    } | null
    options?: SanityOptionResult[] | null
  } | null
}

export type SanityTaxCountryResult = {
  countryCode: string
  rules: SanityTaxRuleResult[]
} | null

export type SanityTaxRuleResult = {
  taxCategoryCode: string
  rate: number
}

export type SanityShippingMethodResult = {
  _id: string
  title: LocaleString[] | null
  deliveryTime?: LocaleString[] | null
  methodType: 'delivery' | 'pickup'
  pickupFee: number | null
  freeShippingThreshold: number | null
  taxCategoryCode: string | null
  rates: SanityShippingRateResult[] | null
  packagingGroups: SanityPackagingGroupResult[] | null
}

export type SanityShippingRateResult = {
  maxWeight: number
  price: number
}

/** A box type: its boxes and the bottle sizes that go in them (see `calcWinePackagingCost`). */
export type SanityPackagingGroupResult = {
  packages: SanityPackagingGroupPackageResult[] | null
  bottles: Array<{ volume: number; perPlace: number | null }> | null
}

export type SanityPackagingGroupPackageResult = {
  places: number
  price: number
}

export type SanityShopSettingsResult = {
  defaultCountryCode: string | null
  freeShippingCalculation: 'beforeDiscount' | 'afterDiscount'
  defaultTaxCategoryCode: string | null
  orderNumberPrefix: string | null
  invoiceNumberPrefix: string | null
  lastInvoiceNumber: number
}

export type SanitySupportedCountryResult = {
  countryCode: string
}

export type SanityCouponResult = {
  _id: string
  code: string
  enabled: boolean
  discountType: 'percent' | 'fixed' | 'freeShipping'
  value: number | null
  validFrom: string | null
  validTo: string | null
  minSubtotal: number | null
  maxRedemptions: number | null
  redemptionCount: number | null
}

export type SanityCheckoutQueryResult = {
  variants: SanityVariantResult[]
  taxCountry: SanityTaxCountryResult
  shippingMethods: SanityShippingMethodResult[]
  shopSettings: SanityShopSettingsResult
  supportedCountries: SanitySupportedCountryResult[]
  coupon: SanityCouponResult | null
}

export type LocaleString = {
  language: string
  value: string
}

// ── Validated domain types ──────────────────────────────────────────────────

export type ValidatedCartItem = {
  variantId: string
  productId: string
  kind: 'wine' | 'physical' | 'digital' | 'bundle'
  title: string
  subtitle: string | null
  sku: string | null
  price: number
  weight: number | null
  quantity: number
  taxCategoryCode: string
  vatRate: number
  vatAmount: number
  wine: { vintage: string | null; volume: number | null } | null
  options: { groupTitle: string; optionTitle: string }[] | null
  bundleItems: ValidatedBundleItem[] | null
}

/**
 * One item of a validated bundle. `quantity` is per bundle. `price` is the item's gross share of
 * **one** bundle for all its `quantity` units together (the bundle's unit price split by the
 * items' single sale prices; the shares add up to the bundle price exactly). `vatAmount` is the
 * VAT in that share × the bundle line's quantity.
 */
export type ValidatedBundleItem = {
  key: string
  variantId: string
  productId: string
  title: string
  subtitle: string | null
  sku: string | null
  quantity: number
  kind: 'wine' | 'physical' | 'digital' | 'bundle'
  weight: number | null
  wine: { volume: number | null } | null
  price: number
  vatRate: number
  vatAmount: number
}

export type CalculatedTotals = {
  subtotal: number
  shipping: number
  discount: number
  tax: number
  grandTotal: number
  vatBreakdown: VatBreakdownItem[]
}

export type AppliedCouponSnapshot = {
  _key: string
  _type: 'appliedCoupon'
  couponRef: { _type: 'reference'; _ref: string; _weak: true }
  code: string
  discountType: 'percent' | 'fixed' | 'freeShipping'
  value: number | null
  discountAmount: number
}

export type AvailableShippingMethod = {
  _id: string
  title: string
  deliveryTime?: string
  methodType: 'delivery' | 'pickup'
  price: number
  isFree: boolean
  taxCategoryCode: string | null
  packagingLines?: Array<{ volumes: number[]; packSize: number; quantity: number; price: number }>
}

// ── Sanity order document types (for mutations) ─────────────────────────────

export type OrderItem = {
  _key: string
  _type: 'orderItem'
  kind: 'wine' | 'physical' | 'digital' | 'bundle'
  variantId: string
  productId: string
  parentId?: string
  title: string
  subtitle?: string
  weight?: number
  sku?: string
  quantity: number
  price: number
  vatRate: number
  vatAmount: number
  packed: boolean
  wine?: { _type: 'orderItemWine'; vintage?: string; volume?: number }
  options?: { _type: 'orderItemOption'; _key: string; groupTitle: string; optionTitle: string }[]
  bundle?: { _type: 'orderItemBundle'; itemCount: number; items?: OrderItemBundleItem[] }
}

/**
 * Snapshot of one bundle item on an order line. `quantity` is per bundle; `price` is the item's
 * gross share of one bundle (all its units together, not per unit — unlike `OrderItem.price`);
 * `vatAmount` covers share × the line's quantity. Absent on orders from before 2026-11.
 */
export type OrderItemBundleItem = {
  _key: string
  _type: 'orderItemBundleItem'
  variantId: string
  productId: string
  title: string
  subtitle?: string
  sku?: string
  quantity: number
  price: number
  vatRate: number
  vatAmount: number
}

export type AddressStrict = {
  _type: 'addressStrict'
  name: string
  prename?: string
  lastname?: string
  phone?: string
  line1: string
  line2?: string
  zip: string
  city: string
  country: string
  state?: string
}

export type OrderCustomer = {
  _type: 'orderCustomer'
  locale: string
  contactEmail: string
  supabaseId?: string
  billingAddress: AddressStrict
  shippingAddress: AddressStrict
}

export type OrderTotals = {
  _type: 'orderTotals'
  grandTotal: number
  subtotal: number
  shipping: number
  discount: number
  totalVat: number
  vatBreakdown: (VatBreakdownItem & { _key: string; _type: 'vatBreakdownItem' })[]
  currency: 'EUR'
}

export type FulfillmentPackagingLine = {
  _key: string
  _type: 'fulfillmentPackagingLine'
  /** Bottle sizes (ml) of the packaging group, largest first. */
  volumes: number[]
  /** Places of the box. */
  packSize: number
  quantity: number
  price: number
}

/** What was charged (from the Stripe charge) — see `lib/payment-method.ts`. */
export type OrderPaymentMethod = {
  _type: 'orderPaymentMethod'
  /** Stripe payment method type: card, eps, klarna, paypal, sepa_debit, … */
  type: string
  brand?: string
  last4?: string
  /** Card wallet: apple_pay, google_pay, link, … */
  wallet?: string
}

export type Fulfillment = {
  _type: 'fulfillment'
  methodTitle: string
  /** Snapshot of the shipping method's delivery time (e.g. "2–4 Werktage"), when set. */
  deliveryTime?: string
  methodType: 'delivery' | 'pickup'
  shippingCost: number
  taxSnapshot: VatBreakdownItem & { _type: 'vatBreakdownItem' }
  method: { _type: 'reference'; _ref: string; _weak: true }
  packagingLines?: FulfillmentPackagingLine[]
  trackingCode?: string
  pickupLocation?: string
}

export type OrderStatusHistoryEntry = {
  _key: string
  _type: 'orderStatusHistory'
  type: 'payment' | 'fulfillment' | 'mail'
  /** Payment / fulfillment state, or the `MailType` of a `mail` entry (`withdrawalReceipt` for the withdrawal receipt). */
  status: string
  timestamp: string
  source: string
  /** Internal admin note (studio only, never sent to the customer). */
  note?: string
  /**
   * Message sent to the customer with this mail (studio "message to customer"; `mail` entries —
   * older status entries may carry one too).
   */
  customerMessage?: string
}

/**
 * One Stripe refund of the order, rebuilt from Stripe's refund list by `syncOrderRefunds`
 * (core-front is the only writer). `amount` in cents.
 */
export type OrderRefund = {
  _key: string
  _type: 'orderRefund'
  /** Stripe refund id (`re_…`), also the `_key`. */
  refundId: string
  amount: number
  createdAt: string
  /** Stripe's status: pending | succeeded | failed | canceled | requires_action. */
  status: string
  /** `studio` = created through `payment-refund`; `stripe` = Stripe dashboard (or another system). */
  source: 'studio' | 'stripe'
  /** Stripe's reason enum (duplicate | fraudulent | requested_by_customer | …). */
  reason?: string
  /** Stripe's `failure_reason` of a failed refund. */
  failureReason?: string
}

export type OrderMetaDocument = {
  _type: 'orderMeta'
  paymentIntentId: string
  orderItems: OrderItem[]
  customer: OrderCustomer
  totals: OrderTotals
  fulfillment: Fulfillment
  appliedCoupons?: AppliedCouponSnapshot[]
}

export type OrderDocument = {
  _type: 'order'
  orderNumber: string
  invoiceNumber: string
  status: 'created' | 'processing' | 'shipped' | 'delivered' | 'canceled' | 'returned'
  paymentStatus: 'succeeded' | 'refunded' | 'partiallyRefunded'
  statusHistory: OrderStatusHistoryEntry[]
  paymentIntentId: string
  /** When the customer placed the order (PaymentIntent `created`). Absent on older orders. */
  orderDate?: string
  /** What was charged. Absent on older orders or when the Stripe lookup failed. */
  payment?: OrderPaymentMethod
  orderItems: OrderItem[]
  customer: OrderCustomer
  totals: OrderTotals
  fulfillment: Fulfillment
  appliedCoupons?: AppliedCouponSnapshot[]
  /** Stripe refunds, oldest first. Absent on orders refunded before refunds were stored. */
  refunds?: OrderRefund[]
}
