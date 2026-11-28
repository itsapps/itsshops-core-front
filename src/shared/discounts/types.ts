// Discount pipeline types. Pure and browser-safe: used by checkout (`payment-create`) and the
// build (derived `grantsFreeShipping`).

export type ProductKind = 'wine' | 'physical' | 'digital' | 'bundle'

/**
 * What the selector sees of one cart line / variant. Each side builds it with an adapter
 * (checkout: `cart-validator.ts`; build: `selectorLineFromResolved`), so the matcher never sees
 * either shape.
 */
export interface SelectorLine {
  variantId: string
  productId: string
  kind: ProductKind
  /** Effective categories (variant's if non-empty, else the product's) plus all ancestors. */
  categoryIds: string[]
  manufacturerIds: string[]
  /** `compareAtPrice > price` (variant → product fallback on both). */
  hasCompareAtPrice: boolean
}

/** One side of a product selector, references flattened to id arrays (`projection.ts`). */
export interface SelectorCriteria {
  kinds?: string[] | null
  categoryIds?: string[] | null
  manufacturerIds?: string[] | null
  productIds?: string[] | null
  variantIds?: string[] | null
  hasCompareAtPrice?: boolean | null
}

export interface ProductSelector {
  include?: SelectorCriteria | null
  exclude?: SelectorCriteria | null
}

export type DiscountTrigger = 'code' | 'automatic'
export type DiscountTarget = 'items' | 'order' | 'shipping'
export type DiscountValueType = 'percent' | 'fixed' | 'free'

export interface DiscountCombinesWith {
  items?: boolean | null
  order?: boolean | null
  shipping?: boolean | null
}

/** A discount as the pipeline reads it — the projection's shape with `title` resolved. */
export interface DiscountInput {
  _id: string
  /** In the order's locale (`toDiscountInput`). */
  title: string
  trigger: DiscountTrigger
  code?: string | null
  enabled?: boolean | null
  target: DiscountTarget
  valueType: DiscountValueType
  /** percent 0–100, or cents. */
  value?: number | null
  appliesTo?: ProductSelector | null
  ignoreShopExclusions?: boolean | null
  minSubtotal?: number | null
  minSubtotalBasis?: 'wholeCart' | 'matching' | null
  minQuantity?: number | null
  validFrom?: string | null
  validTo?: string | null
  maxRedemptions?: number | null
  maxPerEmail?: number | null
  redemptionCount?: number | null
  combinesWith?: DiscountCombinesWith | null
  /** Shipping target only; unset = code yes, automatic no (`appliesToPickup`). */
  appliesToPickup?: boolean | null
}

/** One cart line as the pipeline needs it. */
export interface DiscountLine {
  selector: SelectorLine
  /** Gross unit price, cents. */
  unitPrice: number
  quantity: number
  /**
   * Bundle lines: each item's gross price share of **one** bundle (`ValidatedBundleItem.price`),
   * in the bundle's item order — the line's discount is split over them by these weights.
   */
  childPrices?: number[] | null
}

export interface ShippingSelection {
  /** Price of the selected method after the free-shipping threshold, before any discount. */
  price: number
  methodType: 'delivery' | 'pickup'
}

/** Same strings as `ErrorCode` in `netlify/types/errors.ts`. */
export type DiscountErrorCode =
  | 'COUPON_NOT_FOUND'
  | 'COUPON_DISABLED'
  | 'COUPON_EXPIRED'
  | 'COUPON_NOT_YET_VALID'
  | 'COUPON_EXHAUSTED'
  | 'COUPON_BELOW_MINIMUM'
  | 'COUPON_NOT_APPLICABLE'
  | 'COUPON_LIMIT_PER_EMAIL'
  | 'COUPON_BELOW_MIN_QUANTITY'
  | 'COUPON_NOT_COMBINABLE'

export interface DiscountError {
  /** The code as the customer typed it (trimmed). */
  code: string
  errorCode: DiscountErrorCode
  /** `COUPON_NOT_COMBINABLE`: the automatic discount that won. */
  discountTitle?: string
}

export interface PipelineInput {
  lines: DiscountLine[]
  /** What the customer typed (`null` = no code, or codes are off). */
  couponCode?: string | null
  /** The `discount` with that code, if any (any state — conditions answer disabled/expired). */
  codeDiscount?: DiscountInput | null
  /** Published automatic discounts with `enabled == true`. */
  automaticDiscounts?: DiscountInput[] | null
  /** `shopSettings.discountExclusions` — never discounted by items/order discounts. */
  exclusions?: ProductSelector | null
  /** The selected method; `null` = none selected (no shipping saving). */
  shipping?: ShippingSelection | null
  now?: Date
  /**
   * Orders per discount id already placed with the customer's email (`maxPerEmail`). Only on
   * `createPayment`; a discount missing here is not checked.
   */
  emailRedemptions?: Record<string, number> | null
}

export interface AppliedDiscountResult {
  discount: DiscountInput
  /** Cents saved: items/order = sum of `lineAmounts`; shipping = the waived selected price. */
  amount: number
  /** Per input line (items/order); all 0 for shipping. */
  lineAmounts: number[]
}

export interface LineDiscount {
  /** Gross cents off the whole line (all units). */
  discount: number
  /** Bundle lines: the discount split over `childPrices` (sums to `discount`); else `null`. */
  children: number[] | null
}

export interface ShippingDiscountResult extends AppliedDiscountResult {
  /** Whether the waiver also applies to pickup methods. Delivery methods are always waived. */
  appliesToPickup: boolean
}

export interface DiscountResult {
  /** In apply order (items → order → shipping). */
  applied: AppliedDiscountResult[]
  /** Aligned with the input lines. */
  lines: LineDiscount[]
  /** Items + order discounts (= `totals.discount`). */
  itemsOrderTotal: number
  /** The applied shipping discount (at most one), also in `applied`. */
  shipping: ShippingDiscountResult | null
  couponError: DiscountError | null
  /** Lines the applied code discount (items/order) skipped — the checkout hint. */
  notDiscountedLines: number[]
}
