// Pickup ("click & collect") rules shared by the mails, the withdrawal receipt and the refund
// webhook. Browser-safe (no `process.env`): the time zone is a parameter. core-back has the same
// `pickupDeadline` (`src/utils/pickup.ts`, same test table); the packages share no code.

export type PickupMethodType = 'delivery' | 'pickup'

export type PickupHistoryEntry = { type?: string; status?: string; timestamp?: string }

/**
 * Whether the goods are with the customer. A pickup order reuses the fulfillment states with
 * other labels — `shipped` = "ready for pickup" (goods still at the shop), `delivered` =
 * "collected" — so only `delivered` counts for pickup.
 */
export const isHandedOver = (status: string | undefined, methodType?: PickupMethodType | null): boolean =>
  methodType === 'pickup'
    ? status === 'delivered'
    : status === 'shipped' || status === 'delivered'

/** Y-M-D of `date` in `timeZone`. */
function calendarDate(date: Date, timeZone: string): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value)
  return { y: get('year'), m: get('month'), d: get('day') }
}

/**
 * Last day to collect a pickup order: the calendar date (in `timeZone`) of the latest
 * `fulfillment`/`shipped` ("ready for pickup") history entry + `holdDays`. Without such an
 * entry the count starts at `now` (the ready mail of a status change that isn't stored yet).
 * `null` without `holdDays`. Returned as 12:00 UTC of that date, so formatting it in the shop's
 * time zone gives the same calendar day.
 */
export function pickupDeadline(
  statusHistory: PickupHistoryEntry[] | null | undefined,
  holdDays: number | null | undefined,
  timeZone: string,
  now: Date = new Date(),
): Date | null {
  if (!holdDays) return null
  const readyAt = (statusHistory ?? [])
    .filter(e => e.type === 'fulfillment' && e.status === 'shipped' && e.timestamp)
    .map(e => e.timestamp as string)
    .sort()
    .pop()
  const { y, m, d } = calendarDate(readyAt ? new Date(readyAt) : now, timeZone)
  return new Date(Date.UTC(y, m - 1, d + holdDays, 12))
}

/** Whether the order has been "ready for pickup" (a `fulfillment`/`shipped` history entry). */
export const wasReadyForPickup = (statusHistory: PickupHistoryEntry[] | null | undefined): boolean =>
  (statusHistory ?? []).some(e => e.type === 'fulfillment' && e.status === 'shipped')
