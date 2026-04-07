import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createPaymentHandler } from '../netlify/functions/payment-create'
import type { ServerConfig } from '../netlify/types/config'
import type { CalculateResponse, CreatePaymentResponse, ErrorResponse } from '../shared/checkout-api'
import { TestCleanup } from './cleanup'

type TestConfig = ServerConfig & {
  /** Return at least 2 active variant IDs from the customer's Sanity dataset */
  getVariantIds: () => Promise<string[]>
}

function buildRequest(body: unknown): Request {
  return new Request('http://localhost/api/payment/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function parseResponse<T>(res: Response): Promise<{ status: number; body: T }> {
  return { status: res.status, body: await res.json() as T }
}

export function paymentCreateTests(config: TestConfig) {
  const handler = createPaymentHandler(config)
  const dummyContext = {} as any
  const cleanup = new TestCleanup()

  beforeAll(async () => {
    await cleanup.saveInvoiceCounter()
  })

  afterAll(async () => {
    await cleanup.cleanup()
  })

  describe('payment-create: calculate', () => {
    let variantIds: string[]

    beforeAll(async () => {
      variantIds = await config.getVariantIds()
      expect(variantIds.length).toBeGreaterThan(0)
    })

    it('returns calculated totals for valid cart', async () => {
      const res = await handler(
        buildRequest({
          cart: { items: variantIds.map(id => ({ variantId: id, quantity: 1 })) },
          createPayment: false,
          locale: config.defaultLocale ?? 'de',
        }),
        dummyContext,
      )

      const { status, body } = await parseResponse<CalculateResponse>(res)
      expect(status).toBe(200)
      expect(body.items.length).toBeGreaterThan(0)
      expect(body.totals.subtotal).toBeGreaterThan(0)
      expect(body.totals.grandTotal).toBeGreaterThan(0)
      expect(body.currency).toBe('EUR')
      expect(body.supportedCountries.length).toBeGreaterThan(0)
    })

    it('returns shipping methods for default country', async () => {
      const res = await handler(
        buildRequest({
          cart: { items: [{ variantId: variantIds[0], quantity: 1 }] },
          createPayment: false,
          locale: config.defaultLocale ?? 'de',
        }),
        dummyContext,
      )

      const { status, body } = await parseResponse<CalculateResponse>(res)
      expect(status).toBe(200)
      expect(body.shippingMethods.length).toBeGreaterThan(0)
    })

    it('returns error for unsupported country', async () => {
      const res = await handler(
        buildRequest({
          cart: { items: [{ variantId: variantIds[0], quantity: 1 }] },
          createPayment: false,
          partialAddress: { country: 'XX' },
          locale: config.defaultLocale ?? 'de',
        }),
        dummyContext,
      )

      const { status, body } = await parseResponse<ErrorResponse>(res)
      expect(status).toBe(400)
      expect(body.error.code).toBeDefined()
    })

    it('returns error for empty cart', async () => {
      const res = await handler(
        buildRequest({
          cart: { items: [] },
          createPayment: false,
          locale: config.defaultLocale ?? 'de',
        }),
        dummyContext,
      )

      const { status } = await parseResponse<ErrorResponse>(res)
      expect(status).toBe(400)
    })

    it('returns error for nonexistent variant', async () => {
      const res = await handler(
        buildRequest({
          cart: { items: [{ variantId: 'nonexistent-variant-id', quantity: 1 }] },
          createPayment: false,
          locale: config.defaultLocale ?? 'de',
        }),
        dummyContext,
      )

      const { status, body } = await parseResponse<ErrorResponse>(res)
      expect(status).toBe(400)
      expect(body.error.code).toBeDefined()
    })

    it('handles quantity > 1 correctly', async () => {
      const locale = config.defaultLocale ?? 'de'
      const singleRes = await handler(
        buildRequest({
          cart: { items: [{ variantId: variantIds[0], quantity: 1 }] },
          createPayment: false,
          locale,
        }),
        dummyContext,
      )
      const single = await parseResponse<CalculateResponse>(singleRes)

      const doubleRes = await handler(
        buildRequest({
          cart: { items: [{ variantId: variantIds[0], quantity: 2 }] },
          createPayment: false,
          locale,
        }),
        dummyContext,
      )
      const double = await parseResponse<CalculateResponse>(doubleRes)

      expect(double.body.totals.subtotal).toBe(single.body.totals.subtotal * 2)
    })
  })

  describe('payment-create: create payment', () => {
    let variantIds: string[]

    beforeAll(async () => {
      variantIds = await config.getVariantIds()
      expect(variantIds.length).toBeGreaterThan(0)
    })

    it('creates a PaymentIntent with valid address', async () => {
      const res = await handler(
        buildRequest({
          cart: { items: [{ variantId: variantIds[0], quantity: 1 }] },
          createPayment: true,
          address: {
            shipping: {
              prename: 'Test',
              lastname: 'User',
              line1: 'Teststraße 1',
              zip: '1010',
              city: 'Wien',
              country: 'AT',
            },
            contactEmail: 'test@example.com',
          },
          locale: config.defaultLocale ?? 'de',
        }),
        dummyContext,
      )

      const { status, body } = await parseResponse<CreatePaymentResponse>(res)
      expect(status).toBe(200)
      expect(body.clientSecret).toBeDefined()
      expect(body.clientSecret.length).toBeGreaterThan(0)
      expect(body.orderMetaId).toBeDefined()
      expect(body.totals.grandTotal).toBeGreaterThan(0)
      cleanup.trackOrderMeta(body.orderMetaId)
    })

    it('updates existing PaymentIntent with orderMetaId', async () => {
      const locale = config.defaultLocale ?? 'de'
      const address = {
        shipping: {
          prename: 'Test',
          lastname: 'User',
          line1: 'Teststraße 1',
          zip: '1010',
          city: 'Wien',
          country: 'AT',
        },
        contactEmail: 'test@example.com',
      }

      const createRes = await handler(
        buildRequest({
          cart: { items: [{ variantId: variantIds[0], quantity: 1 }] },
          createPayment: true,
          address,
          locale,
        }),
        dummyContext,
      )
      const created = (await createRes.json()) as CreatePaymentResponse
      cleanup.trackOrderMeta(created.orderMetaId)

      const updateRes = await handler(
        buildRequest({
          cart: { items: [{ variantId: variantIds[0], quantity: 2 }] },
          createPayment: true,
          orderMetaId: created.orderMetaId,
          address,
          locale,
        }),
        dummyContext,
      )

      const { status, body } = await parseResponse<CreatePaymentResponse>(updateRes)
      expect(status).toBe(200)
      expect(body.orderMetaId).toBe(created.orderMetaId)
      expect(body.clientSecret).toBeDefined()
    })

    it('rejects payment without address', async () => {
      const res = await handler(
        buildRequest({
          cart: { items: [{ variantId: variantIds[0], quantity: 1 }] },
          createPayment: true,
          locale: config.defaultLocale ?? 'de',
        }),
        dummyContext,
      )

      const { status } = await parseResponse<ErrorResponse>(res)
      expect(status).toBe(400)
    })

    it('rejects payment with invalid email', async () => {
      const res = await handler(
        buildRequest({
          cart: { items: [{ variantId: variantIds[0], quantity: 1 }] },
          createPayment: true,
          address: {
            shipping: {
              prename: 'Test',
              lastname: 'User',
              line1: 'Teststraße 1',
              zip: '1010',
              city: 'Wien',
              country: 'AT',
            },
            contactEmail: 'not-an-email',
          },
          locale: config.defaultLocale ?? 'de',
        }),
        dummyContext,
      )

      const { status } = await parseResponse<ErrorResponse>(res)
      expect(status).toBe(400)
    })
  })
}
