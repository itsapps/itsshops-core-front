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
type ResolvedClickPayload = { lineItems: LineItem[]; shippingRates?: StripeShippingRate[] }

export type ExpressLabels = {
  shipping: string  // e.g. 'Versand'
  pickup?: string   // e.g. 'Abholung'
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
    /** The last calculation the wallet sheet showed (lines + total); `null` = none seen. */
    shownCalculation: CalculateResponse | null
  }) => Promise<{ clientSecret: string } | { error: string }>
  /** The wallet sheet was closed without paying (the page restores its own amount). */
  onCancel?: () => void
  /** Fired once when Stripe reports the express element has rendered at least one payment method. */
  onReady?: (event: { availablePaymentMethods?: Record<string, boolean> }) => void
  /** Fired when confirmPayment returns an error (e.g. card declined) so the page can show a message. */
  onError?: (message: string) => void
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
    // freeShipping coupons are already reflected in the shipping rate being 0 —
    // adding them as a separate negative line item would break the sum.
    if (coupon.discountAmount > 0 && coupon.discountType !== 'freeShipping') {
      lines.push({
        name: coupon.code,
        amount: -coupon.discountAmount,
      })
    }
  }
  return lines
}

/** The wallet's shipping rates: delivery methods only — a pickup is chosen on the page. */
export function buildShippingRates(methods: ShippingMethodResponse[]): StripeShippingRate[] {
  return methods.filter(m => m.methodType === 'delivery').map(m => ({
    id: m._id,
    amount: m.price,
    displayName: m.title,
  }))
}

/** Delivery-mode sheet payload; `null` when no delivery method serves the wallet's address. */
export function buildPayloadFromCalculation(calc: CalculateResponse, shippingLabel: string): ResolvedClickPayload | null {
  const shippingRates = buildShippingRates(calc.shippingMethods)
  if (shippingRates.length === 0) return null
  const selected = calc.shippingMethods.find(m => m._id === calc.selectedShippingMethodId && m.methodType === 'delivery')
  return {
    lineItems: buildLineItems(calc.items, selected, shippingLabel, calc.appliedCoupons),
    shippingRates,
  }
}

/**
 * Pickup-mode click payload: the page's calculation (its total doesn't depend on the wallet's
 * billing country — pickup is taxed by the pickup location), no shipping rates.
 */
export function buildPickupPayload(calc: CalculateResponse, pickupId: string, pickupLabel: string): ResolvedClickPayload {
  const method = calc.shippingMethods.find(m => m._id === pickupId)
  return { lineItems: buildLineItems(calc.items, method, pickupLabel, calc.appliedCoupons) }
}

// ── Class ────────────────────────────────────────────────────────────────────

export class CheckoutExpress {
  private element: StripeExpressCheckoutElement | null = null
  private config: ExpressCheckoutConfig
  private lastAddress: { country: string; city?: string; zip?: string; state?: string } | null = null
  /** The calculation the wallet sheet last showed (address or rate change); reset on cancel. */
  private shownCalculation: CalculateResponse | null = null
  /** The pickup method chosen on the page (pickup mode: no shipping address in the sheet). */
  private pickupId: string | null = null

  constructor(config: ExpressCheckoutConfig) {
    this.config = config
  }

  /** No wallet in this browser — the element was dropped and is never created again. */
  private unavailable = false

  /**
   * Create + mount the element for the current mode. Pickup asks the sheet for the billing
   * address instead of a shipping address (no shipping rates then).
   */
  mount(): void {
    const element = this.config.stripe.createExpressCheckoutElement({
      paymentMethods: {
        amazonPay: 'never',
        link: 'never',
        paypal: 'never',
      },
      emailRequired: true,
      ...(this.pickupId
        ? { shippingAddressRequired: false, billingAddressRequired: true }
        : { shippingAddressRequired: true, allowedShippingCountries: this.config.allowedCountries }),
    })
    if (!element) return
    this.element = element

    element.mount(this.config.container)

    element.on('ready', e => {
      const available = (e as { availablePaymentMethods?: Record<string, boolean> }).availablePaymentMethods
      const hasAny = available ? Object.values(available).some(Boolean) : false
      if (hasAny) this.config.onReady?.({ availablePaymentMethods: available })
      // No wallet in this browser (e.g. Firefox desktop: no Klarna, Apple/Google Pay only with
      // 'always'): drop the element so its iframe doesn't keep a blank box on the page.
      else {
        this.unavailable = true
        this.destroy()
      }
    })
    element.on('click', e => this.handleClick(e))
    element.on('shippingaddresschange', e => this.handleShippingAddressChange(e))
    element.on('shippingratechange', e => this.handleShippingRateChange(e))
    element.on('confirm', e => this.handleConfirm(e))
    element.on('cancel', () => {
      this.lastAddress = null
      this.shownCalculation = null
      this.config.onCancel?.()
    })
  }

  destroy(): void {
    this.element?.unmount()
    // destroy, not only unmount: an Elements instance holds one express element at a time.
    this.element?.destroy?.()
    this.element = null
  }

  getLastCountry(): string | null {
    return this.lastAddress?.country ?? null
  }

  /**
   * Pickup chosen on the page (`methodId`) or delivery (`null`): the sheet then asks for the
   * billing address instead of a shipping address. A mode change **re-creates** the element —
   * `element.update({ shippingAddressRequired: false })` is refused by Stripe ("You must specify
   * `shippingAddressRequired: true` when providing `shippingRates`") once a click/address
   * answer gave it shipping rates (seen on staging, Safari Apple Pay, 2026-11-19).
   */
  setPickup(methodId: string | null): void {
    const changed = (methodId === null) !== (this.pickupId === null)
    this.pickupId = methodId
    if (!changed || !this.element || this.unavailable) return
    this.lastAddress = null
    this.shownCalculation = null
    this.destroy()
    this.mount()
  }

  // ── Event handlers ──────────────────────────────────────────────────────

  private handleClick(event: StripeExpressCheckoutElementClickEvent): void {
    const calc = this.config.getLatest()
    if (!calc) return
    if (this.pickupId) {
      // No address/rate events follow in pickup mode — what the sheet shows is this calculation.
      event.resolve(buildPickupPayload(calc, this.pickupId, this.config.labels.pickup ?? this.config.labels.shipping))
      this.shownCalculation = calc
      return
    }
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
    this.showCalculation(event, calc)
  }

  private async handleShippingRateChange(
    event: StripeExpressCheckoutElementShippingRateChangeEvent,
  ): Promise<void> {
    const calc = await this.config.onRateChange(event.shippingRate.id)
    this.showCalculation(event, calc)
  }

  /**
   * Answer an address/rate change with a recalculation. The Elements amount must match the line
   * items Stripe gets (it refuses line items above the amount), so it is updated first — the
   * wallet's total can differ from the page's (another country's shipping, a price changed since
   * the page calculated). Any failure rejects the event, so the sheet never hangs.
   */
  private showCalculation(
    event: { resolve: (payload: ResolvedClickPayload) => void; reject: () => void },
    calc: CalculateResponse | null,
  ): void {
    if (!calc) {
      event.reject()
      return
    }
    const payload = buildPayloadFromCalculation(calc, this.config.labels.shipping)
    if (!payload) {
      // Only pickup methods for this address: the wallet can't deliver there.
      event.reject()
      return
    }
    try {
      this.config.stripe.updateAmount(calc.totals.grandTotal)
      event.resolve(payload)
      this.shownCalculation = calc
    } catch (err) {
      console.error('[checkout] express calculation could not be shown', err)
      event.reject()
    }
  }

  private async handleConfirm(event: StripeExpressCheckoutElementConfirmEvent): Promise<void> {
    const pickupId = this.pickupId
    const email = event.billingDetails?.email
    // Delivery: the shipping address + rate; pickup: the billing address + the page's pickup.
    const source = pickupId ? event.billingDetails : event.shippingAddress
    const shippingRateId = pickupId ?? event.shippingRate?.id
    const sourceAddress = source?.address

    if (!source?.name || !sourceAddress?.line1 || !sourceAddress.country || !email || !shippingRateId) {
      event.paymentFailed({ reason: 'fail' })
      return
    }

    // Wallets only provide the full name. Don't guess first/last name here — orders only need
    // `name`; the Winenet export splits it when needed (netlify/utils/name.ts).
    const name = source.name

    const address: AddressInput = {
      name,
      line1: sourceAddress.line1,
      ...(sourceAddress.line2 && { line2: sourceAddress.line2 }),
      city: sourceAddress.city ?? '',
      country: sourceAddress.country,
      zip: sourceAddress.postal_code ?? '',
      ...(sourceAddress.state && { state: sourceAddress.state }),
      ...(pickupId && event.billingDetails?.phone && { phone: event.billingDetails.phone }),
    }

    const result = await this.config.onCreatePayment({
      address,
      email,
      phone: event.billingDetails?.phone,
      shippingMethodId: shippingRateId,
      shownCalculation: this.shownCalculation,
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
      { withShipping: !pickupId },
    )

    if (confirmResult.error) {
      this.config.onError?.(confirmResult.error.message)
      return
    }
    // On success Stripe redirects to returnUrl. Cart cleared on order-thanks page.
  }
}
