/**
 * Order-facing public API types shared between client and server.
 * No runtime code — types only.
 */

export type WithdrawInput = {
  /** Human order number the customer received (e.g. "2024-001"). */
  orderNumber: string
  /** Email used on the order — must match the order's contactEmail. */
  email: string
  /** Optional free-text reason / "which items" note. */
  reason?: string
  captchaToken?: string
}

export type WithdrawResult = {
  redirectUrl: string
}

/** GET `ORDER_STATUS_PATH?payment_intent=pi_…` → 200 `OrderStatusResult` | 404 (no order yet). */
export const ORDER_STATUS_PATH = '/api/order/status'

export type OrderStatusResult = {
  /** Only the order number — the endpoint never returns personal data. */
  orderNumber: string
}
