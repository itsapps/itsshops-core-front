import type { CalculateResponse } from '../shared/checkout-api'
import { cloneTemplate, fillSlot } from './template-utils'

export type TotalsLabels = {
  subtotal: string
  shipping: string
  total: string
  vat: string
  vatExempt: string
  discount?: string
  /** Shipping row value at 0 ("kostenlos"); without it the row reads "—". */
  free?: string
}

export type TotalsData = Pick<CalculateResponse, 'totals' | 'appliedDiscounts'>

type Row = { label: string; value: string; modifier?: string; code?: string }

/**
 * Render totals rows into a `<dl>` from the `totalsRow` macro template (`macros/cart.njk`).
 * All values go in via textContent — coupon codes are user input.
 */
function renderRows(container: HTMLElement, rows: Row[], templateId: string): void {
  container.replaceChildren()
  for (const row of rows) {
    const el = cloneTemplate(templateId)
    if (!el) continue
    if (row.modifier) el.classList.add(`checkout-totals__row--${row.modifier}`)
    fillSlot(el, 'label', row.label)
    if (row.code) fillSlot(el, 'code', row.code)
    fillSlot(el, 'value', row.value)
    container.appendChild(el)
  }
}

export function renderTotals(
  container: HTMLElement,
  data: TotalsData,
  labels: TotalsLabels,
  formatPrice: (cents: number) => string,
  templateId: string,
): void {
  const { totals } = data
  const saved = data.appliedDiscounts.filter(d => d.amount > 0)
  // A shipping discount is no row of its own (under the subtotal it read like a deduction from
  // it): the shipping row names it (+ the code the customer typed, unless it is the title) and
  // reads "kostenlos".
  const shippingReasons = saved
    .filter(d => d.target === 'shipping' && (d.title || d.code))
    .map(d => [d.title, d.code !== d.title && d.code].filter(Boolean).join(' · '))
  renderRows(container, [
    { label: labels.subtotal, value: formatPrice(totals.subtotal) },
    // One row per items/order discount that saved something; label = its title, the generic
    // label only when the title is empty.
    ...saved.filter(d => d.target !== 'shipping').map(d => ({
      label: d.title || (labels.discount ?? 'Discount'),
      ...(d.code && d.code !== d.title && { code: d.code }),
      value: `− ${formatPrice(d.amount)}`,
      modifier: 'discount',
    })),
    {
      label: shippingReasons.length ? `${labels.shipping} (${shippingReasons.join(', ')})` : labels.shipping,
      value: totals.shipping === 0 ? (labels.free ?? '—') : formatPrice(totals.shipping),
    },
    ...totals.vatBreakdown.map(v => ({
      label: v.rate > 0 ? `${v.rate}% ${labels.vat}` : labels.vatExempt,
      value: formatPrice(v.vat),
      modifier: 'vat',
    })),
    { label: labels.total, value: formatPrice(totals.grandTotal), modifier: 'total' },
  ], templateId)
}

/** Subtotal-only state, shown before the first server calculation. */
export function renderSubtotal(
  container: HTMLElement,
  subtotal: number,
  labels: Pick<TotalsLabels, 'subtotal'>,
  formatPrice: (cents: number) => string,
  templateId: string,
): void {
  renderRows(container, [{ label: labels.subtotal, value: formatPrice(subtotal), modifier: 'total' }], templateId)
}
