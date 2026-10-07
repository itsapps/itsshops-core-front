import { clearCart, getCart, type CartItem } from './cart-store'
import { lookupOrderStatus } from './order-status'

/**
 * Pending-payment marker: clears a cart whose payment completed although the customer never reached
 * the order-thanks page (tab closed during 3-D Secure / bank redirect, returned in another browser).
 *
 * Written right before Stripe confirms; removed by the thanks page. While it exists, opening the
 * cart or the checkout asks `order-status` once per page whether that payment became an order —
 * and only then clears the cart, and only if the cart is unchanged since the payment.
 *
 * No personal data: PaymentIntent id + product ids/quantities. localStorage, so it survives the tab.
 */

const STORAGE_KEY = `itsshops_pending_payment_${location.host}`
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

type PendingPayment = { paymentIntentId: string; cartSignature: string; createdAt: number }

/** Order-independent fingerprint of the cart lines. */
export function cartSignature(items: Pick<CartItem, 'id' | 'quantity'>[]): string {
  return items.map(i => `${i.id}:${i.quantity}`).sort().join('|')
}

export function savePendingPayment(paymentIntentId: string | null, now = Date.now()): void {
  if (!paymentIntentId) return
  const marker: PendingPayment = { paymentIntentId, cartSignature: cartSignature(getCart()), createdAt: now }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(marker))
  } catch {
    // Storage blocked — the cart just isn't auto-cleared in the rare no-thanks-page case.
  }
}

export function clearPendingPayment(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch { /* ignore */ }
}

function readPendingPayment(now: number): PendingPayment | null {
  let raw: string | null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const marker = JSON.parse(raw) as PendingPayment
    if (typeof marker?.paymentIntentId === 'string' && now - marker.createdAt < MAX_AGE_MS) return marker
  } catch { /* fall through */ }
  clearPendingPayment()
  return null
}

let inFlight: Promise<void> | null = null

/** Check the marker against `order-status`; at most one request per page load. */
export function reconcilePendingPayment(options: { lookup?: typeof lookupOrderStatus; now?: number } = {}): Promise<void> {
  inFlight ??= reconcile(options.lookup ?? lookupOrderStatus, options.now ?? Date.now())
  return inFlight
}

async function reconcile(lookup: typeof lookupOrderStatus, now: number): Promise<void> {
  const marker = readPendingPayment(now)
  if (!marker) return

  const result = await lookup(marker.paymentIntentId)
  if (result.state === 'found') {
    // Paid. Clear only the cart that was paid for — not one the customer has filled since.
    if (cartSignature(getCart()) === marker.cartSignature) clearCart()
    clearPendingPayment()
  } else if (result.state === 'unavailable') {
    clearPendingPayment()
  }
  // pending / error: keep the marker (payment may still be processing) until it expires.
}

/** Tests only. */
export function resetPendingPaymentForTests(): void {
  inFlight = null
}
