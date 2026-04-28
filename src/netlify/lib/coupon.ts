import { ErrorCode } from '../types/errors'
import type { SanityCouponResult, AppliedCouponSnapshot } from '../types/checkout'

export type CouponValidationFailure = {
  ok: false
  code: string
  errorCode: ErrorCode
}

export type CouponValidationSuccess = {
  ok: true
  coupon: SanityCouponResult
  discountAmount: number
  zeroShipping: boolean
}

export type CouponValidationResult = CouponValidationFailure | CouponValidationSuccess

/**
 * Validate a fetched coupon against the current cart state and compute its
 * discount. Pure function — does not perform any I/O.
 *
 * @param subtotal      Gross sum of cart items in cents (before discount)
 * @param shippingCost  Gross shipping cost in cents (used for freeShipping coupons)
 */
export function validateCoupon(
  inputCode: string,
  coupon: SanityCouponResult | null,
  subtotal: number,
  shippingCost: number,
): CouponValidationResult {
  const code = inputCode.trim()

  if (!coupon) {
    return { ok: false, code, errorCode: ErrorCode.COUPON_NOT_FOUND }
  }
  if (!coupon.enabled) {
    return { ok: false, code, errorCode: ErrorCode.COUPON_DISABLED }
  }

  const now = Date.now()
  if (coupon.validFrom && new Date(coupon.validFrom).getTime() > now) {
    return { ok: false, code, errorCode: ErrorCode.COUPON_NOT_YET_VALID }
  }
  if (coupon.validTo && new Date(coupon.validTo).getTime() < now) {
    return { ok: false, code, errorCode: ErrorCode.COUPON_EXPIRED }
  }

  if (
    typeof coupon.maxRedemptions === 'number' &&
    typeof coupon.redemptionCount === 'number' &&
    coupon.redemptionCount >= coupon.maxRedemptions
  ) {
    return { ok: false, code, errorCode: ErrorCode.COUPON_EXHAUSTED }
  }

  if (typeof coupon.minSubtotal === 'number' && subtotal < coupon.minSubtotal) {
    return { ok: false, code, errorCode: ErrorCode.COUPON_BELOW_MINIMUM }
  }

  // Compute discount
  let discountAmount = 0
  let zeroShipping = false

  if (coupon.discountType === 'percent' && typeof coupon.value === 'number') {
    discountAmount = Math.floor((subtotal * coupon.value) / 100)
  } else if (coupon.discountType === 'fixed' && typeof coupon.value === 'number') {
    discountAmount = Math.min(coupon.value, subtotal)
  } else if (coupon.discountType === 'freeShipping') {
    zeroShipping = shippingCost > 0
  }

  return { ok: true, coupon, discountAmount, zeroShipping }
}

/**
 * Build the orderMeta snapshot entry for a successfully applied coupon.
 */
export function buildAppliedCouponSnapshot(
  coupon: SanityCouponResult,
  discountAmount: number,
): AppliedCouponSnapshot {
  return {
    _key: crypto.randomUUID(),
    _type: 'appliedCoupon',
    couponRef: { _type: 'reference', _ref: coupon._id, _weak: true },
    code: coupon.code,
    discountType: coupon.discountType,
    value: coupon.value,
    discountAmount,
  }
}
