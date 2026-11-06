import {
  getCart,
  updateQuantity,
  removeItem,
  removeItems,
  syncCartFromServer,
  emptyCartChanges,
  hasCartChanges,
  getAppliedCouponCode,
  setAppliedCouponCode,
  clearAppliedCouponCode,
  type CartItem,
  type CartChanges,
} from './cart-store'
import { mustReconfirm, renderChanges, changeMessages, type ChangeLabels } from './checkout-changes'
import { calculatePayment, createPayment, CheckoutValidationError, CheckoutIOError } from './checkout-api'
import { CheckoutForm } from './checkout-form'
import { CheckoutShipping } from './checkout-shipping'
import { CheckoutSummary } from './checkout-summary'
import { CheckoutStripe } from './checkout-stripe'
import { CheckoutExpress } from './checkout-express'
import { CheckoutCoupon, type CouponLabels } from './checkout-coupon'
import { buildOrderSnapshot, saveOrderSnapshot, paymentIntentIdFromSecret } from './order-snapshot'
import { savePendingPayment, reconcilePendingPayment } from './pending-payment'
import type { CalculateResponse, CheckoutCartItem, SupportedCountry } from '../shared/checkout-api'

function dispatch(name: string, detail?: unknown): void {
  document.dispatchEvent(new CustomEvent(name, { detail }))
}

export async function initCheckout(): Promise<void> {
  const container = document.querySelector<HTMLElement>('[data-checkout]')!
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
    available: container.dataset.tAvailable ?? 'available',
    errorEmail: container.dataset.tErrorEmail ?? 'Valid email required',
    errorPrename: container.dataset.tErrorPrename ?? 'First name is required',
    errorLastname: container.dataset.tErrorLastname ?? 'Last name is required',
    errorStreet: container.dataset.tErrorStreet ?? 'Address is required',
    errorCity: container.dataset.tErrorCity ?? 'City is required',
    errorZip: container.dataset.tErrorZip ?? 'Postal code is required',
    errorZipFormat: container.dataset.tErrorZipFormat ?? 'Invalid postal code format',
    errorCountry: container.dataset.tErrorCountry ?? 'Country is required',
    discount: container.dataset.tDiscount ?? 'Discount',
    couponApply: container.dataset.tCouponApply ?? 'Apply',
    couponRemove: container.dataset.tCouponRemove ?? 'Remove',
    couponApplied: container.dataset.tCouponApplied ?? 'Coupon applied',
    couponErrorFallback: container.dataset.tCouponError ?? 'Could not apply coupon',
    couponErrorNotFound: container.dataset.tCouponNotFound ?? 'Coupon not found',
    couponErrorDisabled: container.dataset.tCouponDisabled ?? 'Coupon is disabled',
    couponErrorExpired: container.dataset.tCouponExpired ?? 'Coupon has expired',
    couponErrorNotYet: container.dataset.tCouponNotYet ?? 'Coupon is not yet valid',
    couponErrorExhausted: container.dataset.tCouponExhausted ?? 'Coupon limit reached',
    couponErrorBelowMinimum: container.dataset.tCouponBelowMinimum ?? 'Cart total is below the coupon minimum',
  }

  const changeLabels: ChangeLabels = {
    intro: container.dataset.tChangesIntro ?? 'Your cart has been updated:',
    removed: container.dataset.tChangesRemoved ?? '{title} is no longer available and has been removed from your cart.',
    price: container.dataset.tChangesPrice ?? 'The price of {title} has changed: {from} → {to}.',
    quantity: container.dataset.tChangesQuantity ?? 'Only {quantity} of {title} are available.',
    contents: container.dataset.tChangesContents ?? 'The contents of {title} have changed: {contents}.',
    reconfirm: container.dataset.tChangesReconfirm ?? 'Please review your order and confirm again.',
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
  const couponEl = container.querySelector<HTMLElement>('[data-checkout-coupon]')
  const changesEl = container.querySelector<HTMLElement>('[data-checkout-changes]')

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
    zipFormat: t.errorZipFormat,
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
    discount: t.discount,
  })
  const stripeCheckout = new CheckoutStripe(stripe)

  const couponLabels: CouponLabels = {
    apply: t.couponApply,
    remove: t.couponRemove,
    applied: t.couponApplied,
    errorFallback: t.couponErrorFallback,
    errors: {
      COUPON_NOT_FOUND: t.couponErrorNotFound,
      COUPON_DISABLED: t.couponErrorDisabled,
      COUPON_EXPIRED: t.couponErrorExpired,
      COUPON_NOT_YET_VALID: t.couponErrorNotYet,
      COUPON_EXHAUSTED: t.couponErrorExhausted,
      COUPON_BELOW_MINIMUM: t.couponErrorBelowMinimum,
    },
  }
  const coupon = couponEl ? new CheckoutCoupon(couponEl, couponLabels) : null

  // A previous payment that never reached the thanks page may have completed — clear its cart first.
  await reconcilePendingPayment()

  // Build cart items from store
  const cart = getCart()
  if (cart.length === 0) {
    container.innerHTML = `<p data-checkout-empty>${t.cartEmpty}</p>`
    return
  }

  const toRequestItems = (items: CartItem[]): CheckoutCartItem[] => items.map(item => ({
    variantId: item.id,
    quantity: item.quantity,
    title: item.title,
    ...(item.subtitle && { subtitle: item.subtitle }),
  }))
  let cartItems: CheckoutCartItem[] = toRequestItems(cart)

  summary.renderCartItems(cart)
  // Live snapshot of local cart entries by id — used by renderItems to keep titles
  // consistent with the product page / cart sidebar even after server recalculation.
  const localCartMap = new Map<string, CartItem>(cart.map(item => [item.id, item]))

  /** Re-read the stored cart (after a server sync) into the request items and the local map. */
  function refreshFromStore(): CartItem[] {
    const stored = getCart()
    cartItems = toRequestItems(stored)
    localCartMap.clear()
    for (const item of stored) localCartMap.set(item.id, item)
    return stored
  }

  /** The cart is empty: the empty message, keeping the change notice (focused, so it's read). */
  function showEmptyCart(changes: CartChanges = emptyCartChanges()): void {
    const empty = document.createElement('p')
    empty.setAttribute('data-checkout-empty', '')
    empty.textContent = t.cartEmpty
    if (changesEl && hasCartChanges(changes)) {
      container.replaceChildren(changesEl, empty)
      changesEl.focus()
    } else {
      container.replaceChildren(empty)
    }
  }

  /** Show (or clear) the change notice; report non-empty change lists to listeners. */
  function showChanges(changes: CartChanges, options: { reconfirm?: boolean; focus?: boolean } = {}): void {
    if (changesEl) {
      renderChanges(changesEl, changes, changeLabels, summary.formatPrice.bind(summary), { reconfirm: options.reconfirm })
      if (options.focus) changesEl.focus()
    }
    if (hasCartChanges(changes)) dispatch('checkout:cart-changed', changes)
  }

  /** Sync the stored cart with a server answer; `null` when it emptied the cart (already shown). */
  function syncFromResponse(response: CalculateResponse): CartChanges | null {
    const changes = syncCartFromServer(response)
    if (refreshFromStore().length === 0) {
      showChanges(changes)
      showEmptyCart(changes)
      return null
    }
    return changes
  }

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
      localCartMap.delete(variantId)
      if (cartItems.length === 0) {
        showEmptyCart()
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

  // ── Coupon ────────────────────────────────────────────────────────────
  coupon?.setEvents({
    onApply(code) {
      setAppliedCouponCode(code)
      const country = form.getCountry() || lastResponse?.selectedCountry
      calculate({ country, shippingMethodId: shipping.getSelectedId() })
    },
    onRemove() {
      clearAppliedCouponCode()
      const country = form.getCountry() || lastResponse?.selectedCountry
      calculate({ country, shippingMethodId: shipping.getSelectedId() })
    },
  })

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
    // All items unavailable: the server answers CART_EMPTY with the ids (joined ', ') instead of
    // a calculation — remove them from the cart, say which, then the empty-cart path.
    if (err instanceof CheckoutValidationError && err.code === 'CART_EMPTY') {
      const ids = (err.details?.unavailable ?? '').split(', ').filter(Boolean)
      const changes = { ...emptyCartChanges(), removed: removeItems(ids) }
      refreshFromStore()
      showChanges(changes)
      showEmptyCart(changes)
      return
    }
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
            appliedCouponCode: getAppliedCouponCode() ?? undefined,
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
            appliedCouponCode: getAppliedCouponCode() ?? undefined,
          })
        } catch {
          return null
        }
      },
      onReady: () => {
        if (orDividerEl) orDividerEl.hidden = false
      },
      onError: (message) => showValidationError(message),
      onCreatePayment: async ({ address, email, shippingMethodId, shownGrandTotal }) => {
        try {
          const response = await createPayment(
            apiUrl,
            cartItems,
            locale,
            { shipping: address, contactEmail: email },
            {
              shippingMethodId,
              orderMetaId,
              appliedCouponCode: getAppliedCouponCode() ?? undefined,
            },
          )
          orderMetaId = response.orderMetaId
          // Something changed since the wallet sheet's calculation → don't pay; tell the customer
          // on the page. The response is priced for the wallet's address/rate, so recalculate the
          // page instead of rendering it.
          const changes = syncFromResponse(response)
          if (!changes) return { error: changeLabels.intro }
          if (mustReconfirm(changes, shownGrandTotal, response.totals.grandTotal)) {
            showChanges(changes, { reconfirm: true, focus: true })
            const message = [...changeMessages(changes, changeLabels, summary.formatPrice.bind(summary)), changeLabels.reconfirm].join(' ')
            void calculate({ country: form.getCountry() || lastResponse?.selectedCountry, shippingMethodId: shipping.getSelectedId() }, { keepNotice: true })
            return { error: message }
          }
          // Order summary for the thanks page (read back after the Stripe redirect).
          saveOrderSnapshot(buildOrderSnapshot({ response, localCart: localCartMap, email, address, shippingMethodId }))
          savePendingPayment(paymentIntentIdFromSecret(response.clientSecret))
          return { clientSecret: response.clientSecret }
        } catch (err) {
          // All items gone: same handling as on the page (other errors keep only the wallet
          // message — their field details belong to the wallet address, not the page form).
          if (err instanceof CheckoutValidationError && err.code === 'CART_EMPTY') handleError(err)
          return { error: err instanceof Error ? err.message : 'Payment creation failed' }
        }
      },
    })
    expressCheckout.mount()
  }

  // ── Calculate ─────────────────────────────────────────────────────────
  // Only the latest calculate may write the cart and the page: requests can overlap (country,
  // shipping, debounced quantity, coupon) and arrive out of order.
  let calcSeq = 0

  async function calculate(
    options: { country?: string; shippingMethodId?: string } = {},
    { keepNotice = false } = {},
  ): Promise<void> {
    const seq = ++calcSeq
    setLoading(true)
    hideErrors()
    coupon?.setBusy(true)

    try {
      const response = await calculatePayment(apiUrl, cartItems, locale, {
        ...options,
        appliedCouponCode: getAppliedCouponCode() ?? undefined,
      })
      if (seq !== calcSeq) return

      // Server data wins: remove unavailable items, take prices, capped quantities and bundle
      // contents into the stored cart, and say what changed.
      const changes = syncFromResponse(response)
      if (!changes) return
      if (!keepNotice || hasCartChanges(changes)) showChanges(changes, { reconfirm: keepNotice })
      lastResponse = response

      // If the server rejected the stored coupon, drop it from the store so it
      // doesn't keep producing the same error on subsequent recalculations.
      if (response.couponError && response.appliedCoupons.length === 0) {
        clearAppliedCouponCode()
      }

      coupon?.render(response.appliedCoupons, response.couponError)

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

      dispatch('checkout:calculated', response)
    } catch (err) {
      if (seq === calcSeq) handleError(err)
    } finally {
      if (seq === calcSeq) {
        setLoading(false)
        coupon?.setBusy(false)
      }
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
          appliedCouponCode: getAppliedCouponCode() ?? undefined,
        },
      )

      orderMetaId = response.orderMetaId

      // Stop before paying when something changed since the customer last saw the order (AT/DE:
      // the final price must be visible before ordering). Checked before the snapshot / pending
      // payment, so a blocked attempt leaves nothing behind; re-submitting updates the same
      // PaymentIntent + orderMeta (orderMetaId kept).
      const changes = syncFromResponse(response)
      if (!changes) return
      if (mustReconfirm(changes, lastResponse.totals.grandTotal, response.totals.grandTotal)) {
        lastResponse = response
        summary.renderItems(response.items, localCartMap)
        summary.renderTotals(response)
        shipping.render(response.shippingMethods, response.selectedShippingMethodId, summary.formatPrice.bind(summary))
        stripeCheckout.updateAmount(response.totals.grandTotal)
        showChanges(changes, { reconfirm: true, focus: true })
        return
      }
      summary.renderTotals(response)

      // Order summary for the thanks page (read back after the Stripe redirect).
      saveOrderSnapshot(buildOrderSnapshot({
        response,
        localCart: localCartMap,
        email: form.getEmail(),
        address: form.getShippingAddress(),
        shippingMethodId: shipping.getSelectedId(),
      }))
      savePendingPayment(paymentIntentIdFromSecret(response.clientSecret))

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
