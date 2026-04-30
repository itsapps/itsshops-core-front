/**
 * Pure (no HTTP, no auth, no CORS) helper that renders the Supabase auth email
 * for a given action (signup confirm, password reset, invite) and sends it via
 * Mailgun.
 *
 * Used by `functions/auth-webhooks.ts`.
 *
 * Throws `AuthNotifierError` with a typed code so callers can map failures to
 * HTTP responses or just log them.
 */
import * as React from 'react'
import type { ComponentType } from 'react'
import { render } from '@react-email/render'

import { sendMail } from '../services/mailgun'
import { fetchEmailSettings } from '../services/sanity'
import { SimpleMailTemplate } from '../templates/simpleMailTemplate'
import type { EmailContext, EmailShopSettings, SimpleEmailProps } from '../templates/types'
import { ErrorCode } from '../types/errors'
import { formatPrice as fmtPrice, serverT } from '../utils/i18n'
import {
  ACTION_TO_MAIL_TYPE,
  AuthNotifierError,
  buildAuthCallbackUrl,
  type AuthMailType,
  type AuthUserPaths,
  type SupabaseAuthEmailAction,
} from './auth-urls'

export type { AuthMailType, AuthUserPaths, SupabaseAuthEmailAction } from './auth-urls'
export { AuthNotifierError, buildAuthCallbackUrl } from './auth-urls'

export type AuthUser = {
  id: string
  email: string
  user_metadata?: Record<string, unknown>
}

export type SendAuthNotificationInput = {
  user: AuthUser
  emailActionType: SupabaseAuthEmailAction
  tokenHash: string
  defaultLocale: string
}

export type SendAuthNotificationOptions = {
  /** Replaces SimpleMailTemplate for all auth emails. */
  template?: ComponentType<SimpleEmailProps>
  /** Public base URL of the shop (defaults to process.env.URL). */
  baseUrl?: string
  /** Per-locale userPaths (need at least userConfirm + userReset for each locale). */
  userPaths: AuthUserPaths
}

export type SendAuthNotificationResult = {
  messageId: string
  to: string
  authMailType: AuthMailType
}

export async function sendAuthNotification(
  input: SendAuthNotificationInput,
  options: SendAuthNotificationOptions,
): Promise<SendAuthNotificationResult> {
  const { user, emailActionType, tokenHash, defaultLocale } = input
  if (!user.email) {
    throw new AuthNotifierError(ErrorCode.INVALID_INPUT, 'Auth user has no email')
  }

  const meta = user.user_metadata ?? {}
  const locale = (typeof meta.locale === 'string' && meta.locale) || defaultLocale

  const authMailType = ACTION_TO_MAIL_TYPE[emailActionType]

  // Netlify Dev injects URL=http://localhost:8888 at runtime, overriding .env.
  // Prefer PUBLIC_URL so customers can point to a tunnel (ngrok etc.) during
  // local hook testing without fighting Netlify Dev.
  const baseUrl = options.baseUrl ?? process.env.PUBLIC_URL ?? process.env.URL ?? ''
  if (!baseUrl) {
    throw new AuthNotifierError(
      ErrorCode.INTERNAL_ERROR,
      'baseUrl missing — set PUBLIC_URL / URL or pass options.baseUrl',
    )
  }

  const callbackUrl = buildAuthCallbackUrl(
    baseUrl,
    locale,
    emailActionType,
    tokenHash,
    options.userPaths,
    defaultLocale,
  )

  const settingsRaw = await fetchEmailSettings(locale)
  if (!settingsRaw?.senderEmail || !settingsRaw.senderName || !settingsRaw.shopName) {
    throw new AuthNotifierError(
      ErrorCode.INTERNAL_ERROR,
      'shopSettings.senderEmail / senderName / settings.siteTitle must be set',
    )
  }

  const settings: EmailShopSettings = {
    shopName: settingsRaw.shopName,
    senderName: settingsRaw.senderName,
    senderEmail: settingsRaw.senderEmail,
    baseUrl,
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

  const subject  = ctx.t(`emails.${authMailType}.subject`)
  const headline = ctx.t(`emails.${authMailType}.headline`)
  const text     = ctx.t(`emails.${authMailType}.text`)
  const urlTitle = ctx.t(`emails.${authMailType}.urlTitle`)

  const Component = options.template ?? SimpleMailTemplate
  const html = await render(
    <Component
      ctx={ctx}
      headline={headline}
      text={text}
      cta={{ url: callbackUrl, label: urlTitle }}
    />,
  )

  const result = await sendMail({
    from: `${settings.senderName} <${settings.senderEmail}>`,
    to: user.email,
    subject,
    text: `${text}\n\n${urlTitle}: ${callbackUrl}`,
    html,
  })

  return {
    messageId: result.id ?? 'unknown',
    to: user.email,
    authMailType,
  }
}
