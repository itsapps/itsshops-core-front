// Currently uses hCaptcha. To swap providers, change the verify URL and
// (if needed) the request body shape. The CAPTCHA_* env var names stay
// provider-agnostic so customer .env files don't have to churn.
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
