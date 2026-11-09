/**
 * Pure (no HTTP, no auth, no CORS) helper that loads an order, renders the
 * matching email template + optional invoice PDF, and sends it via Mailgun.
 *
 * Used by:
 *   - `functions/order-notify.ts`  — studio-triggered HTTP endpoint
 *   - `functions/payment-webhooks.ts` — Stripe `payment_intent.succeeded`
 *     (customer confirmation + `sendShopOrderNotification` to the shop inbox)
 *   - `functions/wc-api.ts` — shipping mail on an ERP status update (only with `notify`)
 *
 * A sent customer mail appends a `mail` entry to `order.statusHistory` (status = mail type,
 * `source` = `historySource`, plus the customer message), so the Studio shows which mails the
 * customer got. The shop-inbox mail appends nothing; the withdrawal receipt writes its own entry
 * (`order-withdraw-notifier.tsx`).
 *
 * Throws `OrderNotifierError` with a typed code so callers can map failures
 * to HTTP responses (HTTP handler) or just log them (webhook).
 */
import type { ComponentType } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { render } from '@react-email/render'

import { sendMail } from '../services/email'
import { appendOrderHistory, fetchEmailSettings, fetchOrderById } from '../services/sanity'
import { refundMailText, renderMailFor, subjectFor, type EmailTemplateOverrides } from '../templates/email'
import { latestRefund, refundedTotal } from './order-refunds'
import { ShopOrderEmail } from '../templates/email/ShopOrderEmail'
import { InvoicePdf, type InvoicePdfProps } from '../templates/pdf/InvoicePdf'
import type { EmailContext } from '../templates/email/types'
import { buildEmailShopSettings } from './email-settings'
import type { MailType } from '../types/orderTransitions'
import { ErrorCode } from '../types/errors'
import { countryName, formatPrice as fmtPrice, serverT } from '../utils/i18n'
import { log } from '../utils/logger'
import {
  buildWithdrawalInstructions,
  missingWithdrawalData,
  type WithdrawalInstructionsInput,
} from '../../shared/withdrawal-instructions'
import type { EmailShopSettings, ShopOrderEmailProps } from '../templates/email/types'

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
  /**
   * Core issues invoices (default `true`). `false` for a shop whose invoices come from another
   * system (e.g. wineNET): the `orderInvoice` mail and `attachInvoice` are refused (400), so the
   * customer never gets a second invoice with core's numbering. Pair with core-back
   * `features.shop.invoices: false`, which hides both in the Studio.
   */
  invoices?: boolean
  /**
   * BCC the shop inbox (`settings.shopNotificationEmail`, falling back to the sender) with the
   * customer's mail. The webhook no longer uses it — it sends `sendShopOrderNotification` instead.
   */
  bccSender?: boolean
  /**
   * Include the right-of-withdrawal ("Widerruf") section + link to the withdrawal
   * page in the order-confirmation email. **Default on** (FAGG §7: the confirmation
   * must carry the withdrawal information); pass `false` only for a shop without
   * consumer withdrawal right.
   */
  withdrawalNotice?: boolean
  /**
   * Refunded amount in cents — interpolated into the refund emails. Explicit override; default:
   * the latest stored refund (`order.refunds`), for the full-refund mail else the order total.
   */
  refundAmount?: number
  /**
   * Personal message from the shop admin (plain text, studio "message to customer"),
   * shown below the intro text in the HTML mail and appended to the plain-text part.
   */
  customerMessage?: string
  /**
   * `source` of the `mail` history entry written after a successful send: `admin` (default —
   * Studio via `order-notify`), `system` (webhook confirmation), `wc-api` (ERP status update).
   */
  historySource?: string
}

export type SendShopOrderNotificationOptions = {
  /** Locale of the shop mail — the shop's default locale, not the customer's. */
  locale: string
  /** Customer-supplied template replacing `ShopOrderEmail`. */
  template?: ComponentType<ShopOrderEmailProps>
  /** Public base URL of the shop (defaults to process.env.URL). */
  baseUrl?: string
  /** Studio base URL for the "open order" button (defaults to process.env.SANITY_STUDIO_URL). */
  studioUrl?: string
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

/**
 * Full withdrawal instructions + model form for the confirmation — the same builder and wording as
 * the website's withdrawalPolicyModule. Incomplete settings → null + a warning (the mail then shows
 * the short notice), never a half-filled legal text.
 */
export function withdrawalInstructionsFor(
  settings: EmailShopSettings,
  locale: string,
  withdrawUrl: string,
) {
  const company = settings.company
  const input: WithdrawalInstructionsInput = {
    trader: {
      name: company?.name || settings.shopName,
      address: company?.address ?? settings.billingAddress,
      phone: company?.phone,
      email: company?.email || settings.senderEmail,
    },
    returnAddress: settings.returnAddress,
    returnShippingBorneBy: settings.returnShippingBorneBy ?? 'customer',
    periodStart: settings.withdrawalPeriodStart ?? 'multipleGoods',
    exceptions: settings.withdrawalExceptions ?? [],
    returnPolicyNote: settings.returnPolicyNote,
    withdrawUrl,
    countryName: (code) => countryName(locale, code),
  }
  const instructions = buildWithdrawalInstructions(input, (key, params) => serverT(locale, key, params))
  if (!instructions) {
    log.warn('Order confirmation: withdrawal instructions incomplete, sending short notice', {
      missing: missingWithdrawalData(input),
    })
  }
  return instructions
}

async function loadEmailSettings(locale: string, baseUrl?: string): Promise<EmailShopSettings> {
  const settingsRaw = await fetchEmailSettings(locale)
  if (!settingsRaw?.senderEmail || !settingsRaw.senderName || !settingsRaw.shopName) {
    throw new OrderNotifierError(
      ErrorCode.INTERNAL_ERROR,
      'shopSettings.senderEmail / senderName / settings.siteTitle must be set',
      500,
    )
  }
  return buildEmailShopSettings(settingsRaw, baseUrl ?? process.env.URL ?? '')
}

export async function sendOrderNotification(
  orderId: string,
  mailType: MailType,
  options: SendOrderNotificationOptions = {},
): Promise<SendOrderNotificationResult> {
  if (options.invoices === false && (options.attachInvoice === true || MAIL_TYPES_WITH_INVOICE.includes(mailType))) {
    throw new OrderNotifierError(
      ErrorCode.INVALID_INPUT,
      'This shop issues its invoices elsewhere — no invoice mail or PDF from the shop',
      400,
    )
  }
  const order = await fetchOrderById(orderId)
  if (!order) {
    throw new OrderNotifierError(ErrorCode.ORDER_NOT_FOUND, `Order not found: ${orderId}`, 404)
  }

  // Refund mails state an amount: the explicit one (status dialog / "Refund & close" pass what
  // they just refunded), else the latest stored refund ("Send mail", dashboard refunds), else —
  // full refund only — the order total. A partial-refund mail without any refuses to send.
  const isRefundMail = mailType === 'orderRefunded' || mailType === 'orderRefundedPartially'
  let refundAmount: number | undefined
  if (isRefundMail) {
    const explicitAmount =
      typeof options.refundAmount === 'number' && options.refundAmount > 0 ? options.refundAmount : undefined
    // "Send mail" passes no amount. Its full-refund mail says the payment is refunded in full, so
    // it is refused while the stored refunds don't cover the total (orders refunded before refunds
    // were stored have none — those keep stating the total). The status dialog / "Refund & close"
    // pass the amount Stripe refunded as the rest, so they're trusted.
    if (mailType === 'orderRefunded' && explicitAmount === undefined && order.refunds?.length) {
      const refunded = refundedTotal(order)
      if (refunded < order.totals.grandTotal) {
        throw new OrderNotifierError(
          ErrorCode.INVALID_INPUT,
          `The order is not fully refunded (${fmtPrice(refunded, 'en')} of ${fmtPrice(order.totals.grandTotal, 'en')}) — send the partial-refund mail`,
          400,
        )
      }
    }
    refundAmount =
      explicitAmount ??
      latestRefund(order)?.amount ??
      (mailType === 'orderRefunded' ? order.totals.grandTotal : undefined)
    if (refundAmount === undefined) {
      throw new OrderNotifierError(
        ErrorCode.INVALID_INPUT,
        "No refund is stored for this order — the partial-refund mail can't state an amount",
        400,
      )
    }
  }

  const locale = order.customer.locale || 'de'
  const settings = await loadEmailSettings(locale, options.baseUrl)

  // Withdrawal page URL for the confirmation's withdrawal section (default on). The slug
  // lives in the shared `urlPaths` translations, resolved via serverT.
  let withdrawUrl: string | undefined
  if ((options.withdrawalNotice ?? true) && settings.baseUrl) {
    const slug = serverT(locale, 'urlPaths.orderWithdraw')
    if (slug && slug !== 'urlPaths.orderWithdraw') {
      withdrawUrl = `${settings.baseUrl}/${locale}/${slug}/`
    }
  }

  const ctx: EmailContext = {
    locale,
    t: (key, params) => serverT(locale, key, params),
    formatPrice: (cents) => fmtPrice(cents, locale),
    settings,
    ...(withdrawUrl && { withdrawUrl }),
    ...(withdrawUrl && mailType === 'orderConfirmation' && {
      withdrawalInstructions: withdrawalInstructionsFor(settings, locale, withdrawUrl),
    }),
  }

  const customerMessage = options.customerMessage?.trim() || undefined
  const html = await renderMailFor(mailType, ctx, order, options.templates, {
    refundAmount,
    customerMessage,
  })
  const subject = subjectFor(ctx, mailType, order)
  const intro =
    refundAmount !== undefined
      ? refundMailText(ctx, mailType, order, refundAmount)
      : ctx.t(`emails.${mailType}.text`)
  const text = customerMessage ? `${intro}\n\n${customerMessage}` : intro

  const wantsInvoice = options.attachInvoice === true || MAIL_TYPES_WITH_INVOICE.includes(mailType)
  let attachment: { filename: string; data: Buffer; contentType: string } | undefined
  if (wantsInvoice) {
    const InvoiceComponent = options.invoicePdf ?? InvoicePdf
    const pdfBuffer = await renderToBuffer(<InvoiceComponent ctx={ctx} order={order} />)
    attachment = {
      filename: `${order.invoiceNumber}.pdf`,
      data: pdfBuffer,
      contentType: 'application/pdf',
    }
  }

  const result = await sendMail({
    from: `${settings.senderName} <${settings.senderEmail}>`,
    to: order.customer.contactEmail,
    ...(options.bccSender && { bcc: settings.shopNotificationEmail || settings.senderEmail }),
    subject,
    text,
    html,
    ...(attachment && { attachment }),
  })

  // The mail is out: a failed history write is logged, never reported as a failed send.
  try {
    await appendOrderHistory(order._id, [
      {
        _key: crypto.randomUUID(),
        _type: 'orderStatusHistory',
        type: 'mail',
        status: mailType,
        timestamp: new Date().toISOString(),
        source: options.historySource ?? 'admin',
        ...(customerMessage && { customerMessage }),
      },
    ])
  } catch (error) {
    log.error('Mail history entry failed', { orderId, mailType, error })
  }

  return {
    messageId: result.id ?? 'unknown',
    to: order.customer.contactEmail,
    mailType,
  }
}

/**
 * Studio link that opens an order: core-back names each workspace after its UI language and always
 * has one for the default locale, so `<studio>/<locale>/intent/edit/id=…;type=order` works
 * regardless of the desk structure. No studio URL → no link.
 */
export function studioOrderUrlFor(studioUrl: string | undefined, locale: string, orderId: string) {
  if (!studioUrl) return undefined
  return `${studioUrl.replace(/\/+$/, '')}/${locale}/intent/edit/id=${encodeURIComponent(orderId)};type=order`
}

/**
 * New-order notification to the shop inbox (`settings.shopNotificationEmail`, falling back to
 * the sender): order summary + customer contact, in the shop's locale, Reply-To the customer.
 * No warranty notice, withdrawal instructions or invoice — those are for the customer.
 */
export async function sendShopOrderNotification(
  orderId: string,
  options: SendShopOrderNotificationOptions,
): Promise<{ messageId: string; to: string }> {
  const order = await fetchOrderById(orderId)
  if (!order) {
    throw new OrderNotifierError(ErrorCode.ORDER_NOT_FOUND, `Order not found: ${orderId}`, 404)
  }

  const { locale } = options
  const settings = await loadEmailSettings(locale, options.baseUrl)
  const ctx: EmailContext = {
    locale,
    t: (key, params) => serverT(locale, key, params),
    formatPrice: (cents) => fmtPrice(cents, locale),
    settings,
  }

  const studioOrderUrl = studioOrderUrlFor(options.studioUrl ?? process.env.SANITY_STUDIO_URL, locale, orderId)
  const Template = options.template ?? ShopOrderEmail
  const html = await render(<Template ctx={ctx} order={order} studioOrderUrl={studioOrderUrl} />)
  const subject = ctx.t('emails.shopOrderConfirmation.subject', {
    orderNumber: order.orderNumber,
    customerName: order.customer.billingAddress.name,
  })
  const text = [
    ctx.t('emails.shopOrderConfirmation.headline', { orderNumber: order.orderNumber }),
    ctx.t('emails.shopOrderConfirmation.text'),
    `${ctx.t('emails.shopOrderConfirmation.customer')}: ${order.customer.billingAddress.name} <${order.customer.contactEmail}>`,
    `${ctx.t('emails.order.summaryTotal')}: ${ctx.formatPrice(order.totals.grandTotal)}`,
    ...(studioOrderUrl ? [`${ctx.t('emails.shopOrderConfirmation.openInStudio')}: ${studioOrderUrl}`] : []),
  ].join('\n\n')

  const to = settings.shopNotificationEmail || settings.senderEmail
  const result = await sendMail({
    from: `${settings.senderName} <${settings.senderEmail}>`,
    to,
    replyTo: order.customer.contactEmail,
    subject,
    text,
    html,
  })
  return { messageId: result.id ?? 'unknown', to }
}
