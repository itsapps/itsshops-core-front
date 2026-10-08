/**
 * Pure helper that sends the withdrawal ("Widerruf") emails for a **stored** record:
 *   1. the receipt confirmation to the consumer (always), and
 *   2. a declaration notification to the shop (only when `audience: 'both'`).
 *
 * Everything the mails show — date/time, name, order number, reason — comes from the
 * stored `orderWithdrawal` record (FAGG §13a / Art. 11a (3): the receipt repeats what was
 * submitted and when), never from "now" or the request.
 *
 * Throws on failure so callers can decide how to react:
 *   - the public `/api/order/withdraw` path wraps this and swallows errors (the
 *     record is already persisted), while
 *   - the admin `/api/order/withdraw-notify` path lets it throw so the resend
 *     surfaces success/failure to the studio.
 */
import { render } from '@react-email/render'

import { sendMail } from '../services/email'
import { fetchEmailSettings, type WithdrawalRecord } from '../services/sanity'
import { SimpleEmail } from '../templates/email/SimpleEmail'
import type { EmailAddress, EmailContext } from '../templates/email/types'
import { buildEmailShopSettings } from './email-settings'
import { formatPrice as fmtPrice, formatShopDate, serverT } from '../utils/i18n'

export type WithdrawNotifyOptions = {
  baseUrl?: string
  /** 'both' (new web declaration) sends consumer + shop; 'customer' (repeat / admin resend) only the receipt. */
  audience?: 'both' | 'customer'
  /**
   * Unmatched only, shop mail only: the submitted order number exists but the email differs.
   * Never shown to the consumer.
   */
  emailMismatch?: boolean
}

function oneLineAddress(shopName: string, a: EmailAddress): string {
  return [shopName, a.line1, a.line2, `${a.zip} ${a.city}`, a.country]
    .filter(Boolean)
    .join(', ')
}

/** Mail content for a stored withdrawal record — split out so it can be unit-tested. */
export function buildWithdrawalMails(
  record: WithdrawalRecord,
  ctx: EmailContext,
  options: Pick<WithdrawNotifyOptions, 'emailMismatch'> = {},
) {
  const { t, locale, settings } = ctx
  const order = record.order
  const matched = !!order
  const date = formatShopDate(record.declaredAt, locale, { withTime: true })
  const name = record.name || order?.customer.name || ''
  const orderNumber = order?.orderNumber ?? record.orderNumber ?? ''
  const email = order?.customer.contactEmail ?? record.email ?? ''

  // ---- Consumer receipt ----
  const submitted = [
    ...(name ? [`${t('emails.orderWithdrawalCustomer.submitted.name')}: ${name}`] : []),
    `${t('emails.orderWithdrawalCustomer.submitted.orderNumber')}: ${orderNumber}`,
    // Unmatched: never echo the free-text reason (no third-party text through our mail).
    ...(matched && record.reason
      ? [`${t('emails.orderWithdrawalCustomer.submitted.reason')}: ${record.reason}`]
      : []),
    `${t('emails.orderWithdrawalCustomer.submitted.declaredAt')}: ${date}`,
  ]

  let followUp: string[]
  if (!matched) {
    followUp = [t('emails.orderWithdrawalCustomer.unmatched')]
  } else if (order.status === 'shipped' || order.status === 'delivered') {
    // Goods already with the customer → ask for a return.
    const returnAddress: EmailAddress | null = settings.returnAddress ?? settings.billingAddress
    const borneBy = settings.returnShippingBorneBy ?? 'customer'
    const addressLine = returnAddress
      ? oneLineAddress(settings.shopName, returnAddress)
      : settings.shopName
    followUp = [
      t('emails.orderWithdrawalCustomer.returnInstructions', { address: addressLine }),
      t(`emails.orderWithdrawalCustomer.returnCost.${borneBy}`),
      t('emails.orderWithdrawalCustomer.refundTerms'),
      t('emails.orderWithdrawalCustomer.diminishedValue'),
      ...(settings.returnPolicyNote ? [settings.returnPolicyNote] : []),
    ]
  } else {
    // Not yet dispatched → cancel + refund, nothing to return.
    followUp = [t('emails.orderWithdrawalCustomer.notDispatched')]
  }

  const customer = {
    to: email,
    subject: t('emails.orderWithdrawalCustomer.subject', { orderNumber }),
    headline: t('emails.orderWithdrawalCustomer.headline', { name }),
    text: [
      t('emails.orderWithdrawalCustomer.intro', { date }),
      submitted.join('\n'),
      ...followUp,
    ].join('\n\n'),
  }

  // ---- Shop notification ----
  const shopLines = [
    matched
      ? t('emails.orderWithdrawalShop.intro', { orderNumber })
      : t('emails.orderWithdrawalShop.unmatchedIntro'),
    ...(!matched && options.emailMismatch
      ? [t('emails.orderWithdrawalShop.emailMismatch', { orderNumber })]
      : []),
    '',
    `${t('emails.orderWithdrawalShop.name')}: ${name || '—'}`,
    `${t('emails.orderWithdrawalShop.email')}: ${record.email || email}`,
    `${t('emails.orderWithdrawalShop.orderNumber')}: ${orderNumber}`,
    ...(matched && order.customer.name && order.customer.name !== name
      ? [`${t('emails.orderWithdrawalShop.customer')}: ${order.customer.name} <${order.customer.contactEmail}>`]
      : []),
    `${t('emails.orderWithdrawalShop.declaredAt')}: ${date}`,
    `${t('emails.orderWithdrawalShop.reason')}: ${record.reason || '—'}`,
  ]
  const shop = {
    to: settings.shopNotificationEmail || settings.senderEmail,
    subject: matched
      ? t('emails.orderWithdrawalShop.subject', { orderNumber })
      : t('emails.orderWithdrawalShop.unmatchedSubject', { orderNumber }),
    headline: matched
      ? t('emails.orderWithdrawalShop.headline')
      : t('emails.orderWithdrawalShop.unmatchedHeadline'),
    text: shopLines.join('\n'),
  }

  return { customer, shop }
}

export async function sendWithdrawalNotifications(
  record: WithdrawalRecord,
  options: WithdrawNotifyOptions = {},
): Promise<{ to: string }> {
  const audience = options.audience ?? 'both'
  const locale = record.order?.customer.locale || record.locale || 'de'

  const settingsRaw = await fetchEmailSettings(locale)
  if (!settingsRaw?.senderEmail || !settingsRaw.senderName || !settingsRaw.shopName) {
    throw new Error('withdraw-notifier: shopSettings senderEmail/senderName/siteTitle missing')
  }

  const settings = buildEmailShopSettings(settingsRaw, options.baseUrl ?? process.env.URL ?? '')
  const ctx: EmailContext = {
    locale,
    t: (key, params) => serverT(locale, key, params),
    formatPrice: (cents) => fmtPrice(cents, locale),
    settings,
  }

  const { customer, shop } = buildWithdrawalMails(record, ctx, options)
  const from = `${settings.senderName} <${settings.senderEmail}>`

  await sendMail({
    from,
    to: customer.to,
    subject: customer.subject,
    text: customer.text,
    html: await render(<SimpleEmail ctx={ctx} headline={customer.headline} text={customer.text} />),
  })

  if (audience === 'both') {
    await sendMail({
      from,
      to: shop.to,
      subject: shop.subject,
      text: shop.text,
      html: await render(<SimpleEmail ctx={ctx} headline={shop.headline} text={shop.text} />),
    })
  }

  return { to: customer.to }
}
