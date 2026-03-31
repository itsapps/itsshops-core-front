import type { CalculateResponse, ValidatedCartItemResponse } from './checkout-types'

export class CheckoutSummary {
  private itemsContainer: HTMLElement
  private totalsContainer: HTMLElement
  private locale: string
  private currency: string
  private currencyLabel: string | undefined

  constructor(
    itemsContainer: HTMLElement,
    totalsContainer: HTMLElement,
    locale: string,
    currency: string,
    currencyLabel?: string,
  ) {
    this.itemsContainer = itemsContainer
    this.totalsContainer = totalsContainer
    this.locale = locale
    this.currency = currency
    this.currencyLabel = currencyLabel
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

  renderItems(items: ValidatedCartItemResponse[], cartImages: Map<string, string>): void {
    this.itemsContainer.innerHTML = ''

    for (const item of items) {
      const div = document.createElement('div')
      div.className = 'checkout-item'

      const imageUrl = cartImages.get(item.variantId) ?? item.imageUrl ?? ''
      const subtitle = item.variantTitle ? `<span class="checkout-item__subtitle">${item.variantTitle}</span>` : ''
      const qtyNote = item.requestedQuantity !== item.quantity
        ? `<span class="checkout-item__stock-note" aria-live="polite">(${item.quantity} available)</span>`
        : ''

      div.innerHTML = `
        ${imageUrl ? `<img src="${imageUrl}" alt="" class="checkout-item__image" loading="lazy">` : ''}
        <div class="checkout-item__body">
          <span class="checkout-item__title">${item.title}${subtitle}</span>
          <span class="checkout-item__qty">&times; ${item.quantity} ${qtyNote}</span>
        </div>
        <span class="checkout-item__price">${this.formatPrice(item.price * item.quantity)}</span>
      `
      this.itemsContainer.appendChild(div)
    }
  }

  renderTotals(data: CalculateResponse): void {
    const t = data.totals
    const shippingText = t.shipping === 0 ? '—' : this.formatPrice(t.shipping)

    this.totalsContainer.innerHTML = `
      <div class="checkout-totals__row">
        <span data-t="subtotal">Subtotal</span>
        <span>${this.formatPrice(t.subtotal)}</span>
      </div>
      <div class="checkout-totals__row">
        <span data-t="shipping">Shipping</span>
        <span>${shippingText}</span>
      </div>
      ${t.vatBreakdown.map(v => `
        <div class="checkout-totals__row checkout-totals__row--vat">
          <span>${v.label}</span>
          <span>${this.formatPrice(v.vat)}</span>
        </div>
      `).join('')}
      <div class="checkout-totals__row checkout-totals__row--total">
        <span data-t="total">Total</span>
        <span>${this.formatPrice(t.grandTotal)}</span>
      </div>
    `
  }
}
