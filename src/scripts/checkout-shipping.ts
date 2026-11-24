import type { ShippingMethodResponse } from '../shared/checkout-api'

export class CheckoutShipping {
  private container: HTMLElement
  private onSelect: ((methodId: string) => void) | null = null

  constructor(container: HTMLElement) {
    this.container = container
  }

  setOnSelect(fn: (methodId: string) => void): void {
    this.onSelect = fn
  }

  getSelectedId(): string | undefined {
    const checked = this.container.querySelector<HTMLInputElement>('input[name="shippingMethod"]:checked')
    return checked?.value
  }

  /**
   * Render the delivery methods (pickup methods are offered by `CheckoutFulfillment`). None for
   * the address country → `emptyText` ("Versand in dieses Land ist nicht möglich.").
   */
  render(methods: ShippingMethodResponse[], selectedId: string | null, formatPrice: (cents: number) => string, emptyText?: string): void {
    this.container.innerHTML = ''
    const delivery = methods.filter(m => m.methodType === 'delivery')
    if (delivery.length === 0 && emptyText) {
      const p = document.createElement('p')
      p.className = 'checkout-shipping__empty'
      p.textContent = emptyText
      this.container.appendChild(p)
      return
    }

    for (const method of delivery) {
      const isSelected = method._id === selectedId
      const label = document.createElement('label')
      label.className = `checkout-shipping__option${isSelected ? ' is-selected' : ''}`

      const radio = document.createElement('input')
      radio.type = 'radio'
      radio.name = 'shippingMethod'
      radio.value = method._id
      radio.checked = isSelected
      radio.addEventListener('change', () => {
        this.container.querySelectorAll('.checkout-shipping__option').forEach(el => {
          el.classList.remove('is-selected')
        })
        label.classList.add('is-selected')
        this.onSelect?.(method._id)
      })

      const titleSpan = document.createElement('span')
      titleSpan.className = 'checkout-shipping__title'
      titleSpan.textContent = method.title

      const priceSpan = document.createElement('span')
      priceSpan.className = 'checkout-shipping__price'
      priceSpan.textContent = method.isFree ? '—' : formatPrice(method.price)

      label.appendChild(radio)
      label.appendChild(titleSpan)
      label.appendChild(priceSpan)
      this.container.appendChild(label)
    }
  }
}
