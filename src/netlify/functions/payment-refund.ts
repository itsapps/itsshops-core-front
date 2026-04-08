import type { Context } from '@netlify/functions'
import { refundPayment } from '../services/stripe'
import { ErrorCode } from '../types/errors'
import { log } from '../utils/logger'
import { errorResponse, success, methodNotAllowed, badRequest } from '../utils/response'
import { preflightResponse, requireServerSecret, withCors } from '../utils/server-auth'

// Studio-triggered refund. The dialog calls this from the order document
// action when an admin transitions paymentStatus → refunded / partiallyRefunded.
// Stripe → charge.refunded webhook will subsequently update the order's
// paymentStatus, but the studio also patches the document directly for
// instant feedback. Both paths must be idempotent.
//
// Request body: { paymentIntentId: string, amount?: number }  // amount in cents
// Auth: x-server-secret header (must match SERVER_FUNCTIONS_SECRET)

export type RefundRequestBody = {
  paymentIntentId: string
  amount?: number
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

    if (!body.paymentIntentId || typeof body.paymentIntentId !== 'string') {
      return withCors(badRequest('paymentIntentId is required'), request)
    }
    if (body.amount !== undefined && (typeof body.amount !== 'number' || body.amount <= 0)) {
      return withCors(badRequest('amount must be a positive integer (cents)'), request)
    }

    try {
      const refund = await refundPayment(body.paymentIntentId, body.amount)
      log.info('Refund created', {
        requestId,
        refundId: refund.id,
        paymentIntentId: body.paymentIntentId,
        amount: refund.amount,
        status: refund.status,
      })
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
        paymentIntentId: body.paymentIntentId,
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
