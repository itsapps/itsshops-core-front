import type { Stripe, StripeElements, StripeExpressCheckoutElement, StripeExpressCheckoutElementOptions } from '@stripe/stripe-js'

export class CheckoutStripe {
  private stripe: Stripe
  private elements: StripeElements | null = null
  private paymentElementMounted = false

  constructor(stripe: Stripe) {
    this.stripe = stripe
  }

  initElements(amount: number, currency: string, locale: string): void {
    this.elements = this.stripe.elements({
      mode: 'payment',
      amount,
      currency,
      locale: locale as any,
    })
  }

  getElements(): StripeElements | null {
    return this.elements
  }

  hasPaymentElement(): boolean {
    return this.paymentElementMounted
  }

  mountPaymentElement(container: HTMLElement): void {
    if (!this.elements || this.paymentElementMounted) return
    const paymentElement = this.elements.create('payment')
    paymentElement.mount(container)
    this.paymentElementMounted = true
  }

  createExpressCheckoutElement(options: StripeExpressCheckoutElementOptions): StripeExpressCheckoutElement | null {
    if (!this.elements) return null
    return this.elements.create('expressCheckout', options)
  }

  updateAmount(amount: number): void {
    this.elements?.update({ amount })
  }

  async submitElements(): Promise<{ error?: { message: string } }> {
    if (!this.elements) return { error: { message: 'Payment not initialized' } }
    const result = await this.elements.submit()
    return result.error ? { error: { message: result.error.message ?? 'Payment validation failed' } } : {}
  }

  async confirmPayment(clientSecret: string, returnUrl: string): Promise<{ error?: { message: string } }> {
    if (!this.elements) return { error: { message: 'Payment not initialized' } }
    const result = await this.stripe.confirmPayment({
      elements: this.elements,
      clientSecret,
      confirmParams: { return_url: returnUrl },
    })
    return result.error ? { error: { message: result.error.message ?? 'Payment failed' } } : {}
  }

  /**
   * Confirm with explicit billing details and shipping. Used by express checkout
   * where Stripe Elements does not collect address fields itself — we pass
   * the address harvested from the express element (Apple Pay, Google Pay).
   */
  async confirmPaymentWithDetails(
    clientSecret: string,
    returnUrl: string,
    details: {
      email: string
      name: string
      phone?: string
      address: {
        line1: string
        line2?: string
        city: string
        country: string
        postal_code: string
        state?: string
      }
    },
  ): Promise<{ error?: { message: string } }> {
    if (!this.elements) return { error: { message: 'Payment not initialized' } }
    const shipping = {
      name: details.name,
      ...(details.phone && { phone: details.phone }),
      address: details.address,
    }
    const result = await this.stripe.confirmPayment({
      elements: this.elements,
      clientSecret,
      confirmParams: {
        return_url: returnUrl,
        payment_method_data: {
          billing_details: {
            email: details.email,
            name: details.name,
            ...(details.phone && { phone: details.phone }),
            address: details.address,
          },
        },
        shipping,
      },
    })
    return result.error ? { error: { message: result.error.message ?? 'Payment failed' } } : {}
  }
}
