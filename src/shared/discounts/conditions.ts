import type { DiscountErrorCode, DiscountInput, DiscountLine } from './types'

/** What a condition sees: the discount, the cart, which lines the discount may apply to. */
export interface ConditionContext {
  discount: DiscountInput
  lines: DiscountLine[]
  /** Per line: matches `appliesTo` (and, for items/order, not shop-excluded). */
  eligible: boolean[]
  now: Date
  emailRedemptions?: Record<string, number> | null
}

/**
 * One condition: `null` = passes, else the error a code discount reports. Extension point — a
 * new condition (logged in, customer group, first order, country) is one entry here plus its
 * field in core-back's `discount` schema.
 */
export interface DiscountCondition {
  key: string
  evaluate(ctx: ConditionContext): DiscountErrorCode | null
}

const lineGross = (line: DiscountLine) => line.unitPrice * line.quantity
const isSet = (n: number | null | undefined): n is number => typeof n === 'number' && n > 0

/** In check order: the first failing one is reported. */
export const discountConditions: DiscountCondition[] = [
  {
    key: 'enabled',
    evaluate: ({ discount }) => (discount.enabled === true ? null : 'COUPON_DISABLED'),
  },
  {
    key: 'validFrom',
    evaluate: ({ discount, now }) =>
      discount.validFrom && new Date(discount.validFrom).getTime() > now.getTime()
        ? 'COUPON_NOT_YET_VALID'
        : null,
  },
  {
    key: 'validTo',
    evaluate: ({ discount, now }) =>
      discount.validTo && new Date(discount.validTo).getTime() < now.getTime() ? 'COUPON_EXPIRED' : null,
  },
  {
    key: 'maxRedemptions',
    evaluate: ({ discount }) =>
      typeof discount.maxRedemptions === 'number' && (discount.redemptionCount ?? 0) >= discount.maxRedemptions
        ? 'COUPON_EXHAUSTED'
        : null,
  },
  {
    // Codes only (core-back hides it on automatic discounts); needs the email → createPayment.
    key: 'maxPerEmail',
    evaluate: ({ discount, emailRedemptions }) => {
      if (discount.trigger !== 'code' || !isSet(discount.maxPerEmail)) return null
      const used = emailRedemptions?.[discount._id]
      return typeof used === 'number' && used >= discount.maxPerEmail ? 'COUPON_LIMIT_PER_EMAIL' : null
    },
  },
  {
    key: 'applicable',
    evaluate: ({ eligible }) => (eligible.some(Boolean) ? null : 'COUPON_NOT_APPLICABLE'),
  },
  {
    key: 'minSubtotal',
    evaluate: ({ discount, lines, eligible }) => {
      if (!isSet(discount.minSubtotal)) return null
      const basis = discount.minSubtotalBasis === 'matching'
        ? lines.reduce((sum, line, i) => sum + (eligible[i] ? lineGross(line) : 0), 0)
        : lines.reduce((sum, line) => sum + lineGross(line), 0)
      return basis < discount.minSubtotal ? 'COUPON_BELOW_MINIMUM' : null
    },
  },
  {
    // Units of matching lines; a bundle counts as 1 per quantity (not its bottles).
    key: 'minQuantity',
    evaluate: ({ discount, lines, eligible }) => {
      if (!isSet(discount.minQuantity)) return null
      const units = lines.reduce((sum, line, i) => sum + (eligible[i] ? line.quantity : 0), 0)
      return units < discount.minQuantity ? 'COUPON_BELOW_MIN_QUANTITY' : null
    },
  },
]

export function checkConditions(
  ctx: ConditionContext,
  conditions: DiscountCondition[] = discountConditions,
): DiscountErrorCode | null {
  for (const condition of conditions) {
    const error = condition.evaluate(ctx)
    if (error) return error
  }
  return null
}

/**
 * A discount with no condition besides `appliesTo` — the build may show it as a static claim
 * (card note, schema.org shipping), since it can't go stale before the next deploy.
 */
export function isUnconditional(discount: DiscountInput): boolean {
  return (
    !isSet(discount.minSubtotal) &&
    !isSet(discount.minQuantity) &&
    !discount.validFrom &&
    !discount.validTo &&
    discount.maxRedemptions == null &&
    discount.maxPerEmail == null
  )
}
