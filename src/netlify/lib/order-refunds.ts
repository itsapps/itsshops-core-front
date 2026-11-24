import type Stripe from 'stripe'
import { listRefunds } from '../services/stripe'
import { fetchOrderRevision, writeOrderRefunds } from '../services/sanity'
import type { OrderDocument, OrderRefund } from '../types/checkout'
import { log } from '../utils/logger'

// `order.refunds` — Stripe is the source of truth, core-front the only writer. Every caller
// (`payment-refund` right after a refund, the `charge.refunded` / `refund.updated` webhooks)
// rebuilds the whole array from Stripe's refund list, so it is idempotent by construction.

function toOrderRefund(refund: Stripe.Refund): OrderRefund {
  return {
    _key: refund.id,
    _type: 'orderRefund',
    refundId: refund.id,
    amount: refund.amount,
    createdAt: new Date(refund.created * 1000).toISOString(),
    // The SDK types it `string | null`.
    status: refund.status ?? 'pending',
    // Dashboard refunds carry no metadata.
    source: refund.metadata?.itsshopsSource === 'studio' ? 'studio' : 'stripe',
    ...(refund.reason && { reason: refund.reason }),
    ...(refund.failure_reason && { failureReason: refund.failure_reason }),
  }
}

const isConflict = (err: unknown): boolean =>
  (err as { statusCode?: number } | null)?.statusCode === 409

/** JSON with sorted object keys — Sanity may return a stored entry's fields in another order. */
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  )

/** Pauses before the retries of a revision conflict. */
const RETRY_DELAYS_MS = [250, 750]
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function syncOnce(paymentIntentId: string): Promise<OrderRefund[] | null> {
  // Revision first, Stripe list second: a stale list then always loses to a newer write.
  const order = await fetchOrderRevision(paymentIntentId)
  if (!order) {
    log.warn('Order not found for refund sync', { paymentIntentId })
    return null
  }
  const refunds = (await listRefunds(paymentIntentId))
    .slice()
    .sort((a, b) => a.created - b.created)
    .map(toOrderRefund)
  // Stripe sends charge.refunded and refund.updated in the same second: the second sync then
  // finds the list already stored and doesn't write (no revision conflict).
  if (canonical(order.refunds ?? []) !== canonical(refunds)) {
    await writeOrderRefunds(order, refunds)
  }
  return refunds
}

/**
 * Rebuild the order's `refunds` from Stripe. Returns the stored refunds, or null when no order
 * belongs to the payment (another system on the same Stripe account, a deleted test order).
 * A revision conflict (two webhooks, webhook + `payment-refund`, a Studio patch at the same
 * moment) is retried after a short pause, up to twice; a further conflict and every other error
 * are thrown — the webhook then answers 400 and Stripe retries.
 */
export async function syncOrderRefunds(paymentIntentId: string): Promise<OrderRefund[] | null> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await syncOnce(paymentIntentId)
    } catch (err) {
      if (!isConflict(err) || attempt >= RETRY_DELAYS_MS.length) throw err
      log.debug('Refund sync conflict, retrying', { paymentIntentId, attempt: attempt + 1 })
      await sleep(RETRY_DELAYS_MS[attempt])
    }
  }
}

/** Counted refunds — Stripe counts pending ones in `amount_refunded`, not failed / canceled. */
const counts = (refund: OrderRefund): boolean =>
  refund.status !== 'failed' && refund.status !== 'canceled'

/** Cents refunded so far (counted refunds only; no stored refunds → 0). */
export function refundedTotal(order: Pick<OrderDocument, 'refunds'>): number {
  return (order.refunds ?? []).filter(counts).reduce((sum, refund) => sum + refund.amount, 0)
}

/** The newest counted refund of the order (the one a refund mail states), if any. */
export function latestRefund(order: Pick<OrderDocument, 'refunds'>): OrderRefund | undefined {
  return (order.refunds ?? [])
    .filter(counts)
    .reduce<OrderRefund | undefined>(
      (latest, refund) => (!latest || refund.createdAt > latest.createdAt ? refund : latest),
      undefined,
    )
}
