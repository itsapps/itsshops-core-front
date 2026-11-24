// Which translation keys a mail uses — the pickup variants (`emails.pickup.*`) and the extra
// pickup lines. Shared by the templates (`OrderEmail`), `subjectFor` and the plain-text part in
// `order-notifier.tsx`, so HTML and text say the same.
import type { OrderDocument } from '../../types/checkout'
import type { MailType } from '../../types/orderTransitions'
import { formatShopDate, shopTimeZone } from '../../utils/i18n'
import { pickupDeadline, wasReadyForPickup } from '../../../shared/pickup'
import type { EmailContext } from './types'
import { trackingCodes } from '../../lib/tracking'

/** Mail types/parts with their own text for pickup orders (`emails.pickup.<mailType>.<part>`). */
const PICKUP_MAIL_KEYS: Partial<Record<MailType, readonly string[]>> = {
  orderConfirmation: ['text'],
  orderProcessing: ['text'],
  orderShipping: ['subject', 'preview', 'text'],
  orderDelivered: ['subject', 'preview', 'text'],
  orderCanceled: ['text'],
}

export type MailKeyOrder = Pick<OrderDocument, 'fulfillment'> & Partial<Pick<OrderDocument, 'statusHistory'>>

/**
 * Translation key of a mail part: the pickup variant for a pickup order where one exists (a
 * static list — `serverT` returns the key itself on a miss, so "if it exists" can't be asked),
 * else `emails.<mailType>.<part>`. Confirmation/processing text: `textReadyLater` ("we'll let you
 * know when it's ready") when the method announces the ready mail (`pickupAnnounceReady`: the
 * shop prepares the order first); otherwise the goods can be collected right away. Cancel mail: the
 * "not collected" text only after the order was "ready for pickup"; cancelled before that it is
 * the generic text.
 */
export function mailKey(mailType: MailType, order: MailKeyOrder | undefined, part: string): string {
  const generic = `emails.${mailType}.${part}`
  const f = order?.fulfillment
  if (f?.methodType !== 'pickup' || !PICKUP_MAIL_KEYS[mailType]?.includes(part)) return generic
  if (mailType === 'orderCanceled') {
    if (!wasReadyForPickup(order?.statusHistory)) return generic
    return f.pickupHoldDays
      ? 'emails.pickup.orderCanceled.textNotCollected'
      : 'emails.pickup.orderCanceled.textNotCollectedNoPeriod'
  }
  if ((mailType === 'orderConfirmation' || mailType === 'orderProcessing') && part === 'text' && f.pickupAnnounceReady) {
    return `emails.pickup.${mailType}.textReadyLater`
  }
  return `emails.pickup.${mailType}.${part}`
}

/**
 * Extra lines after the main text of a pickup order's mail (HTML body and plain text alike):
 * the hold period in the confirmation, the deadline in the "ready for pickup" mail. None
 * without `pickupHoldDays` or for delivery.
 */
export function pickupExtraLines(
  ctx: Pick<EmailContext, 't' | 'locale'>,
  mailType: MailType,
  order: MailKeyOrder,
): string[] {
  const f = order.fulfillment
  if (f?.methodType !== 'pickup' || !f.pickupHoldDays) return []
  if (mailType === 'orderConfirmation') {
    return [ctx.t('emails.pickup.holdPeriod', { days: f.pickupHoldDays })]
  }
  if (mailType === 'orderShipping') {
    const deadline = pickupDeadline(order.statusHistory, f.pickupHoldDays, shopTimeZone())
    if (!deadline) return []
    return [ctx.t('emails.pickup.deadline', { date: formatShopDate(deadline, ctx.locale, { dateStyle: 'full' }) })]
  }
  return []
}

/**
 * Extra line after the main text of the shipping mail of a delivery order with a tracking number
 * ("you can follow your parcel with the tracking number"). HTML body and plain text alike.
 */
export function trackingExtraLines(
  ctx: Pick<EmailContext, 't'>,
  mailType: MailType,
  order: MailKeyOrder,
): string[] {
  const f = order.fulfillment
  if (mailType !== 'orderShipping' || f?.methodType === 'pickup') return []
  const count = trackingCodes(f?.trackingCode).length
  if (!count) return []
  return [ctx.t(count > 1 ? 'emails.orderShipping.trackingHintMany' : 'emails.orderShipping.trackingHint')]
}
