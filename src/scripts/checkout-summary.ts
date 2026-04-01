import type { CartItem } from './cart-store'
import type { CalculateResponse, ValidatedCartItemResponse } from './checkout-types'

export type SummaryLabels = {
  subtotal: string
  shipping: string
  total: string
  available: string
}

export class CheckoutSummary {
  private itemsContainer: HTMLElement
  private totalsContainer: HTMLElement
  private locale: string
  private currency: string
  private currencyLabel: string | undefined
  private labels: SummaryLabels

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
    this.labels = labels ?? { subtotal: 'Subtotal', shipping: 'Shipping', total: 'Total', available: 'available' }
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
      const div = document.createElement('div')
      div.className = 'cart-item'

      const subtitle = item.subtitle ? `<span class="cart-item__subtitle">${item.subtitle}</span>` : ''

      div.innerHTML = `
        ${item.imageUrl ? `<img src="${item.imageUrl}" alt="" class="cart-item__image" loading="lazy">` : ''}
        <div class="cart-item__body">
          <span class="cart-item__title">${item.title}</span>
          ${subtitle}
          <div class="cart-item__row">
            <span class="cart-item__qty-count">&times; ${item.quantity}</span>
            <span class="cart-item__price">${this.formatPrice(item.price * item.quantity)}</span>
          </div>
        </div>
      `
      this.itemsContainer.appendChild(div)
    }

    // Render a preliminary subtotal
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
    this.totalsContainer.innerHTML = `
      <div class="checkout-totals__row checkout-totals__row--total">
        <span>${this.labels.subtotal}</span>
        <span>${this.formatPrice(subtotal)}</span>
      </div>
    `
  }

  renderItems(items: ValidatedCartItemResponse[], cartImages: Map<string, string>): void {
    this.itemsContainer.innerHTML = ''

    for (const item of items) {
      const div = document.createElement('div')
      div.className = 'cart-item'

      const imageUrl = cartImages.get(item.variantId) ?? item.imageUrl ?? ''
      const subtitle = item.variantTitle ? `<span class="cart-item__subtitle">${item.variantTitle}</span>` : ''
      const qtyNote = item.requestedQuantity !== item.quantity
        ? `<span class="cart-item__stock-note" aria-live="polite">(${item.quantity} ${this.labels.available})</span>`
        : ''

      div.innerHTML = `
        ${imageUrl ? `<img src="${imageUrl}" alt="" class="cart-item__image" loading="lazy">` : ''}
        <div class="cart-item__body">
          <span class="cart-item__title">${item.title}</span>
          ${subtitle}
          <div class="cart-item__row">
            <span class="cart-item__qty-count">&times; ${item.quantity} ${qtyNote}</span>
            <span class="cart-item__price">${this.formatPrice(item.price * item.quantity)}</span>
          </div>
        </div>
      `
      this.itemsContainer.appendChild(div)
    }
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
          <span>${v.label}</span>
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
