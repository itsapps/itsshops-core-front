import type { ShippingMethodResponse } from './checkout-types'

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

  render(methods: ShippingMethodResponse[], selectedId: string | null, formatPrice: (cents: number) => string): void {
    this.container.innerHTML = ''

    for (const method of methods) {
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
