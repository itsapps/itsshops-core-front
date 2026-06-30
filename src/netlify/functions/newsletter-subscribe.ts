import type { Context } from '@netlify/functions'
import { success, methodNotAllowed, badRequest, errorResponse } from '../utils/response'
import { ErrorCode } from '../types/errors'
import { enforceCaptcha } from '../utils/captcha'
import { validateEmail } from '../../shared/validation'
import { serverT } from '../utils/i18n'
import { prepareSubscription } from '../utils/newsletter-helper'
import { sendNewsletterConfirmationEmail } from '../lib/newsletter-notifier'
import { log } from '../utils/logger'
import { buildNewsletterPaths } from '../../i18n/permalinks'
import type { NewsletterPaths } from '../lib/newsletter-urls'
import type { NewsletterSubscribeInput, NewsletterSubscribeResult } from '../../shared/newsletter-api'

export { buildNewsletterPaths } from '../../i18n/permalinks'

export type NewsletterSubscribeConfig = {
  /** Per-locale URL segments for the confirm/unsubscribe landing pages. Defaults to the core segments. */
  newsletterPaths?: NewsletterPaths
  /** Locale fallback used when building the confirmation URL. Defaults to 'de'. */
  defaultLocale?: string
  /** Public base URL of the shop (defaults to PUBLIC_URL ?? URL). */
  baseUrl?: string
}

export function createNewsletterSubscribeHandler(config: NewsletterSubscribeConfig = {}) {
  const {
    newsletterPaths = buildNewsletterPaths(),
    defaultLocale = 'de',
    baseUrl,
  } = config

  return async (request: Request, _context: Context): Promise<Response> => {
    if (request.method !== 'POST') return methodNotAllowed()

    const locale = request.headers.get('x-locale') ?? defaultLocale
    const t = (key: string) => serverT(locale, key)

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return badRequest('Invalid JSON body')
    }

    const { email, captchaToken } = body as NewsletterSubscribeInput

    if (!email || !validateEmail(email)) {
      return errorResponse(ErrorCode.INVALID_INPUT, t('api.errors.validation.email'), undefined, 400)
    }

    const captchaError = await enforceCaptcha(captchaToken, t)
    if (captchaError) return captchaError

    // Always return a generic success — never reveal whether the address was
    // new, pending, or already confirmed (prevents subscriber enumeration).
    const ok = success<NewsletterSubscribeResult>({ ok: true })

    try {
      const { send, token } = await prepareSubscription(email, locale)
      if (send) {
        await sendNewsletterConfirmationEmail({
          email,
          locale,
          token,
          newsletterPaths,
          defaultLocale,
          baseUrl,
        })
      }
    } catch (error) {
      // Log but still return success: a Sanity/email failure must not leak via
      // the response, and the visitor can simply retry.
      log.error('newsletter-subscribe failed', {
        error: error instanceof Error ? error.message : String(error),
      })
    }

    return ok
  }
}
