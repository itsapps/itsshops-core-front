import { clearCart } from './cart-store'
import { cloneTemplate, fillSlot } from './template-utils'
import { fillCartItem } from './cart-item-render'
import { createPriceFormatter } from './price'
import { renderTotals } from './order-totals'
import { takeOrderSnapshot, type OrderSnapshot } from './order-snapshot'
import { clearPendingPayment } from './pending-payment'
import { pollOrderNumber } from './order-status'

const STRIPE_PARAMS = ['payment_intent', 'payment_intent_client_secret', 'redirect_status'] as const

/**
 * Read Stripe's return params, then remove them from the address bar so the client secret doesn't
 * linger in the URL, screenshots or shared links. A reload then shows the generic page.
 *
 * redirect_status is user-controllable — it only drives what this visitor sees and clears their own
 * cart. Nothing server-side trusts it (orders are created by the payment webhook).
 */
function readStripeParams(): { status: string | null; paymentIntentId: string | null } {
  const url = new URL(window.location.href)
  const status = url.searchParams.get('redirect_status')
  const paymentIntentId = url.searchParams.get('payment_intent')

  if (STRIPE_PARAMS.some(p => url.searchParams.has(p))) {
    STRIPE_PARAMS.forEach(p => url.searchParams.delete(p))
    history.replaceState(history.state, '', url.pathname + url.search + url.hash)
  }
  return { status, paymentIntentId }
}

function showStatus(root: HTMLElement, status: 'succeeded' | 'processing', email?: string): void {
  root.querySelector<HTMLElement>('[data-order-thanks-status="generic"]')?.setAttribute('hidden', '')
  const el = root.querySelector<HTMLElement>(`[data-order-thanks-status="${status}"]`)
  if (!el) return
  const withEmail = el.dataset.tWithEmail
  if (email && withEmail) el.textContent = withEmail.replace('%email%', () => email)
  el.hidden = false
}

function renderSnapshot(root: HTMLElement, snapshot: OrderSnapshot): void {
  const d = root.dataset
  const format = createPriceFormatter({
    locale: document.documentElement.lang || undefined,
    currency: d.currency || 'EUR',
    currencyLabel: d.currencyLabel || undefined,
  })

  const heading = root.querySelector<HTMLElement>('[data-order-thanks-heading]')
  if (heading && snapshot.firstName && d.tHeadingNamed) {
    heading.textContent = d.tHeadingNamed.replace('%name%', () => snapshot.firstName!)
  }

  const summaryEl = root.querySelector<HTMLElement>('[data-order-thanks-summary]')
  const itemsEl = root.querySelector<HTMLElement>('[data-order-thanks-items]')
  const totalsEl = root.querySelector<HTMLElement>('[data-order-thanks-totals]')
  if (summaryEl && itemsEl && totalsEl) {
    itemsEl.replaceChildren()
    for (const item of snapshot.items) {
      const li = cloneTemplate('order-thanks-item-template')
      if (!li) continue
      fillCartItem(li.querySelector<HTMLElement>('[data-cart-item]') ?? li, item, format)
      itemsEl.appendChild(li)
    }
    renderTotals(totalsEl, snapshot.summary, {
      subtotal: d.tSubtotal ?? 'Subtotal',
      shipping: d.tShipping ?? 'Shipping',
      total: d.tTotal ?? 'Total',
      vat: d.tVat ?? 'VAT',
      vatExempt: d.tVatExempt ?? 'VAT exempt',
      discount: d.tDiscount,
    }, format, 'order-thanks-totals-row-template')
    summaryEl.hidden = false
  }

  const deliveryEl = root.querySelector<HTMLElement>('[data-order-thanks-delivery]')
  if (deliveryEl) {
    const { shippingMethod: method, shippingAddress: address } = snapshot
    if (method) fillSlot(deliveryEl, 'shipping-method', method.title)
    // Pickup: the method title is the whole story — no delivery address.
    if (address && method?.methodType !== 'pickup') {
      const lines = [address.name, address.line1, address.line2, `${address.zip} ${address.city}`, address.country]
      fillSlot(deliveryEl, 'address', lines.filter(Boolean).join('\n'))
    }
    deliveryEl.hidden = !method && !address
  }
}

export function initOrderThanks(): void {
  const root = document.querySelector<HTMLElement>('[data-order-thanks]')
  if (!root) return

  const { status, paymentIntentId } = readStripeParams()

  if (status === 'failed') {
    // Back to checkout; cart and snapshot stay (a retry overwrites the snapshot).
    const checkoutUrl = root.dataset.checkoutUrl
    if (checkoutUrl) window.location.href = checkoutUrl
    return
  }
  if (status !== 'succeeded' && status !== 'processing') return

  // processing (e.g. SEPA): clear too — paying twice is worse than refilling the cart after a
  // later failure.
  clearCart()
  clearPendingPayment()

  const snapshot = paymentIntentId ? takeOrderSnapshot(paymentIntentId) : null
  showStatus(root, status, snapshot?.email)
  root.querySelector<HTMLElement>('[data-order-thanks-next]')?.removeAttribute('hidden')
  if (snapshot) renderSnapshot(root, snapshot)

  // The order (and its number) only exists once the payment webhook ran — and for `processing`
  // not until the payment arrives, so don't ask then.
  if (status === 'succeeded' && paymentIntentId) void showOrderNumber(root, paymentIntentId)
}

/** Fills the live region once the order number exists; on give-up it stays empty (email has it). */
async function showOrderNumber(root: HTMLElement, paymentIntentId: string): Promise<void> {
  const region = root.querySelector<HTMLElement>('[data-order-thanks-number]')
  if (!region) return
  const orderNumber = await pollOrderNumber(paymentIntentId)
  if (!orderNumber) return
  const p = document.createElement('p')
  p.textContent = `${region.dataset.tLabel ?? 'Order number'}: ${orderNumber}`
  region.replaceChildren(p)
}
