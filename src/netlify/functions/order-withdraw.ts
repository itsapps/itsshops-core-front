import type { Context } from '@netlify/functions'
import { log } from '../utils/logger'
import { success, validationError, errorResponse, methodNotAllowed, badRequest } from '../utils/response'
import { ErrorCode } from '../types/errors'
import { verifyCaptcha } from '../utils/captcha'
import { validateEmail } from '../../shared/validation'
import { serverT } from '../utils/i18n'
import { fetchOrderByNumber, findOpenWithdrawal, createOrderWithdrawal } from '../services/sanity'
import { sendWithdrawalNotifications } from '../lib/order-withdraw-notifier'
import type { WithdrawInput, WithdrawResult } from '../../shared/order-api'

export type OrderWithdrawConfig = {
  /** Set to false to skip captcha (dev/test). Defaults to true. */
  captcha?: boolean
  /** Recipient of the shop-facing declaration mail. Defaults to the sender address. */
  notifyEmail?: string
  /** Public base URL of the shop (defaults to process.env.URL). */
  baseUrl?: string
}

/**
 * Right-of-withdrawal ("Widerruf") endpoint. A visitor declares withdrawal with
 * order number + email; on a match we record an `orderWithdrawal` document and
 * send the customer receipt confirmation + a shop notification. Declaration-only
 * — no automatic cancel/refund.
 */
export function createOrderWithdrawHandler(config: OrderWithdrawConfig = {}) {
  const { captcha: captchaEnabled = true, notifyEmail, baseUrl } = config

  return async (request: Request, _context: Context): Promise<Response> => {
    if (request.method !== 'POST') return methodNotAllowed()

    const locale = request.headers.get('x-locale') ?? 'de'
    const t = (key: string) => serverT(locale, key)

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return badRequest('Invalid JSON body')
    }

    const { orderNumber, email, reason, captchaToken } = body as WithdrawInput

    if (!orderNumber || !email) return badRequest('orderNumber and email are required')

    if (!validateEmail(email)) {
      return validationError(ErrorCode.INVALID_INPUT, t('api.errors.validation.message'), undefined, {
        email: t('api.errors.validation.email'),
      })
    }

    if (captchaEnabled) {
      if (!captchaToken) return badRequest('captchaToken is required')
      const captchaValid = await verifyCaptcha(captchaToken)
      if (!captchaValid) {
        return errorResponse(ErrorCode.AUTH_CAPTCHA_FAILED, t('api.errors.auth.captchaFailed'), undefined, 401)
      }
    }

    const order = await fetchOrderByNumber(orderNumber.trim())
    const emailMatches =
      !!order && order.customer.contactEmail?.toLowerCase() === email.trim().toLowerCase()
    if (!order || !emailMatches) {
      // Combined error — does not reveal which of orderNumber/email was wrong.
      return validationError(ErrorCode.INVALID_INPUT, t('api.errors.order.notFound'), undefined, {
        orderNumber: t('api.errors.order.notFound'),
      })
    }

    const successResp = success<WithdrawResult>({
      redirectUrl: `/${locale}/${t('urlPaths.orderWithdrawSuccess')}/`,
    })

    // Per-order dedupe / throttle: an open withdrawal already exists → silent no-op
    // (no duplicate record, no re-sent acknowledgment).
    const existing = await findOpenWithdrawal(order._id)
    if (existing) return successResp

    const declaredAt = new Date().toISOString()
    try {
      await createOrderWithdrawal({ orderId: order._id, reason })
    } catch (err) {
      log.error('order-withdraw: create failed', {
        error: err instanceof Error ? err.message : String(err),
      })
      return errorResponse(ErrorCode.INTERNAL_ERROR, t('api.errors.order.withdrawFailed'))
    }

    if (process.env.SKIP_AUTH_EMAILS !== 'true') {
      try {
        await sendWithdrawalNotifications(order, reason, declaredAt, { notifyEmail, baseUrl })
      } catch (err) {
        // The record is persisted; an email failure must not fail the request.
        log.error('order-withdraw: notify failed', {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    return successResp
  }
}
