import { describe, it, expect, vi } from 'vitest'
import type Stripe from 'stripe'

vi.mock('../services/stripe', () => ({ retrievePaymentIntentWithCharge: vi.fn(), constructWebhookEvent: vi.fn() }))
vi.mock('../services/sanity', () => ({}))
vi.mock('../utils/logger', () => ({ log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() } }))

import { mapPaymentMethodDetails, paymentMethodLabel } from '../lib/payment-method'
import { fetchChargedPaymentMethod } from '../functions/payment-webhooks'
import { retrievePaymentIntentWithCharge } from '../services/stripe'
import { serverT } from '../utils/i18n'

const details = (d: Record<string, unknown>) => d as unknown as Stripe.Charge.PaymentMethodDetails
const de = (key: string) => serverT('de', key)
const en = (key: string) => serverT('en', key)

describe('mapPaymentMethodDetails', () => {
  it('card: brand + last4 only', () => {
    expect(mapPaymentMethodDetails(details({
      type: 'card',
      card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030, fingerprint: 'fp', wallet: null },
    }))).toEqual({ _type: 'orderPaymentMethod', type: 'card', brand: 'visa', last4: '4242' })
  })

  it('card in a wallet', () => {
    expect(mapPaymentMethodDetails(details({
      type: 'card', card: { brand: 'mastercard', last4: '4444', wallet: { type: 'apple_pay' } },
    }))).toEqual({ _type: 'orderPaymentMethod', type: 'card', brand: 'mastercard', last4: '4444', wallet: 'apple_pay' })
  })

  it('sepa: last 4 IBAN digits; eps/klarna: type only', () => {
    expect(mapPaymentMethodDetails(details({ type: 'sepa_debit', sepa_debit: { last4: '3000', bank_code: 'x' } })))
      .toEqual({ _type: 'orderPaymentMethod', type: 'sepa_debit', last4: '3000' })
    expect(mapPaymentMethodDetails(details({ type: 'eps', eps: { bank: 'erste_bank_und_sparkassen' } })))
      .toEqual({ _type: 'orderPaymentMethod', type: 'eps' })
    expect(mapPaymentMethodDetails(details({ type: 'klarna', klarna: {} })))
      .toEqual({ _type: 'orderPaymentMethod', type: 'klarna' })
  })

  it('nothing to map', () => {
    expect(mapPaymentMethodDetails(null)).toBeNull()
    expect(mapPaymentMethodDetails(undefined)).toBeNull()
  })
})

describe('paymentMethodLabel', () => {
  it.each([
    [{ type: 'card', brand: 'visa', last4: '4242' }, 'Visa •••• 4242'],
    [{ type: 'card', brand: 'visa', last4: '4242', wallet: 'apple_pay' }, 'Apple Pay (Visa •••• 4242)'],
    [{ type: 'sepa_debit', last4: '3000' }, 'SEPA-Lastschrift •••• 3000'],
    [{ type: 'eps' }, 'EPS'],
    [{ type: 'paypal' }, 'PayPal'],
    [{ type: 'some_new_method' }, 'Online-Zahlung'],
  ])('%o → %s', (p, label) => {
    expect(paymentMethodLabel({ _type: 'orderPaymentMethod', ...p }, de)).toBe(label)
  })

  it('translates per locale', () => {
    expect(paymentMethodLabel({ _type: 'orderPaymentMethod', type: 'sepa_debit', last4: '3000' }, en)).toBe('SEPA Direct Debit •••• 3000')
  })
})

describe('fetchChargedPaymentMethod', () => {
  it('reads the expanded latest charge', async () => {
    vi.mocked(retrievePaymentIntentWithCharge).mockResolvedValueOnce({
      latest_charge: { payment_method_details: { type: 'eps', eps: {} } },
    } as unknown as Stripe.PaymentIntent)
    expect(await fetchChargedPaymentMethod('pi_1')).toEqual({ _type: 'orderPaymentMethod', type: 'eps' })
  })

  it('a Stripe failure never blocks the order: null', async () => {
    vi.mocked(retrievePaymentIntentWithCharge).mockRejectedValueOnce(new Error('stripe down'))
    expect(await fetchChargedPaymentMethod('pi_1')).toBeNull()
  })
})
