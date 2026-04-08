/**
 * Studio-triggered order notification.
 *
 * Called from the `OrderActions` / `OrderMailAction` document actions in
 * core-back. Thin HTTP wrapper around `sendOrderNotification` that handles
 * auth, CORS, JSON parsing, and ErrorCode → HTTP status mapping.
 *
 * Request body:
 *   { orderId: string, mailType: MailType, attachInvoice?: boolean }
 *
 * Auth: x-server-secret header (must match SERVER_FUNCTIONS_SECRET).
 */
import type { Context } from '@netlify/functions'

import {
  OrderNotifierError,
  sendOrderNotification,
  type SendOrderNotificationOptions,
} from '../lib/order-notifier'
import type { MailType } from '../types/orderTransitions'
import { ErrorCode } from '../types/errors'
import { log } from '../utils/logger'
import { badRequest, errorResponse, methodNotAllowed, success } from '../utils/response'
import { preflightResponse, requireServerSecret, withCors } from '../utils/server-auth'

export type NotifyRequestBody = {
  orderId: string
  mailType: MailType
  attachInvoice?: boolean
}

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

    try {
      const result = await sendOrderNotification(body.orderId, body.mailType, {
        ...options,
        attachInvoice: body.attachInvoice,
      })

      log.info('Order notification sent', {
        requestId,
        orderId: body.orderId,
        mailType: body.mailType,
        to: result.to,
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
