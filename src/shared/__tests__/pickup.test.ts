import { describe, expect, it } from 'vitest'

import { isHandedOver, pickupDeadline, wasReadyForPickup } from '../pickup'

const TZ = 'Europe/Vienna'
const shipped = (timestamp: string) => ({ type: 'fulfillment', status: 'shipped', timestamp })
const day = (iso: string) => new Date(`${iso}T12:00:00Z`)

// Same table as core-back `tests/pickup.test.ts`.
describe('pickupDeadline', () => {
  it('latest shipped entry + hold days', () => {
    const history = [
      shipped('2026-11-10T08:00:00Z'),
      { type: 'mail', status: 'orderShipping', timestamp: '2026-11-20T08:00:00Z' },
      shipped('2026-11-18T08:00:00Z'),
    ]
    expect(pickupDeadline(history, 7, TZ)).toEqual(day('2026-11-25'))
  })
  it('counts calendar days in the shop time zone (23:30 UTC is the next Vienna day)', () => {
    expect(pickupDeadline([shipped('2026-11-18T23:30:00Z')], 7, TZ)).toEqual(day('2026-11-26'))
  })
  it('no shipped entry → from now; no hold days → null', () => {
    expect(pickupDeadline([], 7, TZ, new Date('2026-11-18T10:00:00Z'))).toEqual(day('2026-11-25'))
    expect(pickupDeadline([shipped('2026-11-18T08:00:00Z')], undefined, TZ)).toBeNull()
    expect(pickupDeadline(null, 0, TZ)).toBeNull()
  })
})

describe('isHandedOver', () => {
  it('pickup: only delivered (collected)', () => {
    expect(isHandedOver('shipped', 'pickup')).toBe(false)
    expect(isHandedOver('delivered', 'pickup')).toBe(true)
  })
  it('delivery: shipped or delivered', () => {
    expect(isHandedOver('shipped', 'delivery')).toBe(true)
    expect(isHandedOver('shipped', undefined)).toBe(true)
    expect(isHandedOver('processing', 'delivery')).toBe(false)
  })
})

describe('wasReadyForPickup', () => {
  it('needs a fulfillment/shipped entry', () => {
    expect(wasReadyForPickup([shipped('2026-11-18T08:00:00Z')])).toBe(true)
    expect(wasReadyForPickup([{ type: 'mail', status: 'shipped' }])).toBe(false)
    expect(wasReadyForPickup(undefined)).toBe(false)
  })
})
