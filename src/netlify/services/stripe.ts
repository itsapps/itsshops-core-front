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

/** PaymentIntent with its latest charge expanded — `payment_method_details` is what was charged. */
export function retrievePaymentIntentWithCharge(id: string): Promise<Stripe.PaymentIntent> {
  return stripe().paymentIntents.retrieve(id, { expand: ['latest_charge'] })
}

/**
 * Refund created from the Studio (`payment-refund` is only called from there). The metadata
 * marks it as such, so `syncOrderRefunds` can tell it from a Stripe-dashboard refund.
 */
/**
 * Studio refund. `idempotencyKey` makes a repeated request (two confirms at once) create one refund;
 * a replayed response carries `lastResponse.headers['idempotent-replayed'] === 'true'`.
 */
export function refundPayment(
  paymentIntentId: string,
  amount: number | undefined,
  idempotencyKey: string,
): Promise<Stripe.Response<Stripe.Refund>> {
  return stripe().refunds.create(
    {
      payment_intent: paymentIntentId,
      ...(amount !== undefined && { amount }),
      metadata: { itsshopsSource: 'studio' },
    },
    { idempotencyKey },
  )
}

/** All refunds of a PaymentIntent (newest first, as Stripe lists them). */
export async function listRefunds(paymentIntentId: string): Promise<Stripe.Refund[]> {
  const list = await stripe().refunds.list({ payment_intent: paymentIntentId, limit: 100 })
  return list.data
}

export function constructWebhookEvent(
  body: string,
  signature: string,
): Stripe.Event {
  const secret = process.env.STRIPE_ENDPOINT_SECRET
  if (!secret) throw new Error('STRIPE_ENDPOINT_SECRET environment variable is not set')
  return stripe().webhooks.constructEvent(body, signature, secret)
}
