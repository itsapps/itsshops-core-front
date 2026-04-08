/**
 * Pure (no HTTP, no auth, no CORS) helper that loads an order, renders the
 * matching email template + optional invoice PDF, and sends it via Mailgun.
 *
 * Used by:
 *   - `functions/order-notify.tsx`  — studio-triggered HTTP endpoint
 *   - `functions/payment-webhooks.ts` — Stripe `payment_intent.succeeded`
 *
 * Throws `OrderNotifierError` with a typed code so callers can map failures
 * to HTTP responses (HTTP handler) or just log them (webhook).
 */
import * as React from 'react'
import type { ComponentType } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'

import { sendMail } from '../services/mailgun'
import { fetchEmailSettings, fetchOrderById } from '../services/sanity'
import { renderMailFor, subjectFor, type EmailTemplateOverrides } from '../templates/index'
import { InvoicePdf, type InvoicePdfProps } from '../templates/invoicePdf'
import type { EmailContext, EmailShopSettings } from '../templates/types'
import type { MailType } from '../types/orderTransitions'
import { ErrorCode } from '../types/errors'
import { formatPrice as fmtPrice, serverT } from '../utils/i18n'

const MAIL_TYPES_WITH_INVOICE: ReadonlyArray<MailType> = ['orderInvoice']

export type SendOrderNotificationOptions = {
  /** Customer-supplied template overrides keyed by MailType. */
  templates?: EmailTemplateOverrides
  /** Customer-supplied invoice PDF component. */
  invoicePdf?: ComponentType<InvoicePdfProps>
  /** Public base URL of the shop (defaults to process.env.URL). */
  baseUrl?: string
  /** Force-attach the invoice PDF regardless of mailType. */
  attachInvoice?: boolean
}

export type SendOrderNotificationResult = {
  messageId: string
  to: string
  mailType: MailType
}

export class OrderNotifierError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly httpStatus: number = 500,
  ) {
    super(message)
    this.name = 'OrderNotifierError'
  }
}

export async function sendOrderNotification(
  orderId: string,
  mailType: MailType,
  options: SendOrderNotificationOptions = {},
): Promise<SendOrderNotificationResult> {
  const order = await fetchOrderById(orderId)
  if (!order) {
    throw new OrderNotifierError(ErrorCode.ORDER_NOT_FOUND, `Order not found: ${orderId}`, 404)
  }

  const locale = order.customer.locale || 'de'
  const settingsRaw = await fetchEmailSettings(locale)
  if (!settingsRaw?.senderEmail || !settingsRaw.senderName || !settingsRaw.shopName) {
    throw new OrderNotifierError(
      ErrorCode.INTERNAL_ERROR,
      'shopSettings.senderEmail / senderName / settings.siteTitle must be set',
      500,
    )
  }

  const settings: EmailShopSettings = {
    shopName: settingsRaw.shopName,
    senderName: settingsRaw.senderName,
    senderEmail: settingsRaw.senderEmail,
    baseUrl: options.baseUrl ?? process.env.URL ?? '',
    logoUrl: null,
    logoWidth: null,
    logoHeight: null,
    billingAddress: settingsRaw.billingAddress
      ? {
          line1: settingsRaw.billingAddress.line1 ?? '',
          line2: settingsRaw.billingAddress.line2 ?? null,
          zip: settingsRaw.billingAddress.zip ?? '',
          city: settingsRaw.billingAddress.city ?? '',
          country: settingsRaw.billingAddress.country ?? '',
        }
      : null,
    bankAccount:
      settingsRaw.bankAccount?.name &&
      settingsRaw.bankAccount.iban &&
      settingsRaw.bankAccount.bic
        ? {
            name: settingsRaw.bankAccount.name,
            iban: settingsRaw.bankAccount.iban,
            bic: settingsRaw.bankAccount.bic,
          }
        : null,
    orderNumberPrefix: settingsRaw.orderNumberPrefix,
    invoiceNumberPrefix: settingsRaw.invoiceNumberPrefix,
  }

  const ctx: EmailContext = {
    locale,
    t: (key, params) => serverT(locale, key, params),
    formatPrice: (cents) => fmtPrice(cents, locale),
    settings,
  }

  const html = await renderMailFor(mailType, ctx, order, options.templates)
  const subject = subjectFor(ctx, mailType)
  const text = ctx.t(`emails.${mailType}.text`)

  const wantsInvoice = options.attachInvoice === true || MAIL_TYPES_WITH_INVOICE.includes(mailType)
  let attachments: { filename: string; data: Buffer; contentType: string }[] | undefined
  if (wantsInvoice) {
    const InvoiceComponent = options.invoicePdf ?? InvoicePdf
    const pdfBuffer = await renderToBuffer(<InvoiceComponent ctx={ctx} order={order} />)
    attachments = [
      {
        filename: `${order.invoiceNumber}.pdf`,
        data: pdfBuffer,
        contentType: 'application/pdf',
      },
    ]
  }

  const result = await sendMail({
    from: `${settings.senderName} <${settings.senderEmail}>`,
    to: order.customer.contactEmail,
    subject,
    text,
    html,
    ...(attachments && { attachments }),
  })

  return {
    messageId: result.id ?? 'unknown',
    to: order.customer.contactEmail,
    mailType,
  }
}
