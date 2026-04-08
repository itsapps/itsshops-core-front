/**
 * Manual end-to-end order creation against a customer's real Sanity + Stripe
 * backend. Reads variant + credentials from env vars, runs the full
 * payment-create → webhook flow, and leaves the resulting order, orderMeta,
 * and incremented invoice counter in Sanity (no cleanup) so the order is
 * viewable in the studio.
 *
 * Required env vars:
 *   STRIPE_SECRET_API_KEY
 *   STRIPE_ENDPOINT_SECRET
 *   SANITY_PROJECT_ID
 *   SANITY_DATASET
 *   SANITY_TOKEN
 *
 * Run from core-front, pointing at the customer's .env file:
 *   npx tsx --env-file=../../web/tinhof/webshop-frontend/.env \
 *     scripts/create-test-order.ts
 *
 * Optional: pass a specific variant id as the first arg, otherwise the script
 * picks the first active variant from Sanity.
 */
import Stripe from 'stripe'
import { createClient } from '@sanity/client'
import { createPaymentHandler } from '../src/netlify/functions/payment-create'
import { createWebhookHandler } from '../src/netlify/functions/payment-webhooks'
import { sanityApiVersion } from '../src/config/constants'
import type { CreatePaymentResponse } from '../src/shared/checkout-api'

function buildJsonRequest(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function buildPaymentIntentEvent(paymentIntent: Stripe.PaymentIntent): string {
  const event: Stripe.Event = {
    id: `evt_manual_${Date.now()}`,
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

async function main() {
  const stripeKey = process.env.STRIPE_SECRET_API_KEY
  const endpointSecret = process.env.STRIPE_ENDPOINT_SECRET
  const projectId = process.env.SANITY_PROJECT_ID
  const dataset = process.env.SANITY_DATASET
  const token = process.env.SANITY_TOKEN

  if (!stripeKey || !endpointSecret || !projectId || !dataset || !token) {
    throw new Error(
      'Missing env vars. Required: STRIPE_SECRET_API_KEY, STRIPE_ENDPOINT_SECRET, SANITY_PROJECT_ID, SANITY_DATASET, SANITY_TOKEN',
    )
  }

  console.log(`Target dataset: ${projectId}/${dataset}`)

  const sanity = createClient({
    projectId,
    dataset,
    token,
    apiVersion: sanityApiVersion,
    useCdn: false,
  })

  const config = { defaultLocale: 'de', features: { shop: { stock: false } } }
  const paymentHandler = createPaymentHandler(config)
  const webhookHandler = createWebhookHandler(config)
  const stripe = new Stripe(stripeKey)
  const dummyContext = {} as any

  // Pick variant: cli arg, else first active variant in Sanity
  const cliVariant = process.argv[2]
  let variantId: string
  if (cliVariant) {
    variantId = cliVariant
  } else {
    const found = await sanity.fetch<{ _id: string } | null>(
      `*[_type == "productVariant" && status == "active"][0]{_id}`,
    )
    if (!found) throw new Error('No active product variant found in Sanity')
    variantId = found._id
  }
  console.log(`Using variant: ${variantId}`)

  // ── Phase 1: payment-create → orderMeta + Stripe PaymentIntent ──────────
  const createRes = await paymentHandler(
    buildJsonRequest('/api/payment/create', {
      cart: {
        items: [
          {
            variantId,
            quantity: 1,
            displayTitle: 'Manual test order',
          },
        ],
      },
      createPayment: true,
      address: {
        shipping: {
          name: 'Manual Test',
          prename: 'Manual',
          lastname: 'Test',
          line1: 'Teststraße 1',
          zip: '1010',
          city: 'Wien',
          country: 'AT',
        },
        contactEmail: 'manual-test@example.com',
      },
      locale: 'de',
    }),
    dummyContext,
  )

  if (createRes.status !== 200) {
    const errBody = await createRes.text()
    throw new Error(`payment-create failed (${createRes.status}): ${errBody}`)
  }
  const createBody = (await createRes.json()) as CreatePaymentResponse
  console.log(`orderMeta created: ${createBody.orderMetaId}`)

  const piId = createBody.clientSecret.split('_secret_')[0]
  const paymentIntent = await stripe.paymentIntents.retrieve(piId)
  console.log(`PaymentIntent: ${paymentIntent.id} (${paymentIntent.status})`)

  // ── Phase 2: signed webhook → order document ────────────────────────────
  const eventBody = buildPaymentIntentEvent(paymentIntent)
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload: eventBody,
    secret: endpointSecret,
  })

  // Webhook is a background function — returns void on completion. Errors
  // would throw, so reaching the next line means it ran without crashing.
  await webhookHandler(
    new Request('http://localhost/api/payment/webhooks', {
      method: 'POST',
      headers: { 'stripe-signature': signature },
      body: eventBody,
    }),
    dummyContext,
  )

  // ── Look up the created order to print its details ──────────────────────
  const order = await sanity.fetch<{ _id: string; orderNumber: string; invoiceNumber: string } | null>(
    `*[_type == "order" && paymentIntentId == $piId][0]{ _id, orderNumber, invoiceNumber }`,
    { piId: paymentIntent.id },
  )

  if (!order) throw new Error('Order document not found after webhook ran')

  console.log('')
  console.log('Order created (no cleanup — view it in Sanity Studio):')
  console.log(`  _id:           ${order._id}`)
  console.log(`  orderNumber:   ${order.orderNumber}`)
  console.log(`  invoiceNumber: ${order.invoiceNumber}`)
  console.log(`  orderMetaId:   ${createBody.orderMetaId}`)
  console.log(`  paymentIntent: ${paymentIntent.id}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
