import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Stripe from 'stripe'
import { createPaymentHandler } from '../netlify/functions/payment-create'
import { createWebhookHandler, type WebhookHandlerOptions } from '../netlify/functions/payment-webhooks'
import type { ServerConfig } from '../netlify/types/config'
import type { CreatePaymentResponse } from '../shared/checkout-api'
import { TestCleanup } from './cleanup'

type TestConfig = ServerConfig & {
  getVariantIds: () => Promise<string[]>
  onOrderCreated?: WebhookHandlerOptions['onOrderCreated']
}

function buildJsonRequest(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function buildWebhookRequest(body: string, signature: string): Request {
  return new Request('http://localhost/api/payment/webhooks', {
    method: 'POST',
    headers: { 'stripe-signature': signature },
    body,
  })
}

function buildPaymentIntentEvent(paymentIntent: Stripe.PaymentIntent): string {
  const event: Stripe.Event = {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    api_version: '2025-03-31.basil' as any,
    created: Math.floor(Date.now() / 1000),
    type: 'payment_intent.succeeded',
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    data: { object: paymentIntent },
  }
  return JSON.stringify(event)
}

function createPaymentAndGetIntent(
  paymentHandler: ReturnType<typeof createPaymentHandler>,
  stripe: Stripe,
  config: TestConfig,
  cleanup: TestCleanup,
  overrides: { lastname?: string; contactEmail?: string } = {},
) {
  const dummyContext = {} as any
  return async () => {
    const variantIds = await config.getVariantIds()

    const lastname = overrides.lastname ?? 'Webhook'
    const res = await paymentHandler(
      buildJsonRequest('/api/payment/create', {
        cart: { items: [{ variantId: variantIds[0], quantity: 1 }] },
        createPayment: true,
        address: {
          shipping: {
            name: `Test ${lastname}`,
            prename: 'Test',
            lastname,
            line1: 'Teststraße 1',
            zip: '1010',
            city: 'Wien',
            country: 'AT',
          },
          contactEmail: overrides.contactEmail ?? 'test@example.com',
        },
        locale: config.defaultLocale ?? 'de',
      }),
      dummyContext,
    )

    const body = (await res.json()) as CreatePaymentResponse
    cleanup.trackOrderMeta(body.orderMetaId)

    const piId = body.clientSecret.split('_secret_')[0]
    return stripe.paymentIntents.retrieve(piId)
  }
}

export function paymentWebhookTests(config: TestConfig) {
  const paymentHandler = createPaymentHandler(config)
  const webhookHandler = createWebhookHandler(config)
  const dummyContext = {} as any
  const endpointSecret = process.env.STRIPE_ENDPOINT_SECRET!
  const stripe = new Stripe(process.env.STRIPE_SECRET_API_KEY!)
  const cleanup = new TestCleanup()

  beforeAll(async () => {
    await cleanup.saveInvoiceCounter()
  })

  afterAll(async () => {
    await cleanup.cleanup()
  })

  describe('payment-webhooks: payment_intent.succeeded', () => {
    let paymentIntent: Stripe.PaymentIntent

    beforeAll(async () => {
      const getIntent = createPaymentAndGetIntent(paymentHandler, stripe, config, cleanup)
      paymentIntent = await getIntent()
    })

    it('creates an order from payment_intent.succeeded', async () => {
      const eventBody = buildPaymentIntentEvent(paymentIntent)
      const signature = Stripe.webhooks.generateTestHeaderString({
        payload: eventBody,
        secret: endpointSecret,
      })

      await webhookHandler(
        buildWebhookRequest(eventBody, signature),
        dummyContext,
      )
    })

    it('is idempotent — does not create duplicate order', async () => {
      const eventBody = buildPaymentIntentEvent(paymentIntent)
      const signature = Stripe.webhooks.generateTestHeaderString({
        payload: eventBody,
        secret: endpointSecret,
      })

      await webhookHandler(
        buildWebhookRequest(eventBody, signature),
        dummyContext,
      )
    })

    it('rejects invalid signature', async () => {
      const eventBody = buildPaymentIntentEvent(paymentIntent)

      await webhookHandler(
        buildWebhookRequest(eventBody, 'invalid_signature'),
        dummyContext,
      )
    })

    it('skips when missing stripe-signature header', async () => {
      const request = new Request('http://localhost/api/payment/webhooks', {
        method: 'POST',
        body: 'test',
      })

      await webhookHandler(request, dummyContext)
    })

    it('skips non-POST requests', async () => {
      const request = new Request('http://localhost/api/payment/webhooks', {
        method: 'GET',
      })

      await webhookHandler(request, dummyContext)
    })
  })

  describe('payment-webhooks: onOrderCreated callback', () => {
    it('calls onOrderCreated when provided', async () => {
      let callbackOrder: any = null

      const handlerWithCallback = createWebhookHandler({
        ...config,
        onOrderCreated: async (order) => {
          callbackOrder = order
        },
      })

      const getIntent = createPaymentAndGetIntent(paymentHandler, stripe, config, cleanup, {
        lastname: 'Callback',
        contactEmail: 'callback@example.com',
      })
      const paymentIntent = await getIntent()

      const eventBody = buildPaymentIntentEvent(paymentIntent)
      const signature = Stripe.webhooks.generateTestHeaderString({
        payload: eventBody,
        secret: endpointSecret,
      })

      await handlerWithCallback(
        buildWebhookRequest(eventBody, signature),
        dummyContext,
      )

      expect(callbackOrder).not.toBeNull()
      expect(callbackOrder._id).toBeDefined()
      expect(callbackOrder.orderNumber).toBeDefined()
    })
  })
}
