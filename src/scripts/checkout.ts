import { getCart, updateQuantity, removeItem, syncPricesFromServer, type CartItem } from './cart-store'
import { calculatePayment, createPayment, CheckoutValidationError, CheckoutIOError } from './checkout-api'
import { CheckoutForm } from './checkout-form'
import { CheckoutShipping } from './checkout-shipping'
import { CheckoutSummary } from './checkout-summary'
import { CheckoutStripe } from './checkout-stripe'
import { CheckoutExpress } from './checkout-express'
import type { CalculateResponse, CheckoutCartItem, SupportedCountry } from '../shared/checkout-api'

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

  const t = {
    subtotal: container.dataset.tSubtotal ?? 'Subtotal',
    shipping: container.dataset.tShipping ?? 'Shipping',
    total: container.dataset.tTotal ?? 'Total',
    vat: container.dataset.tVat ?? 'VAT',
    vatExempt: container.dataset.tVatExempt ?? 'VAT exempt',
    freeShipping: container.dataset.tFreeShipping ?? 'Free shipping',
    cartEmpty: container.dataset.tCartEmpty ?? 'Cart is empty',
    error: container.dataset.tError ?? 'An error occurred. Please try again.',
    serviceError: container.dataset.tServiceError ?? 'A technical error occurred. Please try again later.',
    itemsUnavailable: container.dataset.tItemsUnavailable ?? 'Some items are no longer available.',
    available: container.dataset.tAvailable ?? 'available',
    errorEmail: container.dataset.tErrorEmail ?? 'Valid email required',
    errorPrename: container.dataset.tErrorPrename ?? 'First name is required',
    errorLastname: container.dataset.tErrorLastname ?? 'Last name is required',
    errorStreet: container.dataset.tErrorStreet ?? 'Address is required',
    errorCity: container.dataset.tErrorCity ?? 'City is required',
    errorZip: container.dataset.tErrorZip ?? 'Postal code is required',
    errorCountry: container.dataset.tErrorCountry ?? 'Country is required',
  }

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
  const expressEl = container.querySelector<HTMLElement>('[data-checkout-express]')
  const orDividerEl = container.querySelector<HTMLElement>('[data-checkout-or-divider]')
  const submitBtn = container.querySelector<HTMLButtonElement>('[data-checkout-submit]')
  const errorEl = container.querySelector<HTMLElement>('[data-checkout-error-global]')
  const serviceErrorEl = container.querySelector<HTMLElement>('[data-checkout-service-error]')
  const progressEl = container.querySelector<HTMLElement>('[data-checkout-progress]')
  const countrySelect = container.querySelector<HTMLSelectElement>('[data-checkout-country]')
  const billingCountrySelect = container.querySelector<HTMLSelectElement>('[data-checkout-billing-country]')

  if (!formEl || !itemsEl || !totalsEl || !shippingEl || !paymentEl || !submitBtn) {
    console.error('[checkout] Missing required DOM elements')
    return
  }
  // Local non-null aliases — narrowing through closures defined below is unreliable.
  const paymentMount: HTMLElement = paymentEl

  // ── Load Stripe ───────────────────────────────────────────────────────
  const { loadStripe } = await import('@stripe/stripe-js')
  const stripe = await loadStripe(stripeKey)
  if (!stripe) {
    console.error('[checkout] Failed to load Stripe')
    return
  }

  // ── Initialize modules ────────────────────────────────────────────────
  const form = new CheckoutForm(formEl, {
    email: t.errorEmail,
    prename: t.errorPrename,
    lastname: t.errorLastname,
    street: t.errorStreet,
    city: t.errorCity,
    zip: t.errorZip,
    country: t.errorCountry,
  })
  const shipping = new CheckoutShipping(shippingEl)
  const summary = new CheckoutSummary(itemsEl, totalsEl, locale, currency, currencyLabel, {
    subtotal: t.subtotal,
    shipping: t.shipping,
    total: t.total,
    vat: t.vat,
    vatExempt: t.vatExempt,
    available: t.available,
  })
  const stripeCheckout = new CheckoutStripe(stripe)

  // Build cart items from store
  const cart = getCart()
  if (cart.length === 0) {
    container.innerHTML = `<p data-checkout-empty>${t.cartEmpty}</p>`
    return
  }

  let cartItems: CheckoutCartItem[] = cart.map(item => ({
    variantId: item.id,
    quantity: item.quantity,
    title: item.title,
    ...(item.subtitle && { subtitle: item.subtitle }),
  }))

  summary.renderCartItems(cart)
  // Live snapshot of local cart entries by id — used by renderItems to keep titles
  // consistent with the product page / cart sidebar even after server recalculation.
  const localCartMap = new Map<string, CartItem>(cart.map(item => [item.id, item]))

  // Wire qty changes and removals from summary to cart store + recalculate
  summary.setEvents({
    onQuantityChange(variantId, quantity) {
      updateQuantity(variantId, quantity)
      const item = cartItems.find(i => i.variantId === variantId)
      if (item) item.quantity = quantity
      debouncedRecalculate()
    },
    onRemove(variantId) {
      removeItem(variantId)
      cartItems = cartItems.filter(i => i.variantId !== variantId)
      if (cartItems.length === 0) {
        container.innerHTML = `<p data-checkout-empty>${t.cartEmpty}</p>`
        return
      }
      debouncedRecalculate()
    },
  })

  // ── Debounced recalculate (for rapid qty changes) ──────────────────
  let recalcTimer: ReturnType<typeof setTimeout> | null = null
  function debouncedRecalculate(): void {
    if (recalcTimer) clearTimeout(recalcTimer)
    recalcTimer = setTimeout(() => {
      const country = form.getCountry() || lastResponse?.selectedCountry
      calculate({ country, shippingMethodId: shipping.getSelectedId() })
    }, 400)
  }

  // ── State ─────────────────────────────────────────────────────────────
  let lastResponse: CalculateResponse | null = null
  let orderMetaId: string | undefined
  let isSubmitting = false

  // ── Error handling ────────────────────────────────────────────────────
  function setLoading(loading: boolean): void {
    if (loading) {
      container.setAttribute('data-checkout-state', isSubmitting ? 'submitting' : 'loading')
      container.setAttribute('aria-busy', 'true')
    } else {
      container.setAttribute('data-checkout-state', isSubmitting ? 'submitting' : 'ready')
      container.setAttribute('aria-busy', isSubmitting ? 'true' : 'false')
    }
    if (progressEl) progressEl.hidden = !loading && !isSubmitting
    if (submitBtn) submitBtn.disabled = loading || isSubmitting
  }

  function showValidationError(message: string): void {
    hideErrors()
    if (errorEl) {
      errorEl.textContent = message
      errorEl.hidden = false
      errorEl.setAttribute('aria-live', 'assertive')
    }
    dispatch('checkout:error', { type: 'validation', message })
  }

  function showServiceError(requestId?: string): void {
    hideErrors()
    if (serviceErrorEl) {
      serviceErrorEl.hidden = false
      serviceErrorEl.setAttribute('aria-live', 'assertive')
      const requestIdEl = serviceErrorEl.querySelector('[data-request-id]')
      if (requestIdEl && requestId) requestIdEl.textContent = requestId
      const contactLink = serviceErrorEl.querySelector<HTMLAnchorElement>('a[href*="mailto"]')
      if (contactLink && requestId) {
        contactLink.href = contactLink.href.replace(/(RequestId:)[^&]*/, `$1${requestId}`)
      }
    } else {
      // Fallback if no service error element exists
      showValidationError(t.serviceError)
    }
    dispatch('checkout:error', { type: 'io', requestId })
  }

  function hideErrors(): void {
    if (errorEl) {
      errorEl.textContent = ''
      errorEl.hidden = true
    }
    if (serviceErrorEl) {
      serviceErrorEl.hidden = true
    }
  }

  function handleError(err: unknown): void {
    if (err instanceof CheckoutValidationError) {
      showValidationError(err.message)
      if (err.details) {
        const fieldErrors = Object.entries(err.details).map(([field, msg]) => ({ field, message: msg }))
        form.showErrors(fieldErrors)
      }
    } else if (err instanceof CheckoutIOError) {
      showServiceError(err.requestId)
    } else {
      showValidationError(t.error)
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

  // ── Express checkout (Apple Pay / Google Pay) ─────────────────────────
  let expressCheckout: CheckoutExpress | null = null

  function mountExpressCheckout(initial: CalculateResponse): void {
    if (!expressEl || expressCheckout) return
    expressCheckout = new CheckoutExpress({
      stripe: stripeCheckout,
      container: expressEl,
      returnUrl,
      allowedCountries: initial.supportedCountries.map(c => c.code),
      labels: { shipping: t.shipping },
      getLatest: () => lastResponse,
      onAddressChange: async (partial) => {
        try {
          return await calculatePayment(apiUrl, cartItems, locale, {
            country: partial.country,
            shippingMethodId: shipping.getSelectedId(),
          })
        } catch {
          return null
        }
      },
      onRateChange: async (methodId) => {
        try {
          // Use the express checkout's last address country, not the manual form's.
          const country = expressCheckout?.getLastCountry() || lastResponse?.selectedCountry
          return await calculatePayment(apiUrl, cartItems, locale, {
            country,
            shippingMethodId: methodId,
          })
        } catch {
          return null
        }
      },
      onReady: () => {
        if (orDividerEl) orDividerEl.hidden = false
      },
      onCreatePayment: async ({ address, email, shippingMethodId }) => {
        try {
          const response = await createPayment(
            apiUrl,
            cartItems,
            locale,
            { shipping: address, contactEmail: email },
            { shippingMethodId, orderMetaId },
          )
          orderMetaId = response.orderMetaId
          return { clientSecret: response.clientSecret }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Payment creation failed' }
        }
      },
    })
    expressCheckout.mount()
  }

  // ── Calculate ─────────────────────────────────────────────────────────
  async function calculate(options: { country?: string; shippingMethodId?: string } = {}): Promise<void> {
    setLoading(true)
    hideErrors()

    try {
      const response = await calculatePayment(apiUrl, cartItems, locale, options)
      lastResponse = response

      // Sync authoritative server prices into local cart so the cart sidebar / badge
      // and any future visit reflect the true price (silent — no UI alert).
      syncPricesFromServer(response.items.map(i => ({ id: i.variantId, price: i.price })))

      summary.renderItems(response.items, localCartMap)
      summary.renderTotals(response)
      shipping.render(response.shippingMethods, response.selectedShippingMethodId, summary.formatPrice.bind(summary))
      populateCountries(response.supportedCountries, response.selectedCountry)

      if (!stripeCheckout.hasPaymentElement()) {
        stripeCheckout.initElements(response.totals.grandTotal, response.currency.toLowerCase(), locale)
        stripeCheckout.mountPaymentElement(paymentMount)
        mountExpressCheckout(response)
      } else {
        stripeCheckout.updateAmount(response.totals.grandTotal)
      }

      if (response.unavailableItems.length > 0) {
        showValidationError(t.itemsUnavailable)
      }

      dispatch('checkout:calculated', response)
    } catch (err) {
      handleError(err)
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

    const errors = form.validate()
    if (errors.length > 0) {
      form.showErrors(errors)
      return
    }
    form.clearErrors()

    const elementsResult = await stripeCheckout.submitElements()
    if (elementsResult.error) {
      showValidationError(elementsResult.error.message)
      return
    }

    isSubmitting = true
    submitBtn.disabled = true
    container.setAttribute('data-checkout-state', 'submitting')
    container.setAttribute('aria-busy', 'true')
    if (progressEl) progressEl.hidden = false
    dispatch('checkout:submitting')
    hideErrors()

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
      summary.renderTotals(response)

      // On success, confirmPayment redirects to returnUrl — code below only runs on error.
      // Cart is cleared on the order-thanks page (see scripts/order-thanks.ts).
      const confirmResult = await stripeCheckout.confirmPayment(response.clientSecret, returnUrl)
      if (confirmResult.error) {
        showValidationError(confirmResult.error.message)
        isSubmitting = false
        submitBtn.disabled = false
        return
      }
    } catch (err) {
      handleError(err)
    } finally {
      isSubmitting = false
      submitBtn.disabled = false
      container.setAttribute('data-checkout-state', 'ready')
      container.setAttribute('aria-busy', 'false')
      if (progressEl) progressEl.hidden = true
    }
  })

  // ── Initial load ──────────────────────────────────────────────────────
  await calculate()
}
