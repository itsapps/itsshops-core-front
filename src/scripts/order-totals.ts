import type { CalculateResponse } from '../shared/checkout-api'
import { cloneTemplate, fillSlot } from './template-utils'

export type TotalsLabels = {
  subtotal: string
  shipping: string
  total: string
  vat: string
  vatExempt: string
  discount?: string
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
  renderRows(container, [
    { label: labels.subtotal, value: formatPrice(totals.subtotal) },
    // One row per applied discount that saved something (shipping ones too — shipping then
    // reads "—"); label = its title, the generic label only when the title is empty.
    ...data.appliedDiscounts.filter(d => d.amount > 0).map(d => ({
      label: d.title || (labels.discount ?? 'Discount'),
      ...(d.code && d.code !== d.title && { code: d.code }),
      value: `− ${formatPrice(d.amount)}`,
      modifier: 'discount',
    })),
    { label: labels.shipping, value: totals.shipping === 0 ? '—' : formatPrice(totals.shipping) },
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
