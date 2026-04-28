import { describe, it, expect } from 'vitest'
import { validateCoupon, buildAppliedCouponSnapshot } from '../lib/coupon'
import { ErrorCode } from '../types/errors'
import type { SanityCouponResult } from '../types/checkout'

function makeCoupon(overrides: Partial<SanityCouponResult> = {}): SanityCouponResult {
  return {
    _id: 'coupon-1',
    code: 'SUMMER25',
    enabled: true,
    discountType: 'percent',
    value: 10,
    validFrom: null,
    validTo: null,
    minSubtotal: null,
    maxRedemptions: null,
    redemptionCount: 0,
    ...overrides,
  }
}

describe('validateCoupon', () => {
  it('rejects when coupon is null (not found)', () => {
    const r = validateCoupon('UNKNOWN', null, 1000, 500)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errorCode).toBe(ErrorCode.COUPON_NOT_FOUND)
      expect(r.code).toBe('UNKNOWN')
    }
  })

  it('rejects disabled coupons', () => {
    const r = validateCoupon('X', makeCoupon({ enabled: false }), 1000, 0)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errorCode).toBe(ErrorCode.COUPON_DISABLED)
  })

  it('rejects expired coupons', () => {
    const past = new Date(Date.now() - 86400000).toISOString()
    const r = validateCoupon('X', makeCoupon({ validTo: past }), 1000, 0)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errorCode).toBe(ErrorCode.COUPON_EXPIRED)
  })

  it('rejects coupons not yet valid', () => {
    const future = new Date(Date.now() + 86400000).toISOString()
    const r = validateCoupon('X', makeCoupon({ validFrom: future }), 1000, 0)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errorCode).toBe(ErrorCode.COUPON_NOT_YET_VALID)
  })

  it('rejects exhausted coupons', () => {
    const r = validateCoupon('X', makeCoupon({ maxRedemptions: 5, redemptionCount: 5 }), 1000, 0)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errorCode).toBe(ErrorCode.COUPON_EXHAUSTED)
  })

  it('rejects when below minSubtotal', () => {
    const r = validateCoupon('X', makeCoupon({ minSubtotal: 5000 }), 4999, 0)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errorCode).toBe(ErrorCode.COUPON_BELOW_MINIMUM)
  })

  it('accepts valid percent coupon and computes discount', () => {
    const r = validateCoupon('X', makeCoupon({ discountType: 'percent', value: 10 }), 1000, 500)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.discountAmount).toBe(100) // 10% of 1000
      expect(r.zeroShipping).toBe(false)
    }
  })

  it('accepts valid fixed coupon and computes discount', () => {
    const r = validateCoupon('X', makeCoupon({ discountType: 'fixed', value: 250 }), 1000, 500)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.discountAmount).toBe(250)
      expect(r.zeroShipping).toBe(false)
    }
  })

  it('caps fixed discount at subtotal', () => {
    const r = validateCoupon('X', makeCoupon({ discountType: 'fixed', value: 5000 }), 1000, 500)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.discountAmount).toBe(1000)
  })

  it('accepts freeShipping coupon and zeros shipping', () => {
    const r = validateCoupon(
      'X',
      makeCoupon({ discountType: 'freeShipping', value: null }),
      1000,
      500,
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.discountAmount).toBe(0)
      expect(r.zeroShipping).toBe(true)
    }
  })

  it('freeShipping with zero shipping cost does not flag zeroShipping', () => {
    const r = validateCoupon(
      'X',
      makeCoupon({ discountType: 'freeShipping', value: null }),
      1000,
      0,
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.zeroShipping).toBe(false)
  })

  it('floor-rounds percent discount', () => {
    // 333 * 10% = 33.3 → 33
    const r = validateCoupon('X', makeCoupon({ discountType: 'percent', value: 10 }), 333, 0)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.discountAmount).toBe(33)
  })
})

describe('buildAppliedCouponSnapshot', () => {
  it('produces a snapshot with weak ref to the coupon doc', () => {
    const c = makeCoupon({ _id: 'coupon-abc', code: 'TEST10', value: 10 })
    const snap = buildAppliedCouponSnapshot(c, 100)
    expect(snap._type).toBe('appliedCoupon')
    expect(snap.couponRef).toEqual({
      _type: 'reference',
      _ref: 'coupon-abc',
      _weak: true,
    })
    expect(snap.code).toBe('TEST10')
    expect(snap.discountType).toBe('percent')
    expect(snap.value).toBe(10)
    expect(snap.discountAmount).toBe(100)
    expect(typeof snap._key).toBe('string')
    expect(snap._key.length).toBeGreaterThan(0)
  })
})
