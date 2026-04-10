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

export const REQUIRED_ADDRESS_FIELDS = [
  'name',
  'line1',
  'zip',
  'city',
  'country',
] as const

export type RequiredAddressField = (typeof REQUIRED_ADDRESS_FIELDS)[number]
