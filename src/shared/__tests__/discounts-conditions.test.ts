import { describe, it, expect } from 'vitest'
import { checkConditions, isUnconditional } from '../discounts/conditions'
import type { DiscountInput, DiscountLine } from '../discounts/types'
import { discount, line } from './discounts-fixtures'

const now = new Date('2026-11-20T12:00:00Z')

function check(d: DiscountInput, lines: DiscountLine[] = [line(1000)], eligible = lines.map(() => true), emailRedemptions?: Record<string, number>) {
  return checkConditions({ discount: d, lines, eligible, now, emailRedemptions })
}

describe('discount conditions', () => {
  it('passes a plain enabled discount', () => {
    expect(check(discount())).toBeNull()
  })

  it('disabled', () => {
    expect(check(discount({ enabled: false }))).toBe('COUPON_DISABLED')
    expect(check(discount({ enabled: null }))).toBe('COUPON_DISABLED')
  })

  it('date range, with boundaries', () => {
    expect(check(discount({ validFrom: '2026-11-21T00:00:00Z' }))).toBe('COUPON_NOT_YET_VALID')
    expect(check(discount({ validFrom: now.toISOString() }))).toBeNull()
    expect(check(discount({ validTo: '2026-11-19T00:00:00Z' }))).toBe('COUPON_EXPIRED')
    expect(check(discount({ validTo: now.toISOString() }))).toBeNull()
  })

  it('total limit', () => {
    expect(check(discount({ maxRedemptions: 5, redemptionCount: 5 }))).toBe('COUPON_EXHAUSTED')
    expect(check(discount({ maxRedemptions: 5, redemptionCount: 4 }))).toBeNull()
    expect(check(discount({ maxRedemptions: 1, redemptionCount: null }))).toBeNull()
  })

  it('limit per email: only with counts, only for codes', () => {
    const d = discount({ _id: 'x', maxPerEmail: 1 })
    expect(check(d)).toBeNull() // no email known (calculate)
    expect(check(d, undefined, undefined, { x: 0 })).toBeNull()
    expect(check(d, undefined, undefined, { x: 1 })).toBe('COUPON_LIMIT_PER_EMAIL')
    expect(check(discount({ _id: 'x', trigger: 'automatic', maxPerEmail: 1 }), undefined, undefined, { x: 3 })).toBeNull()
  })

  it('no eligible line → not applicable', () => {
    expect(check(discount(), [line(1000)], [false])).toBe('COUPON_NOT_APPLICABLE')
  })

  it('min subtotal on the whole cart (default), boundary inclusive', () => {
    const lines = [line(3000), line(2000)]
    expect(check(discount({ minSubtotal: 5000 }), lines, [true, false])).toBeNull()
    expect(check(discount({ minSubtotal: 5001 }), lines, [true, false])).toBe('COUPON_BELOW_MINIMUM')
  })

  it('min subtotal on matching items', () => {
    const lines = [line(3000), line(2000)]
    expect(check(discount({ minSubtotal: 3000, minSubtotalBasis: 'matching' }), lines, [true, false])).toBeNull()
    expect(check(discount({ minSubtotal: 3001, minSubtotalBasis: 'matching' }), lines, [true, false])).toBe('COUPON_BELOW_MINIMUM')
  })

  it('min quantity counts units of matching lines; a bundle counts 1 per quantity', () => {
    const lines = [line(1000, 2), line(4990, 1, { kind: 'bundle' }, [3000, 1990]), line(500, 5)]
    expect(check(discount({ minQuantity: 3 }), lines, [true, true, false])).toBeNull()
    expect(check(discount({ minQuantity: 4 }), lines, [true, true, false])).toBe('COUPON_BELOW_MIN_QUANTITY')
  })

  it('reports the first failing condition', () => {
    expect(check(discount({ enabled: false, validTo: '2020-01-01' }))).toBe('COUPON_DISABLED')
    expect(check(discount({ minSubtotal: 99999 }), [line(1)], [false])).toBe('COUPON_NOT_APPLICABLE')
  })
})

describe('isUnconditional', () => {
  it('true with only appliesTo', () => {
    expect(isUnconditional(discount({ appliesTo: { include: { kinds: ['bundle'] } } }))).toBe(true)
    expect(isUnconditional(discount({ minSubtotal: 0, minQuantity: null }))).toBe(true)
  })

  it('false with any other condition', () => {
    expect(isUnconditional(discount({ minSubtotal: 100 }))).toBe(false)
    expect(isUnconditional(discount({ minQuantity: 2 }))).toBe(false)
    expect(isUnconditional(discount({ validFrom: '2026-01-01' }))).toBe(false)
    expect(isUnconditional(discount({ validTo: '2027-01-01' }))).toBe(false)
    expect(isUnconditional(discount({ maxRedemptions: 10 }))).toBe(false)
    expect(isUnconditional(discount({ maxPerEmail: 1 }))).toBe(false)
  })
})
