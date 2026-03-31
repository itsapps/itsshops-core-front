import type { Stripe, StripeElements } from '@stripe/stripe-js'

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

  mountPaymentElement(container: HTMLElement): void {
    if (!this.elements || this.paymentElementMounted) return
    const paymentElement = this.elements.create('payment')
    paymentElement.mount(container)
    this.paymentElementMounted = true
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
}
