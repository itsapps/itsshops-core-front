/**
 * Pure helper that sends the withdrawal ("Widerruf") emails:
 *   1. the receipt confirmation to the customer (always), and
 *   2. a declaration notification to the shop (only when `audience: 'both'`).
 *
 * Throws on failure so callers can decide how to react:
 *   - the public `/api/order/withdraw` path wraps this and swallows errors (the
 *     record is already persisted), while
 *   - the admin `/api/order/withdraw-notify` path lets it throw so the resend
 *     surfaces success/failure to the studio.
 */
import { render } from '@react-email/render'

import { sendMail } from '../services/email'
import { fetchEmailSettings, type OrderWithdrawalLookup } from '../services/sanity'
import { SimpleEmail } from '../templates/email/SimpleEmail'
import type { EmailAddress, EmailContext } from '../templates/email/types'
import { buildEmailShopSettings } from './email-settings'
import { formatPrice as fmtPrice, serverT } from '../utils/i18n'

export type WithdrawNotifyOptions = {
  /** Recipient of the shop-facing declaration mail. Defaults to the sender address. */
  notifyEmail?: string
  baseUrl?: string
  /** 'both' (web declaration) sends customer + shop; 'customer' (admin/resend) sends only the customer mail. */
  audience?: 'both' | 'customer'
}

function oneLineAddress(shopName: string, a: EmailAddress): string {
  return [shopName, a.line1, a.line2, `${a.zip} ${a.city}`, a.country]
    .filter(Boolean)
    .join(', ')
}

export async function sendWithdrawalNotifications(
  order: OrderWithdrawalLookup,
  reason: string | undefined,
  declaredAt: string,
  options: WithdrawNotifyOptions = {},
): Promise<{ to: string }> {
  const audience = options.audience ?? 'both'
  const locale = order.customer.locale || 'de'
  const t = (key: string, params?: Record<string, string | number>) => serverT(locale, key, params)

  const settingsRaw = await fetchEmailSettings(locale)
  if (!settingsRaw?.senderEmail || !settingsRaw.senderName || !settingsRaw.shopName) {
    throw new Error('withdraw-notifier: shopSettings senderEmail/senderName/siteTitle missing')
  }

  const settings = buildEmailShopSettings(settingsRaw, options.baseUrl ?? process.env.URL ?? '')
  // Returns fall back to the billing address; the rest of the body reads these.
  const returnAddress: EmailAddress | null = settings.returnAddress ?? settings.billingAddress
  const borneBy = settings.returnShippingBorneBy ?? 'customer'

  const ctx: EmailContext = {
    locale,
    t: (key, params) => serverT(locale, key, params),
    formatPrice: (cents) => fmtPrice(cents, locale),
    settings,
  }

  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(declaredAt))
  const addressLine = returnAddress
    ? oneLineAddress(settings.shopName, returnAddress)
    : settings.shopName

  // ---- Customer acknowledgment (always) ----
  // Goods already with the customer (shipped/delivered) → ask for a return.
  // Not yet dispatched → cancel + refund, nothing to return.
  const needsReturn = order.status === 'shipped' || order.status === 'delivered'
  const customerHeadline = t('emails.orderWithdrawalCustomer.headline', { name: order.customer.name })
  const customerBody = [
    t('emails.orderWithdrawalCustomer.intro', { orderNumber: order.orderNumber, date }),
    ...(needsReturn
      ? [
          t('emails.orderWithdrawalCustomer.returnInstructions', { address: addressLine }),
          t(`emails.orderWithdrawalCustomer.returnCost.${borneBy}`),
          t('emails.orderWithdrawalCustomer.refundTerms'),
          t('emails.orderWithdrawalCustomer.diminishedValue'),
          ...(settings.returnPolicyNote ? [settings.returnPolicyNote] : []),
        ]
      : [t('emails.orderWithdrawalCustomer.notDispatched')]),
  ].join('\n\n')

  const customerHtml = await render(
    <SimpleEmail ctx={ctx} headline={customerHeadline} text={customerBody} />,
  )
  await sendMail({
    from: `${settings.senderName} <${settings.senderEmail}>`,
    to: order.customer.contactEmail,
    subject: t('emails.orderWithdrawalCustomer.subject', { orderNumber: order.orderNumber }),
    text: customerBody,
    html: customerHtml,
  })

  // ---- Shop notification (web declaration only) ----
  if (audience === 'both') {
    const shopBody = [
      t('emails.orderWithdrawalShop.intro', { orderNumber: order.orderNumber }),
      `${t('emails.orderWithdrawalShop.customer')}: ${order.customer.name} <${order.customer.contactEmail}>`,
      `${t('emails.orderWithdrawalShop.declaredAt')}: ${date}`,
      `${t('emails.orderWithdrawalShop.reason')}: ${reason || '—'}`,
    ].join('\n')

    const shopHtml = await render(
      <SimpleEmail ctx={ctx} headline={t('emails.orderWithdrawalShop.headline')} text={shopBody} />,
    )
    await sendMail({
      from: `${settings.senderName} <${settings.senderEmail}>`,
      to: options.notifyEmail ?? settings.senderEmail,
      subject: t('emails.orderWithdrawalShop.subject', { orderNumber: order.orderNumber }),
      text: shopBody,
      html: shopHtml,
    })
  }

  return { to: order.customer.contactEmail }
}
