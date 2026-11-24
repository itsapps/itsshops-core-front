import type { Context } from '@netlify/functions'
import { listRefunds, refundPayment } from '../services/stripe'
import { fetchOrderById } from '../services/sanity'
import { syncOrderRefunds } from '../lib/order-refunds'
import { ErrorCode } from '../types/errors'
import { log } from '../utils/logger'
import { errorResponse, success, methodNotAllowed, badRequest } from '../utils/response'
import { preflightResponse, requireServerSecret, withCors } from '../utils/server-auth'

// Studio-triggered refund. The dialog calls this from the order document
// action when an admin transitions paymentStatus → refunded / partiallyRefunded
// (and the withdrawal "Refund & close"). The refund is tagged
// `metadata.itsshopsSource = 'studio'`; right after it, the order's `refunds`
// are rebuilt from Stripe (`syncOrderRefunds`) so the Studio shows it at once.
// Stripe → charge.refunded webhook will subsequently update the order's
// paymentStatus (and sync `refunds` again), but the studio also patches the
// paymentStatus directly for instant feedback. Both paths must be idempotent.
//
// Request body: { orderId: string, amount?: number, expectedRefunded?: number }  // cents
// Auth: x-server-secret header (must match SERVER_FUNCTIONS_SECRET)
//
// The PaymentIntent is taken from the order, never from the request, so only a shop order can be
// refunded. Stripe rejects an amount above what's left.
//
// Duplicate guards (two tabs / two editors confirming the same order):
// 1. `expectedRefunded` = the counted refund total the Studio showed when its dialog opened. It is
//    compared with Stripe's live refunds (not the synced `order.refunds`, which lags 2–3 s) →
//    mismatch = someone refunded meanwhile → 409 REFUND_CONFLICT, nothing refunded. Covers any
//    second confirm that arrives after the first refund exists in Stripe, whatever its amount.
// 2. Idempotency key `refund:<orderId>:<refundCount>:<amount|full>` for requests so close together
//    that both read the refunds before either was created: same key → one refund; a replay
//    (`idempotent-replayed`) answers 409 REFUND_CONFLICT too.
// The Studio maps REFUND_CONFLICT to "changed meanwhile" — no order patch, no mail.

export type RefundRequestBody = {
  orderId: string
  amount?: number
  /** Counted refund total (cents) the Studio expects; omitted → no check. */
  expectedRefunded?: number
}

export type RefundResponseBody = {
  refundId: string
  status: string
  amount: number | null
}

export function createRefundHandler() {
  return async (request: Request, _context: Context): Promise<Response> => {
    if (request.method === 'OPTIONS') {
      return preflightResponse(request)
    }
    if (request.method !== 'POST') {
      return withCors(methodNotAllowed(), request)
    }

    const authError = requireServerSecret(request)
    if (authError) return authError

    const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()

    let body: RefundRequestBody
    try {
      body = (await request.json()) as RefundRequestBody
    } catch {
      return withCors(badRequest('Invalid JSON body'), request)
    }

    if (!body.orderId || typeof body.orderId !== 'string') {
      return withCors(badRequest('orderId is required'), request)
    }
    if (body.amount !== undefined && (!Number.isInteger(body.amount) || body.amount <= 0)) {
      return withCors(badRequest('amount must be a positive integer (cents)'), request)
    }
    if (
      body.expectedRefunded !== undefined &&
      (!Number.isInteger(body.expectedRefunded) || body.expectedRefunded < 0)
    ) {
      return withCors(badRequest('expectedRefunded must be a non-negative integer (cents)'), request)
    }

    const { orderId, amount, expectedRefunded } = body
    const conflict = (message: string) =>
      withCors(errorResponse(ErrorCode.REFUND_CONFLICT, message, requestId, 409), request)
    const notFound = () =>
      withCors(errorResponse(ErrorCode.ORDER_NOT_FOUND, 'Order not found', requestId, 404), request)

    let paymentIntentId: string
    let idempotencyKey: string
    try {
      // Orders are only ever published documents.
      if (orderId.startsWith('drafts.')) return notFound()
      const order = await fetchOrderById(orderId)
      if (!order || order._type !== 'order' || !order.paymentIntentId) return notFound()
      paymentIntentId = order.paymentIntentId
      const refunds = await listRefunds(paymentIntentId)
      if (expectedRefunded !== undefined) {
        // Same rule as the Studio's counted total: failed / canceled refunds don't count.
        const refunded = refunds
          .filter((r) => r.status !== 'failed' && r.status !== 'canceled')
          .reduce((sum, r) => sum + r.amount, 0)
        if (refunded !== expectedRefunded) {
          log.warn('Refund refused: refunds changed meanwhile', {
            requestId,
            orderId,
            expectedRefunded,
            refunded,
          })
          return conflict('The order was refunded meanwhile')
        }
      }
      idempotencyKey = `refund:${orderId}:${refunds.length}:${amount ?? 'full'}`
    } catch (err) {
      log.error('Refund lookup failed', {
        requestId,
        orderId,
        error: err instanceof Error ? err.message : String(err),
      })
      return withCors(errorResponse(ErrorCode.REFUND_FAILED, 'Refund failed', requestId, 502), request)
    }

    const sync = async () => {
      // The money is refunded already: a failed sync is logged, not returned (the
      // charge.refunded webhook syncs again).
      try {
        await syncOrderRefunds(paymentIntentId)
      } catch (err) {
        log.error('Refund sync failed', {
          requestId,
          orderId,
          paymentIntentId,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    try {
      const refund = await refundPayment(paymentIntentId, amount, idempotencyKey)
      if (refund.lastResponse?.headers?.['idempotent-replayed'] === 'true') {
        log.warn('Refund already processed (idempotent replay)', { requestId, orderId, refundId: refund.id })
        await sync()
        return conflict('Refund already processed')
      }
      log.info('Refund created', {
        requestId,
        refundId: refund.id,
        orderId,
        paymentIntentId,
        amount: refund.amount,
        status: refund.status,
      })
      await sync()
      return withCors(
        success<RefundResponseBody>({
          refundId: refund.id,
          status: refund.status ?? 'unknown',
          amount: refund.amount ?? null,
        }),
        request,
      )
    } catch (err) {
      log.error('Refund failed', {
        requestId,
        orderId,
        paymentIntentId,
        error: err instanceof Error ? err.message : String(err),
      })
      return withCors(
        errorResponse(
          ErrorCode.REFUND_FAILED,
          err instanceof Error ? err.message : 'Refund failed',
          requestId,
          502,
        ),
        request,
      )
    }
  }
}
