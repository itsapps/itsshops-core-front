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

import { OrderMailTemplate } from './orderMailTemplate'
import { SimpleMailTemplate } from './simpleMailTemplate'
import type { EmailContext, OrderEmailProps, SimpleEmailProps } from './types'
import type { MailType } from '../types/orderTransitions'
import { ORDER_SUMMARY_MAIL_TYPES } from '../types/orderTransitions'
import type { OrderDocument } from '../types/checkout'

export { BaseMailTemplate } from './baseMailTemplate'
export { OrderMailTemplate } from './orderMailTemplate'
export { SimpleMailTemplate } from './simpleMailTemplate'
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
 * - Order-summary mailTypes render `OrderMailTemplate` (or its override).
 * - Refund mailTypes render `SimpleMailTemplate` (or its override) using the
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
): Promise<string> {
  const isOrderSummary = (ORDER_SUMMARY_MAIL_TYPES as readonly MailType[]).includes(mailType)

  if (isOrderSummary) {
    const Component =
      (overrides?.[mailType] as ComponentType<OrderEmailProps> | undefined) ?? OrderMailTemplate
    return render(<Component ctx={ctx} order={order} mailType={mailType} />)
  }

  const Component =
    (overrides?.[mailType] as ComponentType<SimpleEmailProps> | undefined) ?? SimpleMailTemplate
  const headline = ctx.t('emails.headline', { customerName: order.customer.billingAddress.name })
  const text = ctx.t(`emails.${mailType}.text`)
  return render(<Component ctx={ctx} headline={headline} text={text} />)
}

/**
 * Look up the localized subject for a mailType.
 */
export function subjectFor(ctx: EmailContext, mailType: MailType): string {
  return ctx.t(`emails.${mailType}.subject`)
}
