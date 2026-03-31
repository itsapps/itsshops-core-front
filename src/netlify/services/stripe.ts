import Stripe from 'stripe'
import { withRetry, type RetryOptions } from '../utils/retry'
import type { Logger } from '../utils/logger'

let stripeInstance: Stripe | null = null

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_API_KEY
    if (!key) throw new Error('STRIPE_SECRET_API_KEY environment variable is not set')
    stripeInstance = new Stripe(key, { apiVersion: '2025-04-30.basil' })
  }
  return stripeInstance
}

export async function createPaymentIntent(
  params: Stripe.PaymentIntentCreateParams,
  logger: Logger,
  retryOptions?: RetryOptions,
): Promise<Stripe.PaymentIntent> {
  return logger.timed('Stripe: create PaymentIntent', () =>
    withRetry(() => getStripe().paymentIntents.create(params), retryOptions),
  )
}

export async function updatePaymentIntent(
  id: string,
  params: Stripe.PaymentIntentUpdateParams,
  logger: Logger,
  retryOptions?: RetryOptions,
): Promise<Stripe.PaymentIntent> {
  return logger.timed('Stripe: update PaymentIntent', () =>
    withRetry(() => getStripe().paymentIntents.update(id, params), retryOptions),
  )
}

export function constructWebhookEvent(
  body: string,
  signature: string,
): Stripe.Event {
  const secret = process.env.STRIPE_ENDPOINT_SECRET
  if (!secret) throw new Error('STRIPE_ENDPOINT_SECRET environment variable is not set')
  return getStripe().webhooks.constructEvent(body, signature, secret)
}
