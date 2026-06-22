/**
 * Studio-triggered (re)send of the customer withdrawal confirmation email.
 *
 * Called from the withdrawal document actions in core-back — when an admin logs
 * a withdrawal manually (with "notify customer" checked) or resends after a
 * delivery failure. Sends the customer-facing mail only (the shop already knows).
 *
 * Request body: { withdrawalId: string }
 * Auth: x-server-secret header (must match SERVER_FUNCTIONS_SECRET).
 */
import type { Context } from '@netlify/functions'

import { fetchWithdrawalForNotify } from '../services/sanity'
import { sendWithdrawalNotifications } from '../lib/order-withdraw-notifier'
import { ErrorCode } from '../types/errors'
import { log } from '../utils/logger'
import { badRequest, errorResponse, methodNotAllowed, success } from '../utils/response'
import { preflightResponse, requireServerSecret, withCors } from '../utils/server-auth'

export type WithdrawNotifyRequestBody = {
  withdrawalId: string
}

export type WithdrawNotifyResponseBody = {
  to: string
}

export type WithdrawNotifyHandlerOptions = {
  /** Public base URL of the shop (defaults to process.env.URL). */
  baseUrl?: string
}

export function createWithdrawNotifyHandler(options: WithdrawNotifyHandlerOptions = {}) {
  return async (request: Request, _context: Context): Promise<Response> => {
    if (request.method === 'OPTIONS') return preflightResponse(request)
    if (request.method !== 'POST') return withCors(methodNotAllowed(), request)

    const authError = requireServerSecret(request)
    if (authError) return authError

    const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()

    let body: WithdrawNotifyRequestBody
    try {
      body = (await request.json()) as WithdrawNotifyRequestBody
    } catch {
      return withCors(badRequest('Invalid JSON body'), request)
    }
    if (!body.withdrawalId || typeof body.withdrawalId !== 'string') {
      return withCors(badRequest('withdrawalId is required'), request)
    }

    try {
      const record = await fetchWithdrawalForNotify(body.withdrawalId)
      if (!record) {
        return withCors(
          errorResponse(ErrorCode.ORDER_NOT_FOUND, 'Withdrawal not found', requestId, 404),
          request,
        )
      }

      const result = await sendWithdrawalNotifications(
        record.order,
        record.reason,
        record.declaredAt,
        { audience: 'customer', baseUrl: options.baseUrl },
      )

      log.debug('Withdrawal confirmation sent', {
        requestId,
        withdrawalId: body.withdrawalId,
        to: result.to,
      })

      return withCors(success<WithdrawNotifyResponseBody>(result), request)
    } catch (err) {
      log.error('Withdrawal notification failed', {
        requestId,
        withdrawalId: body.withdrawalId,
        error: err instanceof Error ? err.message : String(err),
      })
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
