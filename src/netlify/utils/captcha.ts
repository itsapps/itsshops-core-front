const HCAPTCHA_VERIFY_URL = 'https://api.hcaptcha.com/siteverify'

/**
 * Verify an hCaptcha token server-side.
 * Returns true if valid or if HCAPTCHA_SECRET_KEY is not set (dev mode).
 */
export async function verifyCaptcha(token: string): Promise<boolean> {
  const secret = process.env.HCAPTCHA_SECRET_KEY
  if (!secret) return true

  try {
    const res = await fetch(HCAPTCHA_VERIFY_URL, {
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
