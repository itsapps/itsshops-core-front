import type { Context } from '@netlify/functions'
import { createHash } from 'node:crypto'
import { log } from '../utils/logger'
import { success, validationError, errorResponse, methodNotAllowed, badRequest } from '../utils/response'
import { ErrorCode } from '../types/errors'
import { checkWithdrawText, validateEmail, WITHDRAW_REASON_MAX } from '../../shared/validation'
import { serverT } from '../utils/i18n'
import {
  fetchOrderByNumber,
  findOpenWithdrawal,
  findOpenUnmatchedWithdrawal,
  createWithdrawalIfNotExists,
  countWithdrawalIds,
  type WithdrawalRecord,
} from '../services/sanity'
import { sendWithdrawalNotifications, type WithdrawNotifyOptions } from '../lib/order-withdraw-notifier'
import type { WithdrawInput, WithdrawResult } from '../../shared/order-api'

export type OrderWithdrawConfig = {
  /** Public base URL of the shop (defaults to process.env.URL). */
  baseUrl?: string
}

/**
 * Deterministic id for a new web declaration: `withdrawal-<key>-<n>`, where `key` is the order
 * id (matched) or a hash of the normalized email + order number (unmatched), and `n` counts the
 * earlier web records with that key. Two quick submits compute the same id, so
 * `createIfNotExists` stores one record; after a record is closed, `n` moves on.
 */
async function withdrawalId(orderId: string | null, email: string, orderNumber: string): Promise<string> {
  const key = orderId
    ? orderId.replace(/[^A-Za-z0-9_-]/g, '')
    : `u-${createHash('sha256').update(`${email}\n${orderNumber}`).digest('hex').slice(0, 20)}`
  const prefix = `withdrawal-${key}-`
  return `${prefix}${await countWithdrawalIds(prefix)}`
}

/**
 * Right-of-withdrawal ("Widerruf", FAGG §13a) endpoint. Declaration-only — no automatic
 * cancel/refund. A declaration is never lost: every valid submission is stored and confirmed.
 *
 * - Order number + email match an order → record linked to it (`received`).
 * - No match (unknown number, or the email differs) → record `unmatched`, no order; the shop
 *   notification is flagged (+ "email differs" hint when the number exists). Editors assign or
 *   delete it in the Studio.
 * - Same response in both cases, so order numbers can't be probed.
 * - Repeat submission (an open record for that order / that email + number exists) → the
 *   receipt is sent again for the stored record; no second record, no second shop mail.
 * - Honeypot (`website`) filled → the same success response, nothing stored or sent.
 *
 * No captcha (the function must be easy to use) — the shop's wrapper sets Netlify's per-IP
 * `rateLimit`. Every mail reads the stored record, so date/time are those of the record.
 */
export function createOrderWithdrawHandler(config: OrderWithdrawConfig = {}) {
  const { baseUrl } = config

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
    const input = (body ?? {}) as Partial<WithdrawInput>

    const successResp = () => success<WithdrawResult>({
      redirectUrl: `/${locale}/${t('urlPaths.orderWithdrawSuccess')}/`,
    })

    // Honeypot: bots fill every field. Same response as a real submission.
    if (typeof input.website === 'string' && input.website.trim()) {
      log.info('order-withdraw: honeypot filled, ignored')
      return successResp()
    }

    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
    const name = str(input.name)
    const orderNumber = str(input.orderNumber)
    const email = str(input.email).toLowerCase()
    const reason = str(input.reason).slice(0, WITHDRAW_REASON_MAX) || undefined

    const nameCheck = checkWithdrawText(name)
    const numberCheck = checkWithdrawText(orderNumber)
    const emailInvalid = !email || !validateEmail(email)
    if (nameCheck || numberCheck || emailInvalid) {
      const textError = (check: 'empty' | 'invalid', emptyKey: string) =>
        t(check === 'empty' ? emptyKey : 'api.errors.validation.noLinks')
      return validationError(ErrorCode.INVALID_INPUT, t('api.errors.validation.message'), undefined, {
        ...(nameCheck && { name: textError(nameCheck, 'api.errors.validation.name') }),
        ...(numberCheck && { orderNumber: textError(numberCheck, 'api.errors.validation.orderNumber') }),
        ...(emailInvalid && { email: t('api.errors.validation.email') }),
      })
    }

    let record: WithdrawalRecord
    let isNew: boolean
    let emailMismatch = false
    try {
      const order = await fetchOrderByNumber(orderNumber)
      const matched = !!order && order.customer.contactEmail?.trim().toLowerCase() === email
      emailMismatch = !!order && !matched

      const existing = matched
        ? await findOpenWithdrawal(order._id)
        : await findOpenUnmatchedWithdrawal(email, orderNumber)

      if (existing) {
        record = existing
        isNew = false
      } else {
        const orderId = matched ? order._id : null
        const created = await createWithdrawalIfNotExists({
          _id: await withdrawalId(orderId, email, orderNumber),
          orderId,
          declaredAt: new Date().toISOString(),
          name,
          email,
          orderNumber,
          locale,
          reason,
        })
        record = created.record
        isNew = created.created
      }
    } catch (err) {
      log.error('order-withdraw: store failed', {
        error: err instanceof Error ? err.message : String(err),
      })
      return errorResponse(ErrorCode.INTERNAL_ERROR, t('api.errors.order.withdrawFailed'))
    }

    if (process.env.SKIP_AUTH_EMAILS !== 'true') {
      const options: WithdrawNotifyOptions = {
        baseUrl,
        // Repeat submission: receipt again, the shop already knows.
        audience: isNew ? 'both' : 'customer',
        emailMismatch,
      }
      try {
        await sendWithdrawalNotifications(record, options)
      } catch (err) {
        // The record is persisted; an email failure must not fail the request.
        log.error('order-withdraw: notify failed', {
          withdrawalId: record._id,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    return successResp()
  }
}
