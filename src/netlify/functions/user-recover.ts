import type { Context } from '@netlify/functions'
import { supabase, deleteSessionCookies } from '../services/supabase'
import { log } from '../utils/logger'
import { success, validationError, errorResponse, methodNotAllowed, badRequest } from '../utils/response'
import { ErrorCode } from '../types/errors'
import { verifyCaptcha } from '../utils/captcha'
import { validateEmail } from '../../shared/validation'
import { serverT } from '../utils/i18n'
import type { RecoverInput, RecoverResult } from '../../shared/user-api'

export function createUserRecoverHandler() {
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

    const secret = process.env.HCAPTCHA_SECRET_KEY
    if (secret) {
      if (!captchaToken) return badRequest('captchaToken is required')
      const captchaValid = await verifyCaptcha(captchaToken)
      if (!captchaValid) {
        return errorResponse(ErrorCode.AUTH_CAPTCHA_FAILED, t('api.errors.auth.captchaFailed'), undefined, 401)
      }
    }

    deleteSessionCookies(context)

    const emailObfuscated = email.slice(0, 4) + '…'
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) {
      // Log but don't expose to client — always return success to avoid email enumeration
      log.warn('user-recover: resetPasswordForEmail failed', { email: emailObfuscated, error: error.message })
    }

    return success<RecoverResult>({ redirectUrl: `/${locale}/${t('urlPaths.userRecoverSuccess')}/` })
  }
}
