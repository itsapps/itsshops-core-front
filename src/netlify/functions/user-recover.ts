import type { Context } from '@netlify/functions'
import { supabase, deleteSessionCookies } from '../services/supabase'
import { log } from '../utils/logger'
import { success, validationError, errorResponse, methodNotAllowed, badRequest } from '../utils/response'
import { ErrorCode } from '../types/errors'
import { verifyCaptcha } from '../utils/captcha'
import { validateEmail } from '../../shared/validation'
import { serverT } from '../utils/i18n'
import { sendDirectRecoveryEmail, type DirectAuthEmailConfig } from '../utils/auth-email'
import type { RecoverInput, RecoverResult } from '../../shared/user-api'

export { buildUserPaths } from '../../i18n/permalinks'

export type UserRecoverConfig = {
  /** Set to false to skip captcha (dev/test). Defaults to true. */
  captcha?: boolean
  /**
   * When set, the function generates the recovery link via
   * `admin.generateLink` and sends the email itself via Mailgun. Bypasses
   * Supabase's email-related rate limit (2/h on free tier).
   *
   * When omitted, falls back to `resetPasswordForEmail` which relies on
   * Supabase's Send Email Hook (subject to rate limits).
   */
  email?: DirectAuthEmailConfig
}

export function createUserRecoverHandler(config: UserRecoverConfig = {}) {
  const { captcha: captchaEnabled = true, email: emailConfig } = config

  return async (request: Request, context: Context): Promise<Response> => {
    if (request.method !== 'POST') return methodNotAllowed()

    const locale = request.headers.get('x-locale') ?? 'de'
    const t = (key: string) => serverT(locale, key)

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return badRequest('Invalid JSON body')
    }

    const { email, captchaToken } = body as RecoverInput

    if (!email) return badRequest('email is required')

    if (!validateEmail(email)) {
      return validationError(ErrorCode.INVALID_INPUT, t('api.errors.validation.message'), undefined, {
        email: t('api.errors.validation.email'),
      })
    }

    if (captchaEnabled) {
      if (!captchaToken) return badRequest('captchaToken is required')
      const captchaValid = await verifyCaptcha(captchaToken)
      if (!captchaValid) {
        return errorResponse(ErrorCode.AUTH_CAPTCHA_FAILED, t('api.errors.auth.captchaFailed'), undefined, 401)
      }
    }

    deleteSessionCookies(context)

    const emailObfuscated = email.slice(0, 4) + '…'
    // Two modes (same as user-register):
    //   - emailConfig set → generate link + send via own Mailgun (bypasses
    //     Supabase's per-project email rate limit on free tier).
    //   - emailConfig omitted → fallback to resetPasswordForEmail.
    // SKIP_AUTH_EMAILS short-circuits both for local dev.
    // Errors are swallowed in both paths to avoid email enumeration.
    if (process.env.SKIP_AUTH_EMAILS !== 'true') {
      if (emailConfig) {
        await sendDirectRecoveryEmail(email, locale, emailConfig)
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email)
        if (error) {
          log.warn('user-recover: resetPasswordForEmail failed', { email: emailObfuscated, error: error.message })
        }
      }
    }

    return success<RecoverResult>({ redirectUrl: `/${locale}/${t('urlPaths.userRecoverSuccess')}/` })
  }
}
