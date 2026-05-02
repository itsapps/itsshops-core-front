import type { Context } from '@netlify/functions'
import { supabase, deleteSessionCookies } from '../services/supabase'
import { log } from '../utils/logger'
import { success, validationError, errorResponse, methodNotAllowed, badRequest } from '../utils/response'
import { ErrorCode } from '../types/errors'
import { verifyCaptcha } from '../utils/captcha'
import { validateEmail } from '../../shared/validation'
import { serverT } from '../utils/i18n'
import type { RecoverInput, RecoverResult } from '../../shared/user-api'

export type UserRecoverConfig = {
  /** Set to false to skip captcha (dev/test). Defaults to true. */
  captcha?: boolean
}

export function createUserRecoverHandler(config: UserRecoverConfig = {}) {
  const { captcha: captchaEnabled = true } = config

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
    // Gated so local dev doesn't trigger Supabase's built-in SMTP (rate-limited
    // to 2/h on free) when the Send Email Hook is unreachable from Supabase's
    // cloud (e.g. localhost without a tunnel).
    if (process.env.SKIP_AUTH_EMAILS !== 'true') {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) {
        // Log but don't expose to client — always return success to avoid email enumeration
        log.warn('user-recover: resetPasswordForEmail failed', { email: emailObfuscated, error: error.message })
      }
    }

    return success<RecoverResult>({ redirectUrl: `/${locale}/${t('urlPaths.userRecoverSuccess')}/` })
  }
}
