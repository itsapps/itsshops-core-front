import type { AppliedDiscountSnapshot, OrderTotals } from '../types/checkout'

export type DiscountSummaryLine = { label: string; amount: number }

/**
 * The discount rows of an order summary (mails, invoice PDF): one per applied items/order
 * discount with `amount > 0`, labelled by its title (snapshot, order locale) or `fallbackLabel`.
 * Shipping discounts stay visible as shipping 0. The rows sum to `totals.discount`; if the stored
 * entries don't (incomplete data), one `fallbackLabel` row with `totals.discount` instead.
 */
export function discountSummaryLines(
  totals: Pick<OrderTotals, 'discount'>,
  appliedDiscounts: AppliedDiscountSnapshot[] | null | undefined,
  fallbackLabel: string,
): DiscountSummaryLine[] {
  if (!(totals.discount > 0)) return []
  const rows = (appliedDiscounts ?? [])
    .filter(d => d.target !== 'shipping' && (d.amount ?? 0) > 0)
    .map(d => ({ label: d.title?.trim() || fallbackLabel, amount: d.amount! }))
  const sum = rows.reduce((s, r) => s + r.amount, 0)
  return sum === totals.discount ? rows : [{ label: fallbackLabel, amount: totals.discount }]
}
