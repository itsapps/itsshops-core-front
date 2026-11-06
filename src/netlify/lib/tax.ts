import type { SanityTaxRuleResult, VatBreakdownItem, ValidatedCartItem } from '../types/checkout'

/**
 * Find the tax rate for a given tax category code in a country's tax rules.
 * Returns the rate as a percentage (e.g. 20 for 20%).
 * Falls back to defaultTaxCategoryCode if no matching rule is found,
 * then to 0 (tax exempt) if neither matches.
 */
export function findTaxRate(
  rules: SanityTaxRuleResult[],
  taxCategoryCode: string | null,
  defaultTaxCategoryCode?: string | null,
): number {
  if (rules.length === 0) return 0
  if (taxCategoryCode) {
    const rule = rules.find(r => r.taxCategoryCode === taxCategoryCode)
    if (rule) return rule.rate
  }
  if (defaultTaxCategoryCode) {
    const fallback = rules.find(r => r.taxCategoryCode === defaultTaxCategoryCode)
    if (fallback) return fallback.rate
  }
  return 0
}

/**
 * Extract VAT from a gross (tax-inclusive) price.
 * Returns the VAT amount in cents (integer).
 *
 * Formula: vat = gross - gross / (1 + rate/100)
 * Rounded to nearest cent.
 */
export function extractVat(grossCents: number, ratePercent: number): number {
  if (ratePercent <= 0) return 0
  const net = grossCents / (1 + ratePercent / 100)
  return Math.round(grossCents - net)
}

/**
 * Calculate the net amount from a gross (tax-inclusive) price.
 */
export function extractNet(grossCents: number, ratePercent: number): number {
  if (ratePercent <= 0) return grossCents
  return grossCents - extractVat(grossCents, ratePercent)
}

/**
 * Determine the shipping VAT rate from cart items.
 *
 * Shipping follows the "dominant" goods of the order: the rate whose items have the
 * largest **gross** goods value (sum of price × quantity incl. VAT, i.e. the shop
 * prices) — not the VAT amount, which would tilt the choice towards the higher rate.
 * Ties break to the higher rate (safer for the tax authority). Zero-rate items are
 * ignored; returns 0 if the cart is empty or all items are tax-exempt. A coupon reduces
 * every item by the same factor, so it never changes the result.
 */
export function dominantItemVatRate(items: ValidatedCartItem[]): number {
  const grossByRate = new Map<number, number>()
  for (const part of items.flatMap(vatParts)) {
    if (part.vatRate <= 0) continue
    grossByRate.set(part.vatRate, (grossByRate.get(part.vatRate) ?? 0) + part.gross)
  }
  let bestRate = 0
  let bestGross = -1
  for (const [rate, gross] of grossByRate) {
    if (gross > bestGross || (gross === bestGross && rate > bestRate)) {
      bestRate = rate
      bestGross = gross
    }
  }
  return bestRate
}

/**
 * The gross amounts (cents, × line quantity) and VAT rates a cart line is taxed by. A bundle is
 * taxed by its items: one part per item (its price share × the line quantity, its own rate). Any
 * other line — and a bundle without split items — is one part at its own rate.
 */
export function vatParts(
  item: Pick<ValidatedCartItem, 'price' | 'quantity' | 'vatRate' | 'bundleItems'>,
): { gross: number; vatRate: number }[] {
  if (item.bundleItems?.length) {
    return item.bundleItems.map(bi => ({ gross: bi.price * item.quantity, vatRate: bi.vatRate }))
  }
  return [{ gross: item.price * item.quantity, vatRate: item.vatRate }]
}

/**
 * Split a bundle's unit price (cents) over its items in the ratio of `weights` (each item's
 * single gross price × its quantity in the bundle). Whole cents; every share but the last is
 * rounded down, the last item takes the remainder, so the shares add up to `price` exactly and
 * none is negative. Returns `null` when no ratio is possible (no items, or all weights ≤ 0).
 */
export function splitBundlePrice(price: number, weights: number[]): number[] | null {
  const total = weights.reduce((sum, w) => sum + w, 0)
  if (weights.length === 0 || total <= 0 || weights.some(w => w < 0)) return null
  const shares = weights.map(w => Math.floor((price * w) / total))
  const rest = price - shares.slice(0, -1).reduce((sum, s) => sum + s, 0)
  shares[shares.length - 1] = rest
  return shares
}

type VatLineItem = {
  grossTotal: number
  vatRate: number
}

/**
 * Build a VAT breakdown from a list of line items, grouped by rate.
 * Each item's grossTotal should already be quantity * unitPrice.
 */
export function buildVatBreakdown(items: VatLineItem[]): VatBreakdownItem[] {
  const byRate = new Map<number, { gross: number }>()

  for (const item of items) {
    const existing = byRate.get(item.vatRate)
    if (existing) {
      existing.gross += item.grossTotal
    } else {
      byRate.set(item.vatRate, { gross: item.grossTotal })
    }
  }

  const breakdown: VatBreakdownItem[] = []
  for (const [rate, { gross }] of byRate) {
    const vat = extractVat(gross, rate)
    breakdown.push({
      rate,
      net: gross - vat,
      vat,
    })
  }

  return breakdown.sort((a, b) => a.rate - b.rate)
}
