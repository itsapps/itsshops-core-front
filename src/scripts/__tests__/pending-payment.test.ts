// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { lookupOrderStatus } from '../order-status'
import {
  cartSignature,
  savePendingPayment,
  clearPendingPayment,
  reconcilePendingPayment,
  resetPendingPaymentForTests,
} from '../pending-payment'

const CART_KEY = `itsshops_cart_${location.host}`
const MARKER_KEY = `itsshops_pending_payment_${location.host}`
const PI = 'pi_3TRUr5ImdKLyyYu027p4gDQp'
const NOW = 1_000_000_000

const setCart = (items: { id: string; quantity: number }[]) =>
  localStorage.setItem(CART_KEY, JSON.stringify(items.map(i => ({ ...i, title: i.id, price: 100, imageUrl: '', url: '#' }))))
const cart = () => JSON.parse(localStorage.getItem(CART_KEY) || '[]')
const marker = () => localStorage.getItem(MARKER_KEY)
const lookupReturning = (result: Awaited<ReturnType<typeof lookupOrderStatus>>) =>
  vi.fn<typeof lookupOrderStatus>(async () => result)

describe('pending payment', () => {
  beforeEach(() => {
    localStorage.clear()
    resetPendingPaymentForTests()
    setCart([{ id: 'v1', quantity: 2 }, { id: 'v2', quantity: 1 }])
  })

  it('cartSignature ignores line order', () => {
    expect(cartSignature([{ id: 'b', quantity: 1 }, { id: 'a', quantity: 2 }]))
      .toBe(cartSignature([{ id: 'a', quantity: 2 }, { id: 'b', quantity: 1 }]))
  })

  it('stores no personal data', () => {
    savePendingPayment(PI, NOW)
    expect(JSON.parse(marker()!)).toEqual({ paymentIntentId: PI, cartSignature: 'v1:2|v2:1', createdAt: NOW })
  })

  it('paid + unchanged cart → clears the cart and the marker', async () => {
    savePendingPayment(PI, NOW)
    const lookup = lookupReturning({ state: 'found', orderNumber: '000008' })
    await reconcilePendingPayment({ lookup, now: NOW + 1000 })
    expect(lookup).toHaveBeenCalledWith(PI)
    expect(cart()).toEqual([])
    expect(marker()).toBeNull()
  })

  it('paid + cart changed since → keeps the cart, drops the marker', async () => {
    savePendingPayment(PI, NOW)
    setCart([{ id: 'v1', quantity: 2 }, { id: 'v3', quantity: 1 }])
    await reconcilePendingPayment({ lookup: lookupReturning({ state: 'found', orderNumber: '1' }), now: NOW })
    expect(cart()).toHaveLength(2)
    expect(marker()).toBeNull()
  })

  it('no order yet / transient error → keeps everything', async () => {
    for (const state of ['pending', 'error'] as const) {
      resetPendingPaymentForTests()
      savePendingPayment(PI, NOW)
      await reconcilePendingPayment({ lookup: lookupReturning({ state }), now: NOW })
      expect(cart()).toHaveLength(2)
      expect(marker()).not.toBeNull()
    }
  })

  it('endpoint unavailable → drops the marker, keeps the cart', async () => {
    savePendingPayment(PI, NOW)
    await reconcilePendingPayment({ lookup: lookupReturning({ state: 'unavailable' }), now: NOW })
    expect(cart()).toHaveLength(2)
    expect(marker()).toBeNull()
  })

  it('expired marker → dropped without asking', async () => {
    savePendingPayment(PI, NOW)
    const lookup = lookupReturning({ state: 'found', orderNumber: '1' })
    await reconcilePendingPayment({ lookup, now: NOW + 8 * 24 * 60 * 60 * 1000 })
    expect(lookup).not.toHaveBeenCalled()
    expect(marker()).toBeNull()
    expect(cart()).toHaveLength(2)
  })

  it('no marker → no request', async () => {
    const lookup = lookupReturning({ state: 'found', orderNumber: '1' })
    await reconcilePendingPayment({ lookup, now: NOW })
    expect(lookup).not.toHaveBeenCalled()
  })

  it('asks at most once per page load', async () => {
    savePendingPayment(PI, NOW)
    const lookup = lookupReturning({ state: 'pending' })
    await Promise.all([reconcilePendingPayment({ lookup, now: NOW }), reconcilePendingPayment({ lookup, now: NOW })])
    await reconcilePendingPayment({ lookup, now: NOW })
    expect(lookup).toHaveBeenCalledTimes(1)
  })

  it('clearPendingPayment removes the marker', () => {
    savePendingPayment(PI, NOW)
    clearPendingPayment()
    expect(marker()).toBeNull()
  })
})
