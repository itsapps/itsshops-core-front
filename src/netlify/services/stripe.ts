import Stripe from 'stripe'

let client: Stripe | null = null

/**
 * Lazily construct (and memoize) the Stripe client. Initialization is deferred
 * to first use so merely importing this module — e.g. transitively via the
 * test-utils barrel — doesn't throw in projects that don't use Stripe.
 */
function stripe(): Stripe {
  if (client) return client
  const key = process.env.STRIPE_SECRET_API_KEY
  if (!key) throw new Error('STRIPE_SECRET_API_KEY environment variable is not set')
  client = new Stripe(key, { maxNetworkRetries: 2, typescript: true })
  return client
}

export function createPaymentIntent(
  params: Stripe.PaymentIntentCreateParams,
): Promise<Stripe.PaymentIntent> {
  return stripe().paymentIntents.create(params)
}

export function updatePaymentIntent(
  id: string,
  params: Stripe.PaymentIntentUpdateParams,
): Promise<Stripe.PaymentIntent> {
  return stripe().paymentIntents.update(id, params)
}

export function refundPayment(
  paymentIntentId: string,
  amount?: number,
): Promise<Stripe.Refund> {
  return stripe().refunds.create({
    payment_intent: paymentIntentId,
    ...(amount !== undefined && { amount }),
  })
}

export function constructWebhookEvent(
  body: string,
  signature: string,
): Stripe.Event {
  const secret = process.env.STRIPE_ENDPOINT_SECRET
  if (!secret) throw new Error('STRIPE_ENDPOINT_SECRET environment variable is not set')
  return stripe().webhooks.constructEvent(body, signature, secret)
}
