const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_RE = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}/

export function validateEmail(email: string): boolean {
  return EMAIL_RE.test(email)
}

export function validatePassword(password: string): boolean {
  return PASSWORD_RE.test(password)
}

export function isEmptyOrNull(value: unknown): boolean {
  return value === null || value === undefined || value === ''
}

/** Max length of the free-text withdrawal fields that are echoed in mails (name, order number). */
export const WITHDRAW_TEXT_MAX = 100
/** Max length of the optional withdrawal reason (stored + shop mail only). */
export const WITHDRAW_REASON_MAX = 2000

const URL_LIKE_RE = /:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,}(?:[/:?#]|\b)/i

/** True if the text looks like it carries a link (`://`, `www.`, a domain like `example.com`). */
export function isUrlLike(value: string): boolean {
  return URL_LIKE_RE.test(value)
}

/**
 * Withdrawal name / order number: required, capped, no URL-like content — both are echoed in a
 * receipt mail that can go to any typed address, so they must not carry links.
 * Returns `'empty'`, `'invalid'` or `null` (valid).
 */
export function checkWithdrawText(value: string | undefined): 'empty' | 'invalid' | null {
  const v = (value ?? '').trim()
  if (!v) return 'empty'
  if (v.length > WITHDRAW_TEXT_MAX || isUrlLike(v)) return 'invalid'
  return null
}

/** Stripe PaymentIntent id (`pi_…`) — the shape only, not a secret. */
export function isPaymentIntentId(value: unknown): value is string {
  return typeof value === 'string' && /^pi_[A-Za-z0-9]{8,64}$/.test(value)
}

export const REQUIRED_ADDRESS_FIELDS = [
  'name',
  'line1',
  'zip',
  'city',
  'country',
] as const

export type RequiredAddressField = (typeof REQUIRED_ADDRESS_FIELDS)[number]
