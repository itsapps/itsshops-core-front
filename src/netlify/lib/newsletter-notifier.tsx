/**
 * Renders and sends the newsletter double-opt-in confirmation email via the
 * shared Mailgun/Resend pipeline. Mirrors `auth-notifier`, but the action link
 * points at the newsletter confirm landing page (not a Supabase OTP page).
 *
 * Errors are thrown so the calling function can log them; the subscribe handler
 * still returns a generic success to the client either way.
 */
import * as React from 'react'
import { render } from '@react-email/render'

import { sendMail } from '../services/email'
import { fetchEmailSettings } from '../services/sanity'
import { SimpleEmail } from '../templates/email/SimpleEmail'
import type { EmailContext } from '../templates/email/types'
import { buildEmailShopSettings } from './email-settings'
import {
  buildNewsletterConfirmUrl,
  buildNewsletterUnsubscribeUrl,
  type NewsletterPaths,
} from './newsletter-urls'
import { formatPrice as fmtPrice, serverT } from '../utils/i18n'

export type SendNewsletterConfirmationInput = {
  email: string
  locale: string
  token: string
  newsletterPaths: NewsletterPaths
  defaultLocale: string
  baseUrl?: string
}

export async function sendNewsletterConfirmationEmail(
  input: SendNewsletterConfirmationInput,
): Promise<void> {
  const { email, locale, token, newsletterPaths, defaultLocale } = input

  if (process.env.SKIP_AUTH_EMAILS === 'true') return

  const baseUrl = input.baseUrl ?? process.env.PUBLIC_URL ?? process.env.URL ?? ''
  if (!baseUrl) {
    throw new Error('baseUrl missing — set PUBLIC_URL / URL or pass baseUrl')
  }

  const confirmUrl = buildNewsletterConfirmUrl(baseUrl, locale, token, newsletterPaths, defaultLocale)
  const unsubscribeUrl = buildNewsletterUnsubscribeUrl(baseUrl, locale, token, newsletterPaths, defaultLocale)

  const settingsRaw = await fetchEmailSettings(locale)
  if (!settingsRaw?.senderEmail || !settingsRaw.senderName || !settingsRaw.shopName) {
    throw new Error('shopSettings.senderEmail / senderName / settings.siteTitle must be set')
  }

  const settings = buildEmailShopSettings(settingsRaw, baseUrl)

  const ctx: EmailContext = {
    locale,
    t: (key, params) => serverT(locale, key, params),
    formatPrice: (cents) => fmtPrice(cents, locale),
    settings,
  }

  const subject     = ctx.t('emails.newsletterConfirmation.subject')
  const headline    = ctx.t('emails.newsletterConfirmation.headline')
  const text        = ctx.t('emails.newsletterConfirmation.text')
  const urlTitle    = ctx.t('emails.newsletterConfirmation.urlTitle')
  const unsubscribe = ctx.t('emails.newsletterConfirmation.unsubscribe')

  const html = await render(
    <SimpleEmail
      ctx={ctx}
      headline={headline}
      text={text}
      cta={{ url: confirmUrl, label: urlTitle }}
      footerLink={{ url: unsubscribeUrl, label: unsubscribe }}
    />,
  )

  await sendMail({
    from: `${settings.senderName} <${settings.senderEmail}>`,
    to: email,
    subject,
    text: `${text}\n\n${urlTitle}: ${confirmUrl}\n\n${unsubscribe}: ${unsubscribeUrl}`,
    html,
    headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>` },
  })
}
