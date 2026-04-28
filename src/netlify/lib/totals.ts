import type { ValidatedCartItem, AvailableShippingMethod, CalculatedTotals } from '../types/checkout'
import { buildVatBreakdown } from './tax'

export type CouponDiscount = {
  /** Total cents to subtract from subtotal (before VAT calculation). */
  discountAmount: number
  /** When true, shipping cost is forced to 0 (free-shipping coupon). */
  zeroShipping: boolean
}

/**
 * Calculate the full totals for a checkout.
 * All amounts in cents.
 */
export function calculateTotals(
  items: ValidatedCartItem[],
  selectedShipping: AvailableShippingMethod | null,
  shippingVatRate: number,
  coupon: CouponDiscount | null = null,
): CalculatedTotals {
  // Subtotal = sum of (unit price * quantity) for all items
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const rawShipping = selectedShipping?.price ?? 0
  const shippingCost = coupon?.zeroShipping ? 0 : rawShipping
  const discountAmount = coupon?.discountAmount ?? 0

  // Apply discount proportionally across items so VAT breakdown stays correct.
  // Each item contributes (item.gross * discountAmount / subtotal).
  const discountFactor = subtotal > 0 ? discountAmount / subtotal : 0

  const vatLineItems = items.map(item => {
    const itemGross = item.price * item.quantity
    const discountedGross = itemGross - itemGross * discountFactor
    return { grossTotal: discountedGross, vatRate: item.vatRate }
  })

  // Add shipping as a VAT line item if it has a cost
  if (shippingCost > 0) {
    vatLineItems.push({ grossTotal: shippingCost, vatRate: shippingVatRate })
  }

  const vatBreakdown = buildVatBreakdown(vatLineItems)
  const totalVat = vatBreakdown.reduce((sum, entry) => sum + entry.vat, 0)

  const grandTotal = subtotal - discountAmount + shippingCost

  return {
    subtotal,
    shipping: shippingCost,
    discount: discountAmount,
    tax: totalVat,
    grandTotal,
    vatBreakdown,
  }
}
