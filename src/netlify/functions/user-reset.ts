import type { Context } from '@netlify/functions'
import type { EmailOtpType } from '@supabase/supabase-js'
import { supabase, deleteSessionCookies } from '../services/supabase'
import { storeCustomer } from '../utils/user-helper'
import { log } from '../utils/logger'
import { success, validationError, errorResponse, methodNotAllowed, badRequest } from '../utils/response'
import { ErrorCode } from '../types/errors'
import { validatePassword } from '../../shared/validation'
import { serverT } from '../utils/i18n'
import type { ResetInput, ResetResult } from '../../shared/user-api'

export function createUserResetHandler() {
  return async (request: Request, context: Context): Promise<Response> => {
    if (request.method !== 'POST') return methodNotAllowed()

    const locale = request.headers.get('x-locale') ?? 'de'
    const t = (key: string) => serverT(locale, key)

    deleteSessionCookies(context)

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return badRequest('Invalid JSON body')
    }

    const { token, password, type } = body as ResetInput

    if (!token || !password) return badRequest('token and password are required')

    if (!validatePassword(password)) {
      return validationError(ErrorCode.INVALID_INPUT, t('api.errors.validation.message'), undefined, {
        password: t('api.errors.validation.password'),
      })
    }

    const otpType: EmailOtpType = (type as EmailOtpType | undefined) ?? 'recovery'
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: token, type: otpType })

    if (error) {
      if (error.code === 'otp_expired') {
        log.warn('user-reset: OTP expired')
        return errorResponse(ErrorCode.AUTH_LINK_EXPIRED, t('api.errors.auth.activationLinkExpired'), undefined, 401)
      }
      if (error.code === 'weak_password') {
        return validationError(ErrorCode.INVALID_INPUT, t('api.errors.validation.message'), undefined, {
          password: t('api.errors.validation.password'),
        })
      }
      log.error('user-reset: verifyOtp failed', { error: error.message })
      return errorResponse(ErrorCode.AUTH_FAILED, t('api.errors.auth.unknown'), undefined, 401)
    }

    if (!data.session || !data.user) {
      log.error('user-reset: verifyOtp returned no session/user')
      return errorResponse(ErrorCode.AUTH_FAILED, t('api.errors.auth.unknown'))
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(data.user.id, { password })
    if (updateError) {
      log.error('user-reset: updateUserById failed', { userId: data.user.id, error: updateError.message })
      return errorResponse(ErrorCode.AUTH_FAILED, t('api.errors.auth.unknown'))
    }

    const email = data.user.email
    if (email) {
      const meta = data.user.user_metadata ?? {}
      const userLocale = (meta.locale as string | undefined) ?? locale
      context.waitUntil(
        storeCustomer(data.user.id, email, userLocale, {
          prename: meta.prename as string | undefined,
          lastname: meta.lastname as string | undefined,
          phone: meta.phone as string | undefined,
          newsletter: meta.newsletter as boolean | undefined,
        }),
      )
    }

    return success<ResetResult>({ redirectUrl: `/${locale}/${t('urlPaths.userResetSuccess')}/` })
  }
}
