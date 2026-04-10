import type { Context } from '@netlify/functions'
import { supabase, setSessionCookies, deleteSessionCookies, exposedUserData } from '../services/supabase'
import { storeCustomer } from '../utils/user-helper'
import { log } from '../utils/logger'
import { success, errorResponse, methodNotAllowed, badRequest } from '../utils/response'
import { ErrorCode } from '../types/errors'
import { serverT } from '../utils/i18n'
import type { ConfirmInput, ConfirmResult } from '../../shared/user-api'

export function createUserConfirmHandler() {
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

    const { token } = body as ConfirmInput
    if (!token) return badRequest('token is required')

    const { data, error } = await supabase.auth.verifyOtp({ token_hash: token, type: 'email' })

    if (error) {
      deleteSessionCookies(context)
      if (error.code === 'otp_expired') {
        log.warn('user-confirm: OTP expired', { error: error.message })
        return errorResponse(ErrorCode.AUTH_LINK_EXPIRED, t('api.errors.auth.activationLinkExpired'), undefined, 401)
      }
      log.error('user-confirm: verifyOtp failed', { error: error.message })
      return errorResponse(ErrorCode.AUTH_FAILED, t('api.errors.auth.activationLinkExpired'), undefined, 401)
    }

    if (!data.session || !data.user) {
      log.error('user-confirm: verifyOtp returned no session/user')
      return errorResponse(ErrorCode.AUTH_FAILED, t('api.errors.auth.unknown'))
    }

    const email = data.user.email
    if (!email) {
      log.error('user-confirm: no email in user data', { userId: data.user.id })
      return errorResponse(ErrorCode.AUTH_FAILED, t('api.errors.auth.noEmail'))
    }

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

    setSessionCookies(
      { accessToken: data.session.access_token, refreshToken: data.session.refresh_token },
      context,
    )

    return success<ConfirmResult>({
      user: exposedUserData(data.user),
      redirectUrl: `/${locale}/${t('urlPaths.userConfirmSuccess')}/`,
    })
  }
}
