import { allocateLargestRemainder, allocateToChildren } from './allocate'
import { areCompatible, pickCompatible, sortBySaving } from './combine'
import { checkConditions } from './conditions'
import { isExcluded, matchesSelector } from './selector'
import type {
  AppliedDiscountResult,
  DiscountError,
  DiscountInput,
  DiscountLine,
  DiscountResult,
  LineDiscount,
  PipelineInput,
  ProductSelector,
  ShippingDiscountResult,
  ShippingSelection,
} from './types'

const TARGET_ORDER = { items: 0, order: 1, shipping: 2 } as const

/** Shipping discounts: unset `appliesToPickup` = codes yes, automatic no. */
export const appliesToPickup = (d: DiscountInput): boolean => d.appliesToPickup ?? d.trigger === 'code'

/**
 * Lines a discount may apply to. items/order: matching `appliesTo` and not shop-excluded (unless
 * `ignoreShopExclusions`). shipping: the "cart contains" lines — matching and not digital
 * (digital lines are never shipping-relevant); exclusions never apply to shipping.
 */
export function eligibleLines(
  discount: DiscountInput,
  lines: DiscountLine[],
  exclusions: ProductSelector | null | undefined,
): boolean[] {
  return lines.map(line => {
    if (!matchesSelector(line.selector, discount.appliesTo)) return false
    if (discount.target === 'shipping') return line.selector.kind !== 'digital'
    return discount.ignoreShopExclusions === true || !isExcluded(line.selector, exclusions)
  })
}

/**
 * One items/order discount on what earlier ones left (`remaining`, gross per line). Per line,
 * never above the remaining amount.
 * - percent: `floor(Σ remaining eligible × value / 100)` by largest remainder (today's coupon
 *   rounding — a migrated coupon gives the same total);
 * - items + fixed: `min(value × quantity, remaining)` per line;
 * - order + fixed: `min(value, Σ remaining eligible)` by largest remainder.
 */
export function computeLineAmounts(
  discount: DiscountInput,
  lines: DiscountLine[],
  eligible: boolean[],
  remaining: number[],
): number[] {
  const value = discount.value ?? 0
  const weights = remaining.map((r, i) => (eligible[i] ? Math.max(0, r) : 0))
  const base = weights.reduce((sum, w) => sum + w, 0)
  if (value <= 0 || base <= 0) return lines.map(() => 0)
  switch (discount.valueType) {
    case 'percent':
      return allocateLargestRemainder(Math.floor((base * Math.min(value, 100)) / 100), weights)
    case 'fixed':
      if (discount.target === 'items') {
        return lines.map((line, i) => Math.min(Math.round(value) * line.quantity, weights[i]))
      }
      return allocateLargestRemainder(Math.min(Math.round(value), base), weights)
    default:
      // `free` is for shipping only (core-back validation); nothing to take off lines.
      return lines.map(() => 0)
  }
}

/** The waived selected shipping cost: 0 when nothing is selected, it is already free, or a
 * pickup method that the discount doesn't cover. */
function shippingAmount(discount: DiscountInput, shipping: ShippingSelection | null | undefined): number {
  if (!shipping || shipping.price <= 0) return 0
  if (shipping.methodType === 'pickup' && !appliesToPickup(discount)) return 0
  return shipping.price
}

interface Applied {
  applied: AppliedDiscountResult[]
  lineTotals: number[]
  itemsOrderTotal: number
  shipping: ShippingDiscountResult | null
  saving: number
}

/** Apply a compatible set in order items → order → shipping, each on what the earlier left. */
function applySet(
  set: DiscountInput[],
  input: PipelineInput,
  eligibility: Map<string, boolean[]>,
): Applied {
  const lines = input.lines
  const remaining = lines.map(line => line.unitPrice * line.quantity)
  const ordered = set
    .map((d, index) => ({ d, index }))
    .sort((a, b) => TARGET_ORDER[a.d.target] - TARGET_ORDER[b.d.target] || a.index - b.index)
    .map(entry => entry.d)

  const applied: AppliedDiscountResult[] = []
  let shipping: ShippingDiscountResult | null = null
  for (const discount of ordered) {
    if (discount.target === 'shipping') {
      const entry: ShippingDiscountResult = {
        discount,
        amount: shippingAmount(discount, input.shipping),
        lineAmounts: lines.map(() => 0),
        appliesToPickup: appliesToPickup(discount),
      }
      shipping = entry
      applied.push(entry)
      continue
    }
    const lineAmounts = computeLineAmounts(discount, lines, eligibility.get(discount._id)!, remaining)
    lineAmounts.forEach((amount, i) => { remaining[i] -= amount })
    applied.push({ discount, amount: lineAmounts.reduce((sum, a) => sum + a, 0), lineAmounts })
  }

  const lineTotals = lines.map((line, i) => line.unitPrice * line.quantity - remaining[i])
  const itemsOrderTotal = lineTotals.reduce((sum, a) => sum + a, 0)
  return { applied, lineTotals, itemsOrderTotal, shipping, saving: itemsOrderTotal + (shipping?.amount ?? 0) }
}

/**
 * The discount pipeline: candidates (code + automatic) → eligible lines + conditions →
 * combinability (at most one code; the larger saving wins, tie → the code) → apply items →
 * order → shipping → per-line and per-bundle-item cents. Pure.
 *
 * Shipping: the result names the shipping discount; the caller waives every delivery method
 * (and pickup methods with `appliesToPickup`) after selecting the method on real prices.
 */
export function evaluateDiscounts(input: PipelineInput): DiscountResult {
  const now = input.now ?? new Date()
  const lines = input.lines
  const code = input.couponCode?.trim() || null
  const eligibility = new Map<string, boolean[]>()
  const isValid = (d: DiscountInput) => {
    const eligible = eligibleLines(d, lines, input.exclusions)
    eligibility.set(d._id, eligible)
    return checkConditions({ discount: d, lines, eligible, now, emailRedemptions: input.emailRedemptions })
  }

  // ── Candidates ──────────────────────────────────────────────────────────
  let couponError: DiscountError | null = null
  let codeDiscount: DiscountInput | null = null
  if (code) {
    const found = input.codeDiscount
    const error = found ? isValid(found) : 'COUPON_NOT_FOUND'
    if (error) couponError = { code, errorCode: error }
    else codeDiscount = found!
  }
  const automatic = (input.automaticDiscounts ?? []).filter(d => d.trigger === 'automatic' && !isValid(d))

  // ── Combinability ───────────────────────────────────────────────────────
  const alone = new Map(automatic.map(d => [d._id, applySet([d], input, eligibility).saving]))
  const sorted = sortBySaving(automatic, d => alone.get(d._id)!)
  const autoSet = pickCompatible(sorted)
  let chosen = autoSet
  if (codeDiscount) {
    const codeSet = pickCompatible(sorted, [codeDiscount])
    const autoSaving = applySet(autoSet, input, eligibility).saving
    const codeSaving = applySet(codeSet, input, eligibility).saving
    if (codeSaving >= autoSaving) {
      chosen = codeSet
    } else {
      // `sorted` is by saving, so the first incompatible one is the highest-saving.
      const blocker = autoSet.find(d => !areCompatible(codeDiscount!, d)) ?? autoSet[0]
      couponError = { code: code!, errorCode: 'COUPON_NOT_COMBINABLE', discountTitle: blocker?.title }
      codeDiscount = null
    }
  }

  // ── Apply + allocate ────────────────────────────────────────────────────
  const result = applySet(chosen, input, eligibility)
  const lineDiscounts: LineDiscount[] = lines.map((line, i) => ({
    discount: result.lineTotals[i],
    children: line.childPrices?.length ? allocateToChildren(result.lineTotals[i], line.childPrices) : null,
  }))
  const notDiscountedLines =
    codeDiscount && codeDiscount.target !== 'shipping'
      ? eligibility.get(codeDiscount._id)!.flatMap((ok, i) => (ok ? [] : [i]))
      : []

  return {
    applied: result.applied,
    lines: lineDiscounts,
    itemsOrderTotal: result.itemsOrderTotal,
    shipping: result.shipping,
    couponError,
    notDiscountedLines,
  }
}

/** Whether the result's shipping discount waives a method of this type. */
export function waivesShipping(result: Pick<DiscountResult, 'shipping'>, methodType: 'delivery' | 'pickup'): boolean {
  if (!result.shipping) return false
  return methodType === 'delivery' || result.shipping.appliesToPickup
}
