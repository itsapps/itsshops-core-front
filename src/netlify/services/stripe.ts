import Stripe from 'stripe'

function initStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_API_KEY
  if (!key) throw new Error('STRIPE_SECRET_API_KEY environment variable is not set')
  return new Stripe(key, { maxNetworkRetries: 2, typescript: true })
}

const stripe = initStripe()

export function createPaymentIntent(
  params: Stripe.PaymentIntentCreateParams,
): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.create(params)
}

export function updatePaymentIntent(
  id: string,
  params: Stripe.PaymentIntentUpdateParams,
): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.update(id, params)
}

export function constructWebhookEvent(
  body: string,
  signature: string,
): Stripe.Event {
  const secret = process.env.STRIPE_ENDPOINT_SECRET
  if (!secret) throw new Error('STRIPE_ENDPOINT_SECRET environment variable is not set')
  return stripe.webhooks.constructEvent(body, signature, secret)
}
