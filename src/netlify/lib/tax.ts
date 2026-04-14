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
 * Austrian tax rules allow shipping to be taxed at the rate of the "dominant"
 * goods in the order. We pick the rate that contributes the most VAT across
 * cart items; ties break to the higher rate (safer for the tax authority).
 * Returns 0 if the cart is empty or all items are tax-exempt.
 */
export function dominantItemVatRate(items: ValidatedCartItem[]): number {
  const vatByRate = new Map<number, number>()
  for (const item of items) {
    if (item.vatRate <= 0) continue
    const gross = item.price * item.quantity
    const vat = extractVat(gross, item.vatRate)
    vatByRate.set(item.vatRate, (vatByRate.get(item.vatRate) ?? 0) + vat)
  }
  if (vatByRate.size === 0) return 0
  let bestRate = 0
  let bestVat = -1
  for (const [rate, vat] of vatByRate) {
    if (vat > bestVat || (vat === bestVat && rate > bestRate)) {
      bestRate = rate
      bestVat = vat
    }
  }
  return bestRate
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
