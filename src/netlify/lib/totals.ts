import type { ValidatedCartItem, AvailableShippingMethod, CalculatedTotals } from '../types/checkout'
import { waivesShipping, type DiscountResult } from '../../shared/discounts'
import { buildVatBreakdown, vatParts } from './tax'

/** What the totals read of the discount pipeline result (`evaluateDiscounts`). */
export type TotalsDiscounts = Pick<DiscountResult, 'lines' | 'itemsOrderTotal' | 'shipping'>

/**
 * Calculate the full totals for a checkout. All amounts in cents.
 *
 * `discounts.lines` is aligned with `items`: each line's VAT parts (a bundle: one per item) are
 * taxed on their **discounted** gross — the line's allocated discount, for a bundle the per-item
 * split. Lines without a discount (e.g. shop-excluded) keep their full VAT. A shipping discount
 * that covers the selected method's type makes shipping 0.
 */
export function calculateTotals(
  items: ValidatedCartItem[],
  selectedShipping: AvailableShippingMethod | null,
  shippingVatRate: number,
  discounts: TotalsDiscounts | null = null,
): CalculatedTotals {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const rawShipping = selectedShipping?.price ?? 0
  const shippingWaived = !!discounts && !!selectedShipping && waivesShipping(discounts, selectedShipping.methodType)
  const shippingCost = shippingWaived ? 0 : rawShipping
  const discountAmount = discounts?.itemsOrderTotal ?? 0

  const vatLineItems = items.flatMap((item, i) => {
    const line = discounts?.lines[i]
    return vatParts(item).map((part, p) => {
      // `vatParts` splits a bundle into its items, in the order of `childPrices`.
      const partDiscount = item.bundleItems?.length ? line?.children?.[p] ?? 0 : line?.discount ?? 0
      return { grossTotal: part.gross - partDiscount, vatRate: part.vatRate }
    })
  })

  if (shippingCost > 0) {
    vatLineItems.push({ grossTotal: shippingCost, vatRate: shippingVatRate })
  }

  const vatBreakdown = buildVatBreakdown(vatLineItems)
  const totalVat = vatBreakdown.reduce((sum, entry) => sum + entry.vat, 0)

  return {
    subtotal,
    shipping: shippingCost,
    discount: discountAmount,
    tax: totalVat,
    grandTotal: subtotal - discountAmount + shippingCost,
    vatBreakdown,
  }
}
