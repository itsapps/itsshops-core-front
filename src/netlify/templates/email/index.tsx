/**
 * Email template registry + render helper.
 *
 * Customers can override individual templates by passing a `templates` map
 * to the notify function factory:
 *
 * ```ts
 * import { createNotifyHandler } from '@itsapps/itsshops-core-front/functions/order-notify'
 * import { OrderConfirmation } from './emails/OrderConfirmation'
 *
 * export default createNotifyHandler({
 *   templates: { orderConfirmation: OrderConfirmation }
 * })
 * ```
 */
import * as React from 'react'
import { render } from '@react-email/render'
import type { ComponentType } from 'react'

import { OrderEmail } from './OrderEmail'
import { SimpleEmail } from './SimpleEmail'
import type { EmailContext, OrderEmailProps, SimpleEmailProps } from './types'
import type { MailType } from '../../types/orderTransitions'
import { ORDER_SUMMARY_MAIL_TYPES } from '../../types/orderTransitions'
import type { OrderDocument } from '../../types/checkout'

export { EmailLayout } from './EmailLayout'
export { OrderEmail } from './OrderEmail'
export { SimpleEmail } from './SimpleEmail'
export type {
  EmailAddress,
  EmailBankAccount,
  EmailContext,
  EmailFormatPrice,
  EmailShopSettings,
  EmailTranslator,
  OrderEmailProps,
  SimpleEmailProps,
} from './types'

/**
 * Customer-supplied template overrides. Each entry replaces the built-in
 * template for the given MailType. Both order-summary and simple templates
 * receive their respective prop shapes.
 */
export type EmailTemplateOverrides = Partial<{
  [K in MailType]: K extends (typeof ORDER_SUMMARY_MAIL_TYPES)[number]
    ? ComponentType<OrderEmailProps>
    : ComponentType<SimpleEmailProps>
}>

/**
 * Render the matching email template for a given mailType.
 *
 * - Order-summary mailTypes render `OrderEmail` (or its override).
 * - Refund mailTypes render `SimpleEmail` (or its override) using the
 *   localized `emails.<mailType>.text` as the body and `emails.headline` as
 *   the heading.
 *
 * Returns the rendered HTML string.
 */
export async function renderMailFor(
  mailType: MailType,
  ctx: EmailContext,
  order: OrderDocument,
  overrides?: EmailTemplateOverrides,
  /** Refunded amount in cents — interpolated as `{{amount}}` into the refund emails. */
  refundAmount?: number,
): Promise<string> {
  const isOrderSummary = (ORDER_SUMMARY_MAIL_TYPES as readonly MailType[]).includes(mailType)

  if (isOrderSummary) {
    const Component =
      (overrides?.[mailType] as ComponentType<OrderEmailProps> | undefined) ?? OrderEmail
    return render(<Component ctx={ctx} order={order} mailType={mailType} />)
  }

  const Component =
    (overrides?.[mailType] as ComponentType<SimpleEmailProps> | undefined) ?? SimpleEmail
  const headline = ctx.t('emails.headline', { customerName: order.customer.billingAddress.name })
  // The simple mail types are the refund notifications, whose text references the
  // refunded amount. Use the explicit refund amount when provided, else fall back
  // to the order total (correct for a full refund).
  const amount = ctx.formatPrice(refundAmount ?? order.totals.grandTotal)
  const text = ctx.t(`emails.${mailType}.text`, { amount })
  return render(<Component ctx={ctx} headline={headline} text={text} />)
}

/**
 * Look up the localized subject for a mailType.
 */
export function subjectFor(ctx: EmailContext, mailType: MailType): string {
  return ctx.t(`emails.${mailType}.subject`)
}
