import type { ValidatedCartItem, AvailableShippingMethod, CalculatedTotals } from '../types/checkout'
import { extractVat, buildVatBreakdown } from './tax'

/**
 * Calculate the full totals for a checkout.
 * All amounts in cents.
 */
export function calculateTotals(
  items: ValidatedCartItem[],
  selectedShipping: AvailableShippingMethod | null,
  shippingVatRate: number,
): CalculatedTotals {
  // Subtotal = sum of (unit price * quantity) for all items
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const shippingCost = selectedShipping?.price ?? 0

  // Build VAT line items from cart items
  const vatLineItems = items.map(item => ({
    grossTotal: item.price * item.quantity,
    vatRate: item.vatRate,
  }))

  // Add shipping as a VAT line item if it has a cost
  if (shippingCost > 0) {
    vatLineItems.push({ grossTotal: shippingCost, vatRate: shippingVatRate })
  }

  const vatBreakdown = buildVatBreakdown(vatLineItems)
  const totalVat = vatBreakdown.reduce((sum, entry) => sum + entry.vat, 0)

  const grandTotal = subtotal + shippingCost

  return {
    subtotal,
    shipping: shippingCost,
    discount: 0, // vouchers not yet implemented
    tax: totalVat,
    grandTotal,
    vatBreakdown,
  }
}
