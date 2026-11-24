/**
 * Studio-triggered order notification.
 *
 * Called from the `OrderActions` / `OrderMailAction` document actions in
 * core-back. Thin HTTP wrapper around `sendOrderNotification` that handles
 * auth, CORS, JSON parsing, and ErrorCode → HTTP status mapping.
 *
 * Request body:
 *   { orderId: string, mailType: MailType, attachInvoice?: boolean, refundAmount?: number,
 *     customerMessage?: string }
 *
 * Auth: x-server-secret header (must match SERVER_FUNCTIONS_SECRET).
 */
import type { Context } from '@netlify/functions'

import {
  OrderNotifierError,
  sendOrderNotification,
  type SendOrderNotificationOptions,
} from '../lib/order-notifier'
import { ORDER_SUMMARY_MAIL_TYPES, SIMPLE_MAIL_TYPES, type MailType } from '../types/orderTransitions'

const VALID_MAIL_TYPES = new Set<string>([...ORDER_SUMMARY_MAIL_TYPES, ...SIMPLE_MAIL_TYPES])
import { ErrorCode } from '../types/errors'
import { log } from '../utils/logger'
import { badRequest, errorResponse, methodNotAllowed, success } from '../utils/response'
import { preflightResponse, requireServerSecret, withCors } from '../utils/server-auth'

export type NotifyRequestBody = {
  orderId: string
  mailType: MailType
  attachInvoice?: boolean
  /** Refunded amount in cents — interpolated into the refund emails. */
  refundAmount?: number
  /** Personal message from the shop admin (plain text, max `CUSTOMER_MESSAGE_MAX_LENGTH`). */
  customerMessage?: string
}

/** Upper bound for `customerMessage` — the studio textarea uses the same limit. */
export const CUSTOMER_MESSAGE_MAX_LENGTH = 2000

export type NotifyResponseBody = {
  messageId: string
  to: string
  mailType: MailType
}

export type NotifyHandlerOptions = SendOrderNotificationOptions

export function createNotifyHandler(options: NotifyHandlerOptions = {}) {
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

    let body: NotifyRequestBody
    try {
      body = (await request.json()) as NotifyRequestBody
    } catch {
      return withCors(badRequest('Invalid JSON body'), request)
    }

    if (!body.orderId || typeof body.orderId !== 'string') {
      return withCors(badRequest('orderId is required'), request)
    }
    if (!body.mailType || typeof body.mailType !== 'string') {
      return withCors(badRequest('mailType is required'), request)
    }
    if (!VALID_MAIL_TYPES.has(body.mailType)) {
      return withCors(badRequest(`Invalid mailType: ${body.mailType}`), request)
    }
    if (body.customerMessage !== undefined && typeof body.customerMessage !== 'string') {
      return withCors(badRequest('customerMessage must be a string'), request)
    }
    const customerMessage = body.customerMessage?.trim()
    if (customerMessage && customerMessage.length > CUSTOMER_MESSAGE_MAX_LENGTH) {
      return withCors(
        badRequest(`customerMessage is longer than ${CUSTOMER_MESSAGE_MAX_LENGTH} characters`),
        request,
      )
    }

    try {
      const result = await sendOrderNotification(body.orderId, body.mailType, {
        ...options,
        attachInvoice: body.attachInvoice,
        ...(typeof body.refundAmount === 'number' && { refundAmount: body.refundAmount }),
        ...(customerMessage && { customerMessage }),
      })

      log.debug('Order notification sent', {
        requestId,
        orderId: body.orderId,
        mailType: body.mailType,
        messageId: result.messageId,
      })

      return withCors(success<NotifyResponseBody>(result), request)
    } catch (err) {
      log.error('Order notification failed', {
        requestId,
        orderId: body.orderId,
        mailType: body.mailType,
        error: err instanceof Error ? err.message : String(err),
      })
      if (err instanceof OrderNotifierError) {
        return withCors(errorResponse(err.code, err.message, requestId, err.httpStatus), request)
      }
      return withCors(
        errorResponse(
          ErrorCode.MAIL_FAILED,
          err instanceof Error ? err.message : 'Notification failed',
          requestId,
          502,
        ),
        request,
      )
    }
  }
}
