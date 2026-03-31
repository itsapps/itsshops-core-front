import type { SanityTaxRuleResult, VatBreakdownItem } from '../types/checkout'

/**
 * Find the tax rate for a given tax category code in a country's tax rules.
 * Returns the rate as a percentage (e.g. 20 for 20%).
 * Falls back to 0 if no matching rule is found.
 */
export function findTaxRate(
  rules: SanityTaxRuleResult[],
  taxCategoryCode: string | null,
): number {
  if (!taxCategoryCode || rules.length === 0) return 0
  const rule = rules.find(r => r.taxCategoryCode === taxCategoryCode)
  return rule?.rate ?? 0
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
      label: rate > 0 ? `${rate}% VAT` : 'VAT exempt',
    })
  }

  return breakdown.sort((a, b) => a.rate - b.rate)
}
