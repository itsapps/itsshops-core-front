/**
 * Server-side API types.
 * Shared types re-exported from src/shared/checkout-api.ts.
 */

import type { CheckoutCartItem, AddressInput } from '../../shared/checkout-api'

export type {
  CheckoutCartItem,
  AddressInput,
  ValidatedCartItemResponse,
  ShippingMethodResponse,
  VatBreakdownItem,
  TotalsResponse,
  SupportedCountry,
  CalculateResponse,
  CreatePaymentResponse,
  ErrorResponse,
} from '../../shared/checkout-api'

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
