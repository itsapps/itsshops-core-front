import { ORDER_STATUS_PATH, type OrderStatusResult } from '../shared/order-api'
import { isPaymentIntentId } from '../shared/validation'

export type OrderStatusLookup =
  /** The payment webhook has created the order. */
  | { state: 'found'; orderNumber: string }
  /** No order (yet) — webhook still running, payment still processing, or never paid. */
  | { state: 'pending' }
  /** Transient (network, 5xx, rate limit) — worth asking again later. */
  | { state: 'error' }
  /** Permanent — endpoint not wired on this site, or invalid id. Don't ask again. */
  | { state: 'unavailable' }

/** Ask `order-status` for the order number of a PaymentIntent (see netlify/functions/order-status.ts). */
export async function lookupOrderStatus(paymentIntentId: string, apiUrl = ORDER_STATUS_PATH): Promise<OrderStatusLookup> {
  if (!isPaymentIntentId(paymentIntentId)) return { state: 'unavailable' }

  let res: Response
  try {
    res = await fetch(`${apiUrl}?payment_intent=${encodeURIComponent(paymentIntentId)}`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    })
  } catch {
    return { state: 'error' }
  }

  // A site that doesn't wire the function answers with its HTML 404 page.
  if (!res.headers.get('content-type')?.includes('application/json')) return { state: 'unavailable' }
  if (res.status === 404) return { state: 'pending' }
  if (res.status === 429 || res.status >= 500) return { state: 'error' }
  if (!res.ok) return { state: 'unavailable' }

  try {
    const { orderNumber } = (await res.json()) as OrderStatusResult
    return orderNumber ? { state: 'found', orderNumber } : { state: 'unavailable' }
  } catch {
    return { state: 'error' }
  }
}

const POLL_DELAYS_MS = [0, 1000, 2000, 4000, 8000]

/**
 * Poll until the webhook has created the order (≤ 5 requests over ~15 s). Resolves with the order
 * number, or null when it gave up — the confirmation email carries the number anyway.
 */
export async function pollOrderNumber(
  paymentIntentId: string,
  options: { delays?: number[]; sleep?: (ms: number) => Promise<void>; lookup?: typeof lookupOrderStatus } = {},
): Promise<string | null> {
  const { delays = POLL_DELAYS_MS, lookup = lookupOrderStatus } = options
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>(r => setTimeout(r, ms)))

  for (const delay of delays) {
    if (delay) await sleep(delay)
    const result = await lookup(paymentIntentId)
    if (result.state === 'found') return result.orderNumber
    if (result.state === 'unavailable') return null
  }
  return null
}
