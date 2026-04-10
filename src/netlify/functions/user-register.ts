import type { Context } from '@netlify/functions'
import { supabase } from '../services/supabase'
import { log } from '../utils/logger'
import { success, validationError, errorResponse, methodNotAllowed, badRequest } from '../utils/response'
import { ErrorCode } from '../types/errors'
import { verifyCaptcha } from '../utils/captcha'
import { validateEmail, validatePassword, isEmptyOrNull } from '../../shared/validation'
import { serverT } from '../utils/i18n'
import type { UserRegistrationField, RegisterInput, RegisterResult } from '../../shared/user-api'

export type UserRegisterConfig = {
  /** Fields beyond email+password that are required. 'newsletter' shows the checkbox but is never strictly required. */
  registrationFields?: UserRegistrationField[]
  /** Set to false to skip captcha (dev/test). Defaults to true. */
  captcha?: boolean
}

export function createUserRegisterHandler(config: UserRegisterConfig = {}) {
  const { registrationFields = [], captcha: captchaEnabled = true } = config

  const requiresPrename = registrationFields.includes('prename')
  const requiresLastname = registrationFields.includes('lastname')
  const requiresPhone = registrationFields.includes('phone')
  const showNewsletter = registrationFields.includes('newsletter')

  return async (request: Request, _context: Context): Promise<Response> => {
    if (request.method !== 'POST') return methodNotAllowed()

    const locale = request.headers.get('x-locale') ?? 'de'
    const t = (key: string) => serverT(locale, key)

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return badRequest('Invalid JSON body')
    }

    const { email, password, prename, lastname, phone, newsletter, captchaToken } =
      body as RegisterInput

    if (!email || !password) return badRequest('email and password are required')

    const emailValid = validateEmail(email)
    const passwordValid = validatePassword(password)
    const prenameValid = !requiresPrename || !isEmptyOrNull(prename)
    const lastnameValid = !requiresLastname || !isEmptyOrNull(lastname)
    const phoneValid = !requiresPhone || !isEmptyOrNull(phone)

    if (!emailValid || !passwordValid || !prenameValid || !lastnameValid || !phoneValid) {
      return validationError(ErrorCode.INVALID_INPUT, t('api.errors.validation.message'), undefined, {
        ...!emailValid && { email: t('api.errors.validation.email') },
        ...!passwordValid && { password: t('api.errors.validation.password') },
        ...!prenameValid && { prename: t('api.errors.validation.empty') },
        ...!lastnameValid && { lastname: t('api.errors.validation.empty') },
        ...!phoneValid && { phone: t('api.errors.validation.empty') },
      })
    }

    if (captchaEnabled) {
      if (!captchaToken) return badRequest('captchaToken is required')
      const captchaValid = await verifyCaptcha(captchaToken)
      if (!captchaValid) {
        return errorResponse(ErrorCode.AUTH_CAPTCHA_FAILED, t('api.errors.auth.captchaFailed'), undefined, 401)
      }
    }

    const emailObfuscated = email.slice(0, 4) + '…'

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: {
        locale,
        ...prename && { prename },
        ...lastname && { lastname },
        ...phone && { phone },
        newsletter: showNewsletter ? (newsletter ?? false) : false,
      },
    })

    if (error) {
      if (error.code === 'email_exists') {
        // Send a password reset so the existing user isn't exposed
        await supabase.auth.resetPasswordForEmail(email).catch(() => {})
        // Return success to avoid leaking whether the email exists
        return success<RegisterResult>({ redirectUrl: `/${locale}/${t('urlPaths.userRegistrationSuccess')}/` })
      }
      log.error('user-register: createUser failed', { email: emailObfuscated, error: error.message })
      return errorResponse(ErrorCode.AUTH_FAILED, t('api.errors.auth.unknown'))
    }

    // Send confirmation email
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email })
    if (resendError) {
      log.warn('user-register: resend confirmation failed', { email: emailObfuscated, error: resendError.message })
    }

    return success<RegisterResult>({
      redirectUrl: `/${locale}/${t('urlPaths.userRegistrationSuccess')}/`,
    })
  }
}
