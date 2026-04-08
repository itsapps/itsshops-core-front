/**
 * Checkout API types shared between client and server.
 * No runtime code — types only.
 */

export type CheckoutCartItem = {
  variantId: string
  quantity: number
  /**
   * Frozen display string the customer saw on the product page / cart sidebar.
   * Snapshotted onto the order item verbatim — server does not re-derive it.
   * Optional: server falls back to composing one from structural fields if absent.
   */
  displayTitle?: string
  displaySubtitle?: string
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
  variantTitle: string | null
  price: number
  quantity: number
  requestedQuantity: number
  stock: number | null
  imageUrl: string | null
  weight: number | null
}

export type ShippingMethodResponse = {
  _id: string
  title: string
  methodType: 'delivery' | 'pickup'
  price: number
  isFree: boolean
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
  grandTotal: number
  vatBreakdown: VatBreakdownItem[]
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
