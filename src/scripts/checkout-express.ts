import type {
  StripeExpressCheckoutElement,
  StripeExpressCheckoutElementClickEvent,
  StripeExpressCheckoutElementConfirmEvent,
  StripeExpressCheckoutElementShippingAddressChangeEvent,
  StripeExpressCheckoutElementShippingRateChangeEvent,
} from '@stripe/stripe-js'
import type {
  CalculateResponse,
  ShippingMethodResponse,
  AddressInput,
  ValidatedCartItemResponse,
  AppliedCouponResponse,
} from '../shared/checkout-api'
import type { CheckoutStripe } from './checkout-stripe'

// Stripe ExpressCheckout shapes (subset).
type LineItem = { name: string; amount: number }
type StripeShippingRate = { id: string; amount: number; displayName: string }
type ResolvedClickPayload = { lineItems: LineItem[]; shippingRates: StripeShippingRate[] }

export type ExpressLabels = {
  shipping: string  // e.g. 'Versand'
}

export type ExpressCheckoutConfig = {
  stripe: CheckoutStripe
  container: HTMLElement
  returnUrl: string
  allowedCountries: string[]
  labels: ExpressLabels
  /** Snapshot of the latest calculate response — provides cart + shipping rates for the click payload. */
  getLatest: () => CalculateResponse | null
  /** Recalculate when express element provides a new partial address. */
  onAddressChange: (partial: { country: string; city?: string; zip?: string; state?: string }) => Promise<CalculateResponse | null>
  /** Recalculate when express element provides a new shipping rate selection. */
  onRateChange: (shippingMethodId: string) => Promise<CalculateResponse | null>
  /** Create the PaymentIntent + orderMeta for the express order. */
  onCreatePayment: (input: {
    address: AddressInput
    email: string
    phone?: string
    shippingMethodId: string
  }) => Promise<{ clientSecret: string } | { error: string }>
  /** Fired once when Stripe reports the express element has rendered at least one payment method. */
  onReady?: (event: { availablePaymentMethods?: Record<string, boolean> }) => void
}

// ── Mapping helpers ──────────────────────────────────────────────────────────

export function buildLineItems(
  items: ValidatedCartItemResponse[],
  selectedShipping: ShippingMethodResponse | undefined,
  shippingLabel: string,
  appliedCoupons: AppliedCouponResponse[] = [],
): LineItem[] {
  const lines: LineItem[] = items.map(i => ({
    name: `${i.quantity}x ${i.title}${i.subtitle ? ` ${i.subtitle}` : ''}`,
    amount: i.price * i.quantity,
  }))
  if (selectedShipping) {
    lines.push({
      name: `${shippingLabel} (${selectedShipping.title})`,
      amount: selectedShipping.price,
    })
  }
  for (const coupon of appliedCoupons) {
    if (coupon.discountAmount > 0) {
      lines.push({
        name: coupon.code,
        amount: -coupon.discountAmount,
      })
    }
  }
  return lines
}

export function buildShippingRates(methods: ShippingMethodResponse[]): StripeShippingRate[] {
  return methods.map(m => ({
    id: m._id,
    amount: m.price,
    displayName: m.title,
  }))
}

function buildPayloadFromCalculation(calc: CalculateResponse, shippingLabel: string): ResolvedClickPayload {
  const selected = calc.shippingMethods.find(m => m._id === calc.selectedShippingMethodId)
  return {
    lineItems: buildLineItems(calc.items, selected, shippingLabel, calc.appliedCoupons),
    shippingRates: buildShippingRates(calc.shippingMethods),
  }
}

// ── Class ────────────────────────────────────────────────────────────────────

export class CheckoutExpress {
  private element: StripeExpressCheckoutElement | null = null
  private config: ExpressCheckoutConfig
  private lastAddress: { country: string; city?: string; zip?: string; state?: string } | null = null

  constructor(config: ExpressCheckoutConfig) {
    this.config = config
  }

  mount(): void {
    const element = this.config.stripe.createExpressCheckoutElement({
      paymentMethods: {
        amazonPay: 'never',
        link: 'never',
        paypal: 'never',
      },
      emailRequired: true,
      shippingAddressRequired: true,
      allowedShippingCountries: this.config.allowedCountries,
    })
    if (!element) return
    this.element = element

    element.mount(this.config.container)

    element.on('ready', e => {
      const available = (e as { availablePaymentMethods?: Record<string, boolean> }).availablePaymentMethods
      const hasAny = available ? Object.values(available).some(Boolean) : false
      if (hasAny) this.config.onReady?.({ availablePaymentMethods: available })
    })
    element.on('click', e => this.handleClick(e))
    element.on('shippingaddresschange', e => this.handleShippingAddressChange(e))
    element.on('shippingratechange', e => this.handleShippingRateChange(e))
    element.on('confirm', e => this.handleConfirm(e))
    element.on('cancel', () => {
      this.lastAddress = null
    })
  }

  destroy(): void {
    this.element?.unmount()
    this.element = null
  }

  getLastCountry(): string | null {
    return this.lastAddress?.country ?? null
  }

  // ── Event handlers ──────────────────────────────────────────────────────

  private handleClick(event: StripeExpressCheckoutElementClickEvent): void {
    const calc = this.config.getLatest()
    if (!calc) return
    // Pass line items without shipping — the shippingaddresschange event fires
    // immediately with the user's actual wallet address and recalculates the
    // correct shipping methods for their country.
    event.resolve({
      lineItems: buildLineItems(calc.items, undefined, this.config.labels.shipping, calc.appliedCoupons),
      shippingRates: [],
    })
  }

  private async handleShippingAddressChange(
    event: StripeExpressCheckoutElementShippingAddressChangeEvent,
  ): Promise<void> {
    const a = event.address
    const partial = {
      country: a.country,
      city: a.city,
      zip: a.postal_code,
      ...(a.state && { state: a.state }),
    }
    this.lastAddress = partial

    const calc = await this.config.onAddressChange(partial)
    if (!calc) {
      event.reject()
      return
    }
    event.resolve(buildPayloadFromCalculation(calc, this.config.labels.shipping))
  }

  private async handleShippingRateChange(
    event: StripeExpressCheckoutElementShippingRateChangeEvent,
  ): Promise<void> {
    const calc = await this.config.onRateChange(event.shippingRate.id)
    if (!calc) {
      event.reject()
      return
    }
    event.resolve(buildPayloadFromCalculation(calc, this.config.labels.shipping))
  }

  private async handleConfirm(event: StripeExpressCheckoutElementConfirmEvent): Promise<void> {
    const shippingAddress = event.shippingAddress
    const email = event.billingDetails?.email
    const shippingRateId = event.shippingRate?.id

    if (!shippingAddress || !email || !shippingRateId) {
      event.paymentFailed({ reason: 'fail' })
      return
    }

    const name = shippingAddress.name
    const parts = name.trim().split(/\s+/)
    const prename = parts.length >= 2 ? parts.slice(0, -1).join(' ') : undefined
    const lastname = parts.length >= 2 ? parts[parts.length - 1] : undefined

    const address: AddressInput = {
      name,
      ...(prename && { prename }),
      ...(lastname && { lastname }),
      line1: shippingAddress.address.line1,
      ...(shippingAddress.address.line2 && { line2: shippingAddress.address.line2 }),
      city: shippingAddress.address.city,
      country: shippingAddress.address.country,
      zip: shippingAddress.address.postal_code,
      ...(shippingAddress.address.state && { state: shippingAddress.address.state }),
    }

    const result = await this.config.onCreatePayment({
      address,
      email,
      phone: event.billingDetails?.phone,
      shippingMethodId: shippingRateId,
    })

    if ('error' in result) {
      event.paymentFailed({ reason: 'fail' })
      return
    }

    const confirmResult = await this.config.stripe.confirmPaymentWithDetails(
      result.clientSecret,
      this.config.returnUrl,
      {
        email,
        name,
        phone: event.billingDetails?.phone,
        address: {
          line1: address.line1,
          ...(address.line2 && { line2: address.line2 }),
          city: address.city,
          country: address.country,
          postal_code: address.zip,
          ...(address.state && { state: address.state }),
        },
      },
    )

    if (confirmResult.error) {
      event.paymentFailed({ reason: 'fail' })
    }
    // Success: Stripe redirects to returnUrl. Cart cleared on order-thanks page.
  }
}
