/**
 * Checkout API types shared between client and server.
 * No runtime code — types only.
 */

export type CheckoutCartItem = {
  variantId: string
  quantity: number
  /** Product/variant title as shown in the cart. Snapshotted onto the order item. */
  title?: string
  /** Kind-specific info (e.g. "2021 · 0.75l"). Snapshotted onto the order item. */
  subtitle?: string
}

export type AddressInput = {
  /** Canonical full name. Required. Manual forms combine prename + lastname; express checkouts (Apple Pay) provide only this. */
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

export type ValidatedCartItemResponse = {
  variantId: string
  kind: 'wine' | 'physical' | 'digital' | 'bundle'
  title: string
  subtitle: string | null
  price: number
  quantity: number
  requestedQuantity: number
  stock: number | null
  imageUrl: string | null
  weight: number | null
  /** Bundles: contents key ("variantId:qty" per item, sorted, joined ","), else null. */
  bundleKey: string | null
}

/** A pickup location's address (city in the request locale). */
export type PickupAddressResponse = {
  line1: string
  line2?: string
  zip: string
  city: string
  country: string
}

export type ShippingMethodResponse = {
  _id: string
  title: string
  methodType: 'delivery' | 'pickup'
  price: number
  isFree: boolean
  /** Delivery: "2–4 Werktage"; pickup: how long until the order is ready to collect. */
  deliveryTime?: string
  /** Pickup only. */
  pickupAddress?: PickupAddressResponse
  pickupInstructions?: string
  pickupHoldDays?: number
  /** Pickup only: the shop prepares the order first and mails when it's ready. */
  pickupAnnounceReady?: boolean
}

export type VatBreakdownItem = {
  rate: number
  net: number
  vat: number
}

export type TotalsResponse = {
  subtotal: number
  shipping: number
  tax: number
  discount: number
  grandTotal: number
  vatBreakdown: VatBreakdownItem[]
}

/**
 * One applied discount (code or automatic), in apply order (items → order → shipping). `amount`
 * = cents saved; for shipping the waived cost of the selected method (0 when it was already free
 * — a code still shows as applied then).
 */
export type AppliedDiscountResponse = {
  /** In the request locale; may be empty (the client falls back to its "Rabatt" label). */
  title: string
  /** Code discounts only. */
  code?: string
  trigger: 'code' | 'automatic'
  target: 'items' | 'order' | 'shipping'
  amount: number
}

export type CouponErrorResponse = {
  code: string
  errorCode: string
  message: string
  /** `COUPON_NOT_COMBINABLE`: the title of the automatic discount that won. */
  discountTitle?: string
}

export type SupportedCountry = {
  code: string
  title: string
}

export type CalculateResponse = {
  items: ValidatedCartItemResponse[]
  unavailableItems: string[]
  totals: TotalsResponse
  shippingMethods: ShippingMethodResponse[]
  selectedShippingMethodId: string | null
  selectedCountry: string
  supportedCountries: SupportedCountry[]
  currency: 'EUR'
  appliedDiscounts: AppliedDiscountResponse[]
  /** Cart lines the applied code discount skipped (not eligible / shop-excluded) — the hint. */
  notDiscountedVariantIds: string[]
  couponError: CouponErrorResponse | null
}

export type CreatePaymentResponse = CalculateResponse & {
  clientSecret: string
  orderMetaId: string
}

export type ErrorResponse = {
  error: {
    code: string
    message: string
    details?: Record<string, string>
  }
  requestId?: string
}
