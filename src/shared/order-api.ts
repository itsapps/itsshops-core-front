/**
 * Order-facing public API types shared between client and server.
 * No runtime code — types only.
 */

export type WithdrawInput = {
  /** Consumer's name (FAGG §13a). Required, capped, no links (`checkWithdrawText`). */
  name: string
  /** Order number as typed — free text; a typo lands in the unmatched flow, not in an error. */
  orderNumber: string
  /** Email the receipt goes to. Matches the order's contactEmail → linked to the order. */
  email: string
  /** Optional free-text reason / "which items" note. */
  reason?: string
  /** Honeypot — always empty for people; filled → success response, nothing stored or sent. */
  website?: string
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
