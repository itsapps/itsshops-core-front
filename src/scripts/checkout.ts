import { getCart, clearCart, type CartItem } from './cart-store'
import { calculatePayment, createPayment, CheckoutApiError } from './checkout-api'
import { CheckoutForm } from './checkout-form'
import { CheckoutShipping } from './checkout-shipping'
import { CheckoutSummary } from './checkout-summary'
import { CheckoutStripe } from './checkout-stripe'
import type { CalculateResponse, CheckoutCartItem, SupportedCountry } from './checkout-types'

function dispatch(name: string, detail?: unknown): void {
  document.dispatchEvent(new CustomEvent(name, { detail }))
}

export async function initCheckout(): Promise<void> {
  const container = document.querySelector<HTMLElement>('[data-checkout]')
  if (!container) return

  const apiUrl = container.dataset.checkoutApi ?? '/api/payment/create'
  const stripeKey = container.dataset.stripeKey
  const returnUrl = container.dataset.returnUrl ?? window.location.origin
  const locale = document.documentElement.lang || 'de'
  const currency = container.dataset.currency ?? 'EUR'
  const currencyLabel = container.dataset.currencyLabel

  if (!stripeKey) {
    console.error('[checkout] Missing data-stripe-key attribute')
    return
  }

  // ── DOM elements ──────────────────────────────────────────────────────
  const formEl = container.querySelector<HTMLFormElement>('[data-checkout-form]')
  const itemsEl = container.querySelector<HTMLElement>('[data-checkout-items]')
  const totalsEl = container.querySelector<HTMLElement>('[data-checkout-totals]')
  const shippingEl = container.querySelector<HTMLElement>('[data-checkout-shipping]')
  const paymentEl = container.querySelector<HTMLElement>('[data-checkout-payment]')
  const submitBtn = container.querySelector<HTMLButtonElement>('[data-checkout-submit]')
  const errorEl = container.querySelector<HTMLElement>('[data-checkout-error-global]')
  const loadingEl = container.querySelector<HTMLElement>('[data-checkout-loading]')
  const countrySelect = container.querySelector<HTMLSelectElement>('[data-checkout-country]')
  const billingCountrySelect = container.querySelector<HTMLSelectElement>('[data-checkout-billing-country]')

  if (!formEl || !itemsEl || !totalsEl || !shippingEl || !paymentEl || !submitBtn) {
    console.error('[checkout] Missing required DOM elements')
    return
  }

  // ── Load Stripe ───────────────────────────────────────────────────────
  const { loadStripe } = await import('@stripe/stripe-js')
  const stripe = await loadStripe(stripeKey)
  if (!stripe) {
    console.error('[checkout] Failed to load Stripe')
    return
  }

  // ── Initialize modules ────────────────────────────────────────────────
  const form = new CheckoutForm(formEl)
  const shipping = new CheckoutShipping(shippingEl)
  const summary = new CheckoutSummary(itemsEl, totalsEl, locale, currency, currencyLabel)
  const stripeCheckout = new CheckoutStripe(stripe)

  // Build cart items from store (only need variantId + quantity for API)
  const cart = getCart()
  if (cart.length === 0) {
    container.innerHTML = '<p data-checkout-empty>Cart is empty</p>'
    return
  }

  const cartItems: CheckoutCartItem[] = cart.map(item => ({
    variantId: item.id,
    quantity: item.quantity,
  }))

  // Show cart items immediately from localStorage
  summary.renderCartItems(cart)

  // Map cart images for display
  const cartImages = new Map(cart.map(item => [item.id, item.imageUrl]))

  // ── State ─────────────────────────────────────────────────────────────
  let lastResponse: CalculateResponse | null = null
  let orderMetaId: string | undefined
  let isSubmitting = false

  // ── Helpers ───────────────────────────────────────────────────────────
  function setLoading(loading: boolean): void {
    if (loadingEl) loadingEl.hidden = !loading
    submitBtn.disabled = loading || isSubmitting
  }

  function showError(message: string): void {
    if (errorEl) {
      errorEl.textContent = message
      errorEl.hidden = false
      errorEl.setAttribute('aria-live', 'assertive')
    }
    dispatch('checkout:error', { message })
  }

  function clearError(): void {
    if (errorEl) {
      errorEl.textContent = ''
      errorEl.hidden = true
    }
  }

  function populateCountrySelect(select: HTMLSelectElement | null, countries: SupportedCountry[], selected: string): void {
    if (!select || select.options.length > 1) return
    select.innerHTML = ''
    for (const country of countries) {
      const option = document.createElement('option')
      option.value = country.code
      option.textContent = country.title
      option.selected = country.code === selected
      select.appendChild(option)
    }
  }

  function populateCountries(countries: SupportedCountry[], selected: string): void {
    populateCountrySelect(countrySelect, countries, selected)
    populateCountrySelect(billingCountrySelect, countries, selected)
  }

  // ── Calculate ─────────────────────────────────────────────────────────
  async function calculate(options: { country?: string; shippingMethodId?: string } = {}): Promise<void> {
    setLoading(true)
    clearError()

    try {
      const response = await calculatePayment(apiUrl, cartItems, locale, options)
      lastResponse = response

      summary.renderItems(response.items, cartImages)
      summary.renderTotals(response)
      shipping.render(response.shippingMethods, response.selectedShippingMethodId, summary.formatPrice.bind(summary))
      populateCountries(response.supportedCountries, response.selectedCountry)

      // Init or update Stripe Elements
      if (!stripeCheckout['paymentElementMounted']) {
        stripeCheckout.initElements(response.totals.grandTotal, response.currency.toLowerCase(), locale)
        stripeCheckout.mountPaymentElement(paymentEl)
      } else {
        stripeCheckout.updateAmount(response.totals.grandTotal)
      }

      if (response.unavailableItems.length > 0) {
        showError(`Some items are no longer available and were removed.`)
      }

      dispatch('checkout:calculated', response)
    } catch (err) {
      const message = err instanceof CheckoutApiError ? err.message : 'Failed to load checkout. Please try again.'
      showError(message)
    } finally {
      setLoading(false)
    }
  }

  // ── Event handlers ────────────────────────────────────────────────────
  form.setOnCountryChange((country) => {
    calculate({ country, shippingMethodId: shipping.getSelectedId() })
  })

  shipping.setOnSelect((methodId) => {
    const country = form.getCountry() || lastResponse?.selectedCountry
    calculate({ country, shippingMethodId: methodId })
  })

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (isSubmitting || !lastResponse) return

    // Validate form
    const errors = form.validate()
    if (errors.length > 0) {
      form.showErrors(errors)
      return
    }
    form.clearErrors()

    // Validate Stripe Elements
    const elementsResult = await stripeCheckout.submitElements()
    if (elementsResult.error) {
      showError(elementsResult.error.message)
      return
    }

    isSubmitting = true
    submitBtn.disabled = true
    dispatch('checkout:submitting')
    clearError()

    try {
      const response = await createPayment(
        apiUrl,
        cartItems,
        locale,
        {
          shipping: form.getShippingAddress(),
          billing: form.getBillingAddress(),
          contactEmail: form.getEmail(),
        },
        {
          shippingMethodId: shipping.getSelectedId(),
          orderMetaId,
        },
      )

      orderMetaId = response.orderMetaId

      // Update summary with final totals
      summary.renderTotals(response)

      // Confirm payment with Stripe
      const confirmResult = await stripeCheckout.confirmPayment(response.clientSecret, returnUrl)
      if (confirmResult.error) {
        showError(confirmResult.error.message)
        isSubmitting = false
        submitBtn.disabled = false
        return
      }

      // If we get here, Stripe redirected — this code won't run
      clearCart()
      dispatch('checkout:complete')
    } catch (err) {
      const message = err instanceof CheckoutApiError ? err.message : 'Payment failed. Please try again.'
      showError(message)

      if (err instanceof CheckoutApiError && err.details) {
        const fieldErrors = Object.entries(err.details).map(([field, msg]) => ({ field, message: msg }))
        form.showErrors(fieldErrors)
      }
    } finally {
      isSubmitting = false
      submitBtn.disabled = false
    }
  })

  // ── Initial load ──────────────────────────────────────────────────────
  await calculate()
}
