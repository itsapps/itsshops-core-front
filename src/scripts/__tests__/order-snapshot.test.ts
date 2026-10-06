// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { CreatePaymentResponse } from '../../shared/checkout-api'
import type { CartItem } from '../cart-store'
import {
  buildOrderSnapshot,
  paymentIntentIdFromSecret,
  saveOrderSnapshot,
  takeOrderSnapshot,
} from '../order-snapshot'

const response = {
  clientSecret: 'pi_123_secret_abc',
  orderMetaId: 'meta-1',
  items: [
    { variantId: 'v1', title: 'Server title', subtitle: null, imageUrl: null, price: 1450, quantity: 2, requestedQuantity: 2 },
  ],
  unavailableItems: [],
  totals: { subtotal: 2900, shipping: 590, tax: 580, discount: 0, grandTotal: 3490, vatBreakdown: [{ rate: 20, net: 2908, vat: 582 }] },
  shippingMethods: [
    { _id: 'ship', title: 'Post', methodType: 'delivery', price: 590, isFree: false },
    { _id: 'pick', title: 'Abholung im Weingut', methodType: 'pickup', price: 0, isFree: true },
  ],
  selectedShippingMethodId: 'ship',
  selectedCountry: 'AT',
  supportedCountries: [{ code: 'AT', title: 'Österreich' }],
  currency: 'EUR',
  appliedCoupons: [],
  couponError: null,
} as unknown as CreatePaymentResponse

const localCart = new Map<string, CartItem>([
  ['v1', { id: 'v1', title: 'Grüner Veltliner', subtitle: '2023', price: 1400, quantity: 3, imageUrl: '/img.jpg', url: '/de/gv' }],
])

const address = {
  name: 'Anna Muster', prename: 'Anna', lastname: 'Muster', phone: '+43 1',
  line1: 'Hauptstraße 1', zip: '3550', city: 'Langenlois', country: 'AT',
}

const build = (overrides: Partial<Parameters<typeof buildOrderSnapshot>[0]> = {}) =>
  buildOrderSnapshot({ response, localCart, email: 'anna@example.com', address, now: 1_000_000, ...overrides })

describe('paymentIntentIdFromSecret', () => {
  it('returns the id part only', () => {
    expect(paymentIntentIdFromSecret('pi_3Q_secret_xyz')).toBe('pi_3Q')
  })
  it('rejects anything that is not a PaymentIntent secret', () => {
    expect(paymentIntentIdFromSecret('seti_1_secret_x')).toBeNull()
    expect(paymentIntentIdFromSecret('pi_123')).toBeNull()
  })
})

describe('buildOrderSnapshot', () => {
  it('keeps server quantity/price with local display strings', () => {
    const s = build()!
    expect(s.items).toEqual([
      { title: 'Grüner Veltliner', subtitle: '2023', imageUrl: '/img.jpg', url: '/de/gv', price: 1450, quantity: 2 },
    ])
  })

  it('stores the minimum: no secret, phone or orderMetaId', () => {
    const json = JSON.stringify(build())
    expect(json).not.toContain('secret')
    expect(json).not.toContain('+43 1')
    expect(json).not.toContain('meta-1')
    expect(build()!.paymentIntentId).toBe('pi_123')
  })

  it('resolves shipping method, country title and first name', () => {
    const s = build()!
    expect(s.shippingMethod).toEqual({ title: 'Post', methodType: 'delivery' })
    expect(s.shippingAddress?.country).toBe('Österreich')
    expect(s.firstName).toBe('Anna')
  })

  it('prefers the explicitly selected method (express checkout) and falls back to name', () => {
    const s = build({ shippingMethodId: 'pick', address: { ...address, prename: undefined, name: 'Max Muster' } })!
    expect(s.shippingMethod).toEqual({ title: 'Abholung im Weingut', methodType: 'pickup' })
    expect(s.firstName).toBe('Max')
  })
})

describe('save / take', () => {
  beforeEach(() => sessionStorage.clear())

  it('round-trips for the matching payment intent and deletes on read', () => {
    saveOrderSnapshot(build())
    expect(takeOrderSnapshot('pi_123', 1_000_000 + 1000)?.email).toBe('anna@example.com')
    expect(takeOrderSnapshot('pi_123', 1_000_000 + 1000)).toBeNull()
  })

  it('discards a snapshot of another payment', () => {
    saveOrderSnapshot(build())
    expect(takeOrderSnapshot('pi_other', 1_000_000)).toBeNull()
    expect(sessionStorage.length).toBe(0)
  })

  it('discards an expired snapshot', () => {
    saveOrderSnapshot(build())
    expect(takeOrderSnapshot('pi_123', 1_000_000 + 31 * 60 * 1000)).toBeNull()
  })

  it('ignores garbage', () => {
    sessionStorage.setItem('itsshops_order_snapshot', '{not json')
    expect(takeOrderSnapshot('pi_123')).toBeNull()
  })

  it('survives blocked storage', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(() => saveOrderSnapshot(build())).not.toThrow()
    expect(takeOrderSnapshot('pi_123')).toBeNull()
    spy.mockRestore()
    vi.restoreAllMocks()
  })
})
