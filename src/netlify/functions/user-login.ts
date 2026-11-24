import type { Context } from '@netlify/functions'
import { supabase, setSessionCookies, exposedUserData } from '../services/supabase'
import { log } from '../utils/logger'
import { success, validationError, errorResponse, methodNotAllowed, badRequest } from '../utils/response'
import { ErrorCode } from '../types/errors'
import { validateEmail, validatePassword } from '../../shared/validation'
import { serverT } from '../utils/i18n'
import type { LoginInput, LoginResult } from '../../shared/user-api'

export function createUserLoginHandler() {
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

    const { email, password } = body as LoginInput

    if (!email || !password) return badRequest('email and password are required')

    if (!validateEmail(email) || !validatePassword(password)) {
      return validationError(ErrorCode.INVALID_INPUT, t('api.errors.validation.message'), undefined, {
        ...!validateEmail(email) && { email: t('api.errors.validation.email') },
        ...!validatePassword(password) && { password: t('api.errors.validation.password') },
      })
    }

    const emailObfuscated = email.slice(0, 4) + '…'

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      if (error.code === 'email_not_confirmed') {
        // Resend confirmation silently
        await supabase.auth.resend({ type: 'signup', email }).catch(() => {})
        return errorResponse(ErrorCode.AUTH_FAILED, t('api.errors.auth.maybeNotConfirmed'), undefined, 401)
      }
      if (error.code === 'invalid_credentials') {
        return errorResponse(ErrorCode.AUTH_FAILED, t('api.errors.auth.invalidCredentials'), undefined, 401)
      }
      log.error('user-login: signInWithPassword failed', { email: emailObfuscated, error: error.message })
      return errorResponse(ErrorCode.AUTH_FAILED, t('api.errors.auth.unknown'), undefined, 401)
    }

    setSessionCookies(
      { accessToken: data.session.access_token, refreshToken: data.session.refresh_token },
      context,
    )

    return success<LoginResult>({ user: exposedUserData(data.user) })
  }
}
