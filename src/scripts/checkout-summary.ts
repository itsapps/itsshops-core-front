import type { CartItem } from './cart-store'
import type { CalculateResponse, ValidatedCartItemResponse } from '../shared/checkout-api'
import { cloneTemplate, fillSlot } from './template-utils'
import { fillCartItem } from './cart-item-render'
import { createPriceFormatter } from './price'
import { renderSubtotal, renderTotals, type TotalsLabels } from './order-totals'

const ITEM_TEMPLATE = 'checkout-item-template'
const TOTALS_ROW_TEMPLATE = 'checkout-totals-row-template'

export type SummaryLabels = TotalsLabels & {
  available: string
}

export type SummaryEvents = {
  onQuantityChange: (variantId: string, quantity: number) => void
  onRemove: (variantId: string) => void
}

export class CheckoutSummary {
  private itemsContainer: HTMLElement
  private totalsContainer: HTMLElement
  private format: (cents: number) => string
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
    this.format = createPriceFormatter({ locale, currency, currencyLabel })
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
    return this.format(cents)
  }

  renderCartItems(cart: CartItem[]): void {
    this.itemsContainer.innerHTML = ''

    for (const item of cart) {
      const el = cloneTemplate(ITEM_TEMPLATE)
      if (!el) continue

      el.dataset.cartItemId = item.id
      fillCartItem(el, item, this.format)

      this.bindItemEvents(el, item.id, item.quantity, item.price)
      this.itemsContainer.appendChild(el)
    }

    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
    renderSubtotal(this.totalsContainer, subtotal, this.labels, this.format, TOTALS_ROW_TEMPLATE)
  }

  renderItems(items: ValidatedCartItemResponse[], localCart: Map<string, CartItem>): void {
    this.itemsContainer.innerHTML = ''

    for (const item of items) {
      const el = cloneTemplate(ITEM_TEMPLATE)
      if (!el) continue

      el.dataset.cartItemId = item.variantId

      // Prefer the local cart's display strings (consistent with product page + cart sidebar).
      // Fall back to the server's title/subtitle only if the local entry is missing.
      const local = localCart.get(item.variantId)
      fillCartItem(el, {
        title: local?.title ?? item.title,
        subtitle: local?.subtitle ?? item.subtitle ?? undefined,
        imageUrl: local?.imageUrl ?? item.imageUrl ?? '',
        url: local?.url ?? '#',
        price: item.price,
        quantity: item.quantity,
      }, this.format)

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
      if (priceEl) priceEl.textContent = this.format(unitPrice * qty)
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
    renderTotals(this.totalsContainer, data, this.labels, this.format, TOTALS_ROW_TEMPLATE)
  }
}
