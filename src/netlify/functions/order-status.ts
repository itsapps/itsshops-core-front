import type { Context } from '@netlify/functions'
import { log } from '../utils/logger'
import { success, errorResponse, methodNotAllowed, badRequest } from '../utils/response'
import { ErrorCode } from '../types/errors'
import { isPaymentIntentId } from '../../shared/validation'
import { fetchOrderNumberByPaymentIntent } from '../services/sanity'
import type { OrderStatusResult } from '../../shared/order-api'

/**
 * Order number for a PaymentIntent, once the payment webhook has created the order.
 *
 * Used by the order-thanks page (shows the number) and the cart (clears a cart whose payment
 * completed without reaching the thanks page). Returns **only** the order number — no personal
 * data — so the PaymentIntent id (unguessable, but visible in the return URL) is enough to ask.
 * 404 = no order (yet). Responses are never cached. Per-IP rate limit: set `config.rateLimit` in
 * the customer's wrapper.
 */
export function createOrderStatusHandler() {
  return async (request: Request, _context: Context): Promise<Response> => {
    const res = await handle(request)
    res.headers.set('cache-control', 'no-store')
    return res
  }
}

async function handle(request: Request): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed()

  const paymentIntentId = new URL(request.url).searchParams.get('payment_intent')
  if (!isPaymentIntentId(paymentIntentId)) return badRequest('Invalid payment_intent')

  try {
    const orderNumber = await fetchOrderNumberByPaymentIntent(paymentIntentId)
    if (!orderNumber) return errorResponse(ErrorCode.ORDER_NOT_FOUND, 'Order not found', undefined, 404)
    return success<OrderStatusResult>({ orderNumber })
  } catch (err) {
    log.error('Order status lookup failed', { error: err instanceof Error ? err.message : String(err) })
    return errorResponse(ErrorCode.INTERNAL_ERROR, 'Internal error')
  }
}
