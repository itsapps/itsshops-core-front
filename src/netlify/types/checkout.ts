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

export type SanityBundleItemResult = {
  quantity: number
  variant: {
    _id: string
    kind: 'wine' | 'physical' | 'digital' | 'bundle'
    title: LocaleString[] | null
    weight: number | null
    productWeight: number | null
    stock: number | null
    wine: {
      vintage: string | null
      volume: number | null
    } | null
  }
}

export type SanityTaxCountryResult = {
  countryCode: string
  rules: SanityTaxRuleResult[]
} | null

export type SanityTaxRuleResult = {
  taxCategoryCode: string
  rate: number
  exciseDuty: number | null
}

export type SanityShippingMethodResult = {
  _id: string
  title: LocaleString[] | null
  methodType: 'delivery' | 'pickup'
  pickupFee: number | null
  freeShippingThreshold: number | null
  taxCategoryCode: string | null
  rates: SanityShippingRateResult[] | null
  packagingConfigs: SanityWinePackagingConfigResult[] | null
}

export type SanityShippingRateResult = {
  maxWeight: number
  price: number
}

export type SanityWinePackagingConfigResult = {
  volume: number
  packages: SanityWinePackageResult[]
}

export type SanityWinePackageResult = {
  count: number
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

export type SanityCheckoutQueryResult = {
  variants: SanityVariantResult[]
  taxCountry: SanityTaxCountryResult
  shippingMethods: SanityShippingMethodResult[]
  shopSettings: SanityShopSettingsResult
  supportedCountries: SanitySupportedCountryResult[]
}

export type LocaleString = {
  _key: string
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
  bundleItems: { variantId: string; quantity: number }[] | null
}

export type CalculatedTotals = {
  subtotal: number
  shipping: number
  discount: number
  tax: number
  grandTotal: number
  vatBreakdown: VatBreakdownItem[]
}

export type AvailableShippingMethod = {
  _id: string
  title: string
  methodType: 'delivery' | 'pickup'
  price: number
  isFree: boolean
  taxCategoryCode: string | null
  packagingLines?: Array<{ volume: number; packSize: number; quantity: number; price: number }>
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
  bundle?: { _type: 'orderItemBundle'; itemCount: number }
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
  volume: number
  packSize: number
  quantity: number
  price: number
}

export type Fulfillment = {
  _type: 'fulfillment'
  methodTitle: string
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
  type: 'payment' | 'fulfillment'
  status: string
  timestamp: string
  source: string
  note?: string
}

export type OrderMetaDocument = {
  _type: 'orderMeta'
  paymentIntentId: string
  orderItems: OrderItem[]
  customer: OrderCustomer
  totals: OrderTotals
  fulfillment: Fulfillment
}

export type OrderDocument = {
  _type: 'order'
  orderNumber: string
  invoiceNumber: string
  status: 'created' | 'processing' | 'shipped' | 'delivered' | 'canceled' | 'returned'
  paymentStatus: 'succeeded' | 'refunded' | 'partiallyRefunded'
  statusHistory: OrderStatusHistoryEntry[]
  paymentIntentId: string
  orderItems: OrderItem[]
  customer: OrderCustomer
  totals: OrderTotals
  fulfillment: Fulfillment
}
