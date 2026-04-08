/**
 * Mirror of the order state machine vocabulary defined in core-back
 * (`src/utils/orderTransitions.ts`). Kept here as the API contract between
 * the studio document action (which decides the new state) and the
 * `/api/order/notify` netlify function (which picks the matching email).
 */

export type OrderStatus =
  | 'created'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'canceled'
  | 'returned'

export type OrderPaymentStatus = 'succeeded' | 'refunded' | 'partiallyRefunded'

export type MailType =
  | 'orderConfirmation'
  | 'orderProcessing'
  | 'orderInvoice'
  | 'orderShipping'
  | 'orderDelivered'
  | 'orderReturned'
  | 'orderCanceled'
  | 'orderRefunded'
  | 'orderRefundedPartially'

/**
 * MailTypes that render the full order summary template.
 * The remaining MailTypes (refund notifications) use the simple template.
 */
export const ORDER_SUMMARY_MAIL_TYPES: ReadonlyArray<MailType> = [
  'orderConfirmation',
  'orderProcessing',
  'orderInvoice',
  'orderShipping',
  'orderDelivered',
  'orderReturned',
  'orderCanceled',
]

export const SIMPLE_MAIL_TYPES: ReadonlyArray<MailType> = [
  'orderRefunded',
  'orderRefundedPartially',
]
