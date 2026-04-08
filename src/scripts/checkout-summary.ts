import type { CartItem } from './cart-store'
import type { CalculateResponse, ValidatedCartItemResponse } from '../shared/checkout-api'
import { cloneTemplate, fillSlot, fillImageSlot } from './template-utils'

export type SummaryLabels = {
  subtotal: string
  shipping: string
  total: string
  vat: string
  vatExempt: string
  available: string
}

export type SummaryEvents = {
  onQuantityChange: (variantId: string, quantity: number) => void
  onRemove: (variantId: string) => void
}

export class CheckoutSummary {
  private itemsContainer: HTMLElement
  private totalsContainer: HTMLElement
  private locale: string
  private currency: string
  private currencyLabel: string | undefined
  private labels: SummaryLabels
  private events: SummaryEvents | null = null

  constructor(
    itemsContainer: HTMLElement,
    totalsContainer: HTMLElement,
    locale: string,
    currency: string,
    currencyLabel?: string,
    labels?: SummaryLabels,
  ) {
    this.itemsContainer = itemsContainer
    this.totalsContainer = totalsContainer
    this.locale = locale
    this.currency = currency
    this.currencyLabel = currencyLabel
    this.labels = labels ?? {
      subtotal: 'Subtotal',
      shipping: 'Shipping',
      total: 'Total',
      vat: 'VAT',
      vatExempt: 'VAT exempt',
      available: 'available',
    }
  }

  setEvents(events: SummaryEvents): void {
    this.events = events
  }

  formatPrice(cents: number): string {
    if (this.currencyLabel) {
      const n = new Intl.NumberFormat(this.locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(cents / 100)
      return `${n} ${this.currencyLabel}`
    }
    return new Intl.NumberFormat(this.locale, {
      style: 'currency',
      currency: this.currency,
    }).format(cents / 100)
  }

  renderCartItems(cart: CartItem[]): void {
    this.itemsContainer.innerHTML = ''

    for (const item of cart) {
      const el = cloneTemplate('checkout-item-template')
      if (!el) continue

      el.dataset.cartItemId = item.id

      fillImageSlot(el, 'image', item.imageUrl)
      fillSlot(el, 'title', item.title)
      if (item.subtitle) fillSlot(el, 'subtitle', item.subtitle)
      fillSlot(el, 'price', this.formatPrice(item.price * item.quantity))

      const qtyValue = el.querySelector<HTMLElement>('[data-qty-value]')
      if (qtyValue) qtyValue.textContent = String(item.quantity)

      this.bindItemEvents(el, item.id, item.quantity, item.price)
      this.itemsContainer.appendChild(el)
    }

    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
    this.totalsContainer.innerHTML = `
      <div class="checkout-totals__row checkout-totals__row--total">
        <span>${this.labels.subtotal}</span>
        <span>${this.formatPrice(subtotal)}</span>
      </div>
    `
  }

  renderItems(items: ValidatedCartItemResponse[], localCart: Map<string, CartItem>): void {
    this.itemsContainer.innerHTML = ''

    for (const item of items) {
      const el = cloneTemplate('checkout-item-template')
      if (!el) continue

      el.dataset.cartItemId = item.variantId

      // Prefer the local cart's display strings (consistent with product page + cart sidebar).
      // Fall back to the server's split title/variantTitle only if the local entry is missing.
      const local = localCart.get(item.variantId)
      const title = local?.title ?? item.title
      const subtitle = local?.subtitle ?? item.variantTitle ?? undefined
      const imageUrl = local?.imageUrl ?? item.imageUrl ?? ''

      fillImageSlot(el, 'image', imageUrl)
      fillSlot(el, 'title', title)
      if (subtitle) fillSlot(el, 'subtitle', subtitle)
      fillSlot(el, 'price', this.formatPrice(item.price * item.quantity))

      const qtyValue = el.querySelector<HTMLElement>('[data-qty-value]')
      if (qtyValue) qtyValue.textContent = String(item.quantity)

      if (item.requestedQuantity !== item.quantity) {
        fillSlot(el, 'stock-note', `(${item.quantity} ${this.labels.available})`)
      }

      this.bindItemEvents(el, item.variantId, item.quantity, item.price)
      this.itemsContainer.appendChild(el)
    }
  }

  private bindItemEvents(el: HTMLElement, variantId: string, quantity: number, unitPrice: number): void {
    let qty = quantity

    const qtyValue = el.querySelector<HTMLElement>('[data-qty-value]')
    const priceEl = el.querySelector<HTMLElement>('[data-slot="price"]')

    const updateDisplay = () => {
      if (qtyValue) qtyValue.textContent = String(qty)
      if (priceEl) priceEl.textContent = this.formatPrice(unitPrice * qty)
    }

    el.querySelector('[data-qty-decrease]')?.addEventListener('click', () => {
      if (qty <= 1) return
      qty--
      updateDisplay()
      this.events?.onQuantityChange(variantId, qty)
    })

    el.querySelector('[data-qty-increase]')?.addEventListener('click', () => {
      qty++
      updateDisplay()
      this.events?.onQuantityChange(variantId, qty)
    })

    el.querySelector('[data-cart-remove]')?.addEventListener('click', () => {
      el.remove()
      this.events?.onRemove(variantId)
    })
  }

  renderTotals(data: CalculateResponse): void {
    const totals = data.totals
    const shippingText = totals.shipping === 0 ? '—' : this.formatPrice(totals.shipping)

    this.totalsContainer.innerHTML = `
      <div class="checkout-totals__row">
        <span>${this.labels.subtotal}</span>
        <span>${this.formatPrice(totals.subtotal)}</span>
      </div>
      <div class="checkout-totals__row">
        <span>${this.labels.shipping}</span>
        <span>${shippingText}</span>
      </div>
      ${totals.vatBreakdown.map(v => `
        <div class="checkout-totals__row checkout-totals__row--vat">
          <span>${v.rate > 0 ? `${v.rate}% ${this.labels.vat}` : this.labels.vatExempt}</span>
          <span>${this.formatPrice(v.vat)}</span>
        </div>
      `).join('')}
      <div class="checkout-totals__row checkout-totals__row--total">
        <span>${this.labels.total}</span>
        <span>${this.formatPrice(totals.grandTotal)}</span>
      </div>
    `
  }
}
