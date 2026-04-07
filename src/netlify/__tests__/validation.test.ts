import { describe, it, expect } from 'vitest'
import { validateEmail, validateCartItems, validateAddress, validatePaymentRequest } from '../utils/validation'

describe('validateEmail', () => {
  it('accepts valid emails', () => {
    expect(validateEmail('user@example.com')).toBe(true)
    expect(validateEmail('a+b@c.co')).toBe(true)
  })

  it('rejects invalid emails', () => {
    expect(validateEmail('')).toBe(false)
    expect(validateEmail('not-an-email')).toBe(false)
    expect(validateEmail('@missing.com')).toBe(false)
    expect(validateEmail('missing@')).toBe(false)
    expect(validateEmail('has spaces@example.com')).toBe(false)
  })
})

describe('validateCartItems', () => {
  it('accepts valid items', () => {
    expect(validateCartItems([{ variantId: 'v1', quantity: 2 }])).toBe(true)
  })

  it('rejects non-array', () => {
    expect(validateCartItems(null)).toBe(false)
    expect(validateCartItems('string')).toBe(false)
  })

  it('rejects empty variantId', () => {
    expect(validateCartItems([{ variantId: '', quantity: 1 }])).toBe(false)
  })

  it('rejects non-integer quantity', () => {
    expect(validateCartItems([{ variantId: 'v1', quantity: 1.5 }])).toBe(false)
  })

  it('rejects zero or negative quantity', () => {
    expect(validateCartItems([{ variantId: 'v1', quantity: 0 }])).toBe(false)
    expect(validateCartItems([{ variantId: 'v1', quantity: -1 }])).toBe(false)
  })

  it('rejects missing fields', () => {
    expect(validateCartItems([{ variantId: 'v1' }])).toBe(false)
    expect(validateCartItems([{ quantity: 1 }])).toBe(false)
  })
})

describe('validateAddress', () => {
  const validAddress = {
    name: 'Max Mustermann',
    prename: 'Max',
    lastname: 'Mustermann',
    line1: 'Hauptstr. 1',
    zip: '7000',
    city: 'Eisenstadt',
    country: 'AT',
  }

  it('accepts valid address', () => {
    expect(validateAddress(validAddress, 'shipping')).toEqual({ valid: true })
  })

  it('rejects null', () => {
    const result = validateAddress(null, 'shipping')
    expect(result.valid).toBe(false)
  })

  it('reports missing required fields', () => {
    const result = validateAddress({ prename: 'Max' }, 'billing')
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.details).toBeDefined()
      expect(result.details!['billing.lastname']).toBeDefined()
      expect(result.details!['billing.line1']).toBeDefined()
    }
  })
})

describe('validatePaymentRequest', () => {
  const validCalculate = {
    cart: { items: [{ variantId: 'v1', quantity: 1 }] },
    createPayment: false,
    locale: 'de',
  }

  const validCreate = {
    cart: { items: [{ variantId: 'v1', quantity: 1 }] },
    createPayment: true,
    locale: 'de',
    address: {
      contactEmail: 'test@example.com',
      shipping: {
        name: 'Max Mustermann',
        prename: 'Max',
        lastname: 'Mustermann',
        line1: 'Hauptstr. 1',
        zip: '7000',
        city: 'Eisenstadt',
        country: 'AT',
      },
    },
  }

  it('accepts valid calculate request', () => {
    expect(validatePaymentRequest(validCalculate)).toEqual({ valid: true })
  })

  it('accepts valid create request', () => {
    expect(validatePaymentRequest(validCreate)).toEqual({ valid: true })
  })

  it('rejects null body', () => {
    expect(validatePaymentRequest(null).valid).toBe(false)
  })

  it('rejects missing locale', () => {
    expect(validatePaymentRequest({ ...validCalculate, locale: '' }).valid).toBe(false)
  })

  it('rejects empty cart', () => {
    expect(validatePaymentRequest({ ...validCalculate, cart: { items: [] } }).valid).toBe(false)
  })

  it('rejects create without address', () => {
    const req = { ...validCalculate, createPayment: true }
    expect(validatePaymentRequest(req).valid).toBe(false)
  })

  it('rejects create with invalid email', () => {
    const req = { ...validCreate, address: { ...validCreate.address, contactEmail: 'bad' } }
    expect(validatePaymentRequest(req).valid).toBe(false)
  })

  it('accepts optional partialAddress', () => {
    const req = { ...validCalculate, partialAddress: { country: 'DE' } }
    expect(validatePaymentRequest(req)).toEqual({ valid: true })
  })

  it('rejects invalid partialAddress', () => {
    const req = { ...validCalculate, partialAddress: { country: '' } }
    expect(validatePaymentRequest(req).valid).toBe(false)
  })
})
