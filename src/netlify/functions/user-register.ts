import type { Context } from '@netlify/functions'
import { supabase } from '../services/supabase'
import { log } from '../utils/logger'
import { success, validationError, errorResponse, methodNotAllowed, badRequest } from '../utils/response'
import { ErrorCode } from '../types/errors'
import { verifyCaptcha } from '../utils/captcha'
import { validateEmail, validatePassword, isEmptyOrNull } from '../../shared/validation'
import { serverT } from '../utils/i18n'
import { sendDirectSignupEmail, sendDirectRecoveryEmail, type DirectAuthEmailConfig } from '../utils/auth-email'
import type { UserRegistrationField, RegisterInput, RegisterResult } from '../../shared/user-api'

export { buildUserPaths } from '../../i18n/permalinks'

export type UserRegisterConfig = {
  /** Fields beyond email+password that are required. 'newsletter' shows the checkbox but is never strictly required. */
  registrationFields?: UserRegistrationField[]
  /** Set to false to skip captcha (dev/test). Defaults to true. */
  captcha?: boolean
  /**
   * When set, the function generates the confirmation link via
   * `admin.generateLink` and sends the email itself via Mailgun. This
   * bypasses Supabase's email-related rate limit (2/h on free tier) which
   * applies to `auth.resend` even when a Send Email Hook is configured.
   *
   * When omitted, falls back to `auth.resend({ type: 'signup' })` and
   * relies on the Send Email Hook for delivery (subject to rate limits).
   */
  email?: DirectAuthEmailConfig
}

export function createUserRegisterHandler(config: UserRegisterConfig = {}) {
  const { registrationFields = [], captcha: captchaEnabled = true, email: emailConfig } = config

  const requiresPrename = registrationFields.includes('prename')
  const requiresLastname = registrationFields.includes('lastname')
  const showAddress = registrationFields.includes('address')
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

    const {
      email, password,
      prename, lastname, phone,
      line1, line2, zip, city, country, state,
      newsletter, captchaToken,
    } = body as RegisterInput

    if (!email || !password) return badRequest('email and password are required')

    const emailValid = validateEmail(email)
    const passwordValid = validatePassword(password)
    const prenameValid = !requiresPrename || !isEmptyOrNull(prename)
    const lastnameValid = !requiresLastname || !isEmptyOrNull(lastname)
    // Address: line1, zip, city, country required when shown; line2/state optional.
    const line1Valid   = !showAddress || !isEmptyOrNull(line1)
    const zipValid     = !showAddress || !isEmptyOrNull(zip)
    const cityValid    = !showAddress || !isEmptyOrNull(city)
    const countryValid = !showAddress || !isEmptyOrNull(country)

    if (!emailValid || !passwordValid || !prenameValid || !lastnameValid
        || !line1Valid || !zipValid || !cityValid || !countryValid) {
      return validationError(ErrorCode.INVALID_INPUT, t('api.errors.validation.message'), undefined, {
        ...!emailValid && { email: t('api.errors.validation.email') },
        ...!passwordValid && { password: t('api.errors.validation.password') },
        ...!prenameValid && { prename: t('api.errors.validation.empty') },
        ...!lastnameValid && { lastname: t('api.errors.validation.empty') },
        ...!line1Valid && { line1: t('api.errors.validation.empty') },
        ...!zipValid && { zip: t('api.errors.validation.empty') },
        ...!cityValid && { city: t('api.errors.validation.empty') },
        ...!countryValid && { country: t('api.errors.validation.empty') },
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

    const userMetadata = {
      locale,
      ...prename && { prename },
      ...lastname && { lastname },
      ...phone && { phone },
      ...showAddress && line1 && { line1 },
      ...showAddress && line2 && { line2 },
      ...showAddress && zip && { zip },
      ...showAddress && city && { city },
      ...showAddress && country && { country },
      ...showAddress && state && { state },
      newsletter: showNewsletter ? (newsletter ?? false) : false,
    }

    const successResp = success<RegisterResult>({
      redirectUrl: `/${locale}/${t('urlPaths.userRegistrationSuccess')}/`,
    })

    // Two modes for email delivery:
    //   - emailConfig set → `admin.generateLink({ type: 'signup' })` creates
    //     the user AND returns the confirmation link in one call; we send
    //     via Mailgun. Bypasses Supabase's email rate limit (2/h on free).
    //   - emailConfig omitted → fallback: `admin.createUser` + `auth.resend`
    //     (Send Email Hook flow, subject to rate limits).
    if (emailConfig) {
      const result = await sendDirectSignupEmail(
        { email, password, userMetadata },
        locale,
        emailConfig,
      )
      if (!result.ok) {
        if (result.emailExists) {
          // Mask existence by sending a recovery email instead.
          await sendDirectRecoveryEmail(email, locale, emailConfig)
          return successResp
        }
        log.error('user-register: direct signup failed', { email: emailObfuscated, error: result.error })
        return errorResponse(ErrorCode.AUTH_FAILED, t('api.errors.auth.unknown'))
      }
      return successResp
    }

    // Fallback path (Supabase Send Email Hook flow)
    const { error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: userMetadata,
    })

    if (error) {
      if (error.code === 'email_exists') {
        if (process.env.SKIP_AUTH_EMAILS !== 'true') {
          await supabase.auth.resetPasswordForEmail(email).catch(() => {})
        }
        return successResp
      }
      log.error('user-register: createUser failed', { email: emailObfuscated, error: error.message })
      return errorResponse(ErrorCode.AUTH_FAILED, t('api.errors.auth.unknown'))
    }

    if (process.env.SKIP_AUTH_EMAILS !== 'true') {
      const { error: resendError } = await supabase.auth.resend({ type: 'signup', email })
      if (resendError) {
        log.warn('user-register: resend confirmation failed', { email: emailObfuscated, error: resendError.message })
      }
    }

    return successResp
  }
}
