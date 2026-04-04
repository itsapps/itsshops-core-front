import type { PaymentCreateRequest, AddressInput, CheckoutCartItem } from '../types/api'
import { validateEmail, REQUIRED_ADDRESS_FIELDS } from '../../shared/validation'

export { validateEmail }

export type ValidationResult =
  | { valid: true }
  | { valid: false; message: string; details?: Record<string, string> }

export function validateCartItems(items: unknown): items is CheckoutCartItem[] {
  if (!Array.isArray(items) || items.length === 0) return false
  return items.every(
    item =>
      typeof item === 'object' &&
      item !== null &&
      typeof item.variantId === 'string' &&
      item.variantId.length > 0 &&
      typeof item.quantity === 'number' &&
      Number.isInteger(item.quantity) &&
      item.quantity > 0,
  )
}

export function validateAddress(address: unknown, label: string): ValidationResult {
  if (typeof address !== 'object' || address === null) {
    return { valid: false, message: `${label} is required` }
  }
  const a = address as Record<string, unknown>
  const details: Record<string, string> = {}
  for (const field of REQUIRED_ADDRESS_FIELDS) {
    if (typeof a[field] !== 'string' || a[field].trim().length === 0) {
      details[`${label}.${field}`] = `${field} is required`
    }
  }
  if (Object.keys(details).length > 0) {
    return { valid: false, message: `Invalid ${label}`, details }
  }
  return { valid: true }
}

export function validatePaymentRequest(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null) {
    return { valid: false, message: 'Request body is required' }
  }

  const req = body as Record<string, unknown>

  if (typeof req.createPayment !== 'boolean') {
    return { valid: false, message: 'createPayment must be a boolean' }
  }

  if (typeof req.locale !== 'string' || req.locale.length === 0) {
    return { valid: false, message: 'locale is required' }
  }

  const cart = req.cart as Record<string, unknown> | undefined
  if (!cart || !validateCartItems(cart.items)) {
    return { valid: false, message: 'cart.items must be a non-empty array of { variantId, quantity }' }
  }

  if (req.createPayment) {
    const address = req.address as Record<string, unknown> | undefined
    if (!address) {
      return { valid: false, message: 'address is required when createPayment is true' }
    }
    if (typeof address.contactEmail !== 'string' || !validateEmail(address.contactEmail)) {
      return { valid: false, message: 'Valid contact email is required', details: { 'address.contactEmail': 'Invalid email' } }
    }
    const shippingResult = validateAddress(address.shipping, 'shipping')
    if (!shippingResult.valid) return shippingResult

    if (address.billing) {
      const billingResult = validateAddress(address.billing, 'billing')
      if (!billingResult.valid) return billingResult
    }
  }

  if (req.partialAddress !== undefined) {
    const pa = req.partialAddress as Record<string, unknown>
    if (typeof pa !== 'object' || pa === null || typeof pa.country !== 'string' || pa.country.length === 0) {
      return { valid: false, message: 'partialAddress.country must be a non-empty string' }
    }
  }

  if (req.shippingMethodId !== undefined && typeof req.shippingMethodId !== 'string') {
    return { valid: false, message: 'shippingMethodId must be a string' }
  }

  if (req.orderMetaId !== undefined && typeof req.orderMetaId !== 'string') {
    return { valid: false, message: 'orderMetaId must be a string' }
  }

  return { valid: true }
}
