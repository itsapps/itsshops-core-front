import type { ShippingMethodResponse } from '../shared/checkout-api'

/**
 * "Delivery or pickup" choice (`[data-checkout-fulfillment]`): a "Versand" radio plus one per
 * pickup method of the latest calculation. The fieldset stays `hidden` while the calculation has
 * no pickup method. The pickup details (address, instructions, ready time, hold period) render
 * into `[data-checkout-pickup-details]`, which each pickup radio references via
 * `aria-describedby`. Contract: `.claude/architecture/ui-contracts.md` → "Fulfillment choice".
 */
export type FulfillmentLabels = {
  delivery: string
  free: string
  /** "Abholbereit in: {time}" */
  readyIn: string
  /** "… {days} Tage …" */
  holdPeriod: string
}

const DELIVERY_VALUE = 'delivery'

export class CheckoutFulfillment {
  private fieldset: HTMLElement
  private options: HTMLElement
  private details: HTMLElement | null
  private labels: FulfillmentLabels
  private onChange: ((pickupId: string | undefined) => void) | null = null
  private pickups: ShippingMethodResponse[] = []

  constructor(fieldset: HTMLElement, labels: FulfillmentLabels) {
    this.fieldset = fieldset
    this.options = fieldset.querySelector<HTMLElement>('[data-checkout-fulfillment-options]') ?? fieldset
    this.details = fieldset.querySelector<HTMLElement>('[data-checkout-pickup-details]')
    this.labels = labels
  }

  setOnChange(fn: (pickupId: string | undefined) => void): void {
    this.onChange = fn
  }

  /** The chosen pickup method's id, or `undefined` for delivery (or no choice shown). */
  getPickupId(): string | undefined {
    if (this.fieldset.hidden) return undefined
    const checked = this.options.querySelector<HTMLInputElement>('input[name="fulfillment"]:checked')
    return checked && checked.value !== DELIVERY_VALUE ? checked.value : undefined
  }

  getPickup(): ShippingMethodResponse | undefined {
    const id = this.getPickupId()
    return id ? this.pickups.find(m => m._id === id) : undefined
  }

  hasPickups(): boolean {
    return this.pickups.length > 0
  }

  /** Check a radio without firing `onChange` (`undefined` = delivery). */
  select(pickupId: string | undefined): void {
    const value = pickupId ?? DELIVERY_VALUE
    for (const radio of Array.from(this.options.querySelectorAll<HTMLInputElement>('input[name="fulfillment"]'))) {
      radio.checked = radio.value === value
      radio.closest('label')?.classList.toggle('is-selected', radio.checked)
    }
    this.renderDetails()
  }

  /**
   * Render the choice for the calculation's pickup methods, keeping `selectedPickupId` checked
   * if it is still offered (a pickup that disappeared falls back to delivery).
   */
  render(methods: ShippingMethodResponse[], selectedPickupId: string | undefined, formatPrice: (cents: number) => string): void {
    this.pickups = methods.filter(m => m.methodType === 'pickup')
    this.options.replaceChildren()
    this.fieldset.hidden = this.pickups.length === 0
    if (this.pickups.length === 0) {
      this.renderDetails()
      return
    }
    const selected = this.pickups.some(m => m._id === selectedPickupId) ? selectedPickupId : undefined

    this.options.appendChild(this.option(DELIVERY_VALUE, this.labels.delivery, null, !selected))
    for (const m of this.pickups) {
      const price = m.isFree ? this.labels.free : formatPrice(m.price)
      this.options.appendChild(this.option(m._id, m.title, price, m._id === selected))
    }
    this.renderDetails()
  }

  private option(value: string, title: string, price: string | null, checked: boolean): HTMLLabelElement {
    const label = document.createElement('label')
    label.className = `checkout-shipping__option${checked ? ' is-selected' : ''}`

    const radio = document.createElement('input')
    radio.type = 'radio'
    radio.name = 'fulfillment'
    radio.value = value
    radio.checked = checked
    if (value !== DELIVERY_VALUE && this.details?.id) radio.setAttribute('aria-describedby', this.details.id)
    radio.addEventListener('change', () => {
      this.select(value === DELIVERY_VALUE ? undefined : value)
      this.onChange?.(this.getPickupId())
    })

    const titleSpan = document.createElement('span')
    titleSpan.className = 'checkout-shipping__title'
    titleSpan.textContent = title
    label.append(radio, titleSpan)
    if (price) {
      const priceSpan = document.createElement('span')
      priceSpan.className = 'checkout-shipping__price'
      priceSpan.textContent = price
      label.appendChild(priceSpan)
    }
    return label
  }

  /** Address, instructions, ready time and hold period of the chosen pickup (textContent only). */
  private renderDetails(): void {
    if (!this.details) return
    const m = this.getPickup()
    this.details.replaceChildren()
    this.details.hidden = !m
    if (!m) return
    const line = (text: string, tag: 'p' | 'address' = 'p') => {
      const el = document.createElement(tag)
      el.textContent = text
      this.details!.appendChild(el)
    }
    const a = m.pickupAddress
    if (a) {
      const country = countryName(a.country)
      line([a.line1, a.line2, `${a.zip} ${a.city}`, country].filter(Boolean).join('\n'), 'address')
    }
    if (m.pickupInstructions) line(m.pickupInstructions)
    if (m.deliveryTime) line(this.labels.readyIn.replace('{time}', m.deliveryTime))
    if (m.pickupHoldDays) line(this.labels.holdPeriod.replace('{days}', String(m.pickupHoldDays)))
  }
}

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames([document.documentElement.lang || 'de'], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}
