const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmail(email: string): boolean {
  return EMAIL_RE.test(email)
}

export const REQUIRED_ADDRESS_FIELDS = [
  'prename',
  'lastname',
  'line1',
  'zip',
  'city',
  'country',
] as const

export type RequiredAddressField = (typeof REQUIRED_ADDRESS_FIELDS)[number]
