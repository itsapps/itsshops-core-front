/**
 * Request/response types shared between client and server.
 */

import type { VatBreakdownItem } from './checkout'

// ── Request types ───────────────────────────────────────────────────────────

export type CheckoutCartItem = {
  variantId: string
  quantity: number
}

export type AddressInput = {
  name: string
  prename: string
  lastname: string
  phone?: string
  line1: string
  line2?: string
  zip: string
  city: string
  country: string
  state?: string
}

export type PaymentCreateRequest = {
  cart: { items: CheckoutCartItem[] }
  createPayment: boolean
  address?: {
    shipping: AddressInput
    billing?: AddressInput
    contactEmail: string
  }
  partialAddress?: { country: string }
  shippingMethodId?: string
  locale: string
  orderMetaId?: string
}

// ── Response types ──────────────────────────────────────────────────────────

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

export type SupportedCountry = {
  code: string
  title: string
}

export type TotalsResponse = {
  subtotal: number
  shipping: number
  tax: number
  grandTotal: number
  vatBreakdown: VatBreakdownItem[]
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
