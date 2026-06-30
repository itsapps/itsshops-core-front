// Currently uses hCaptcha. To swap providers, change the verify URL and
// (if needed) the request body shape. The CAPTCHA_* env var names stay
// provider-agnostic so customer .env files don't have to churn.
import { badRequest, errorResponse } from './response'
import { ErrorCode } from '../types/errors'

const VERIFY_URL = 'https://api.hcaptcha.com/siteverify'

/**
 * Verify a captcha token server-side.
 * Returns true if valid or if CAPTCHA_SECRET_KEY is not set (dev mode).
 */
export async function verifyCaptcha(token: string): Promise<boolean> {
  const secret = process.env.CAPTCHA_SECRET_KEY
  if (!secret) return true

  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    })
    const data = await res.json() as { success: boolean }
    return data.success === true
  } catch {
    return false
  }
}

/**
 * Enforce captcha on a public action (registration, password recovery,
 * newsletter signup, right-of-withdrawal). Captcha is mandatory for these — but
 * only verifiable where it's actually configured, so enforcement is gated on
 * `CAPTCHA_SECRET_KEY`. In dev/test (no secret) this is a no-op, mirroring
 * `verifyCaptcha`'s dev bypass.
 *
 * Returns an error `Response` to short-circuit on a missing/invalid token, or
 * `null` to proceed.
 */
export async function enforceCaptcha(
  token: string | undefined,
  t: (key: string) => string,
): Promise<Response | null> {
  if (!process.env.CAPTCHA_SECRET_KEY) return null
  if (!token) return badRequest('captchaToken is required')
  if (!(await verifyCaptcha(token))) {
    return errorResponse(ErrorCode.AUTH_CAPTCHA_FAILED, t('api.errors.auth.captchaFailed'), undefined, 401)
  }
  return null
}
