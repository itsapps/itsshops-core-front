import type { Context } from '@netlify/functions'
import { validatePaymentRequest } from '../utils/validation'
import { success, validationError, errorResponse, methodNotAllowed, badRequest } from '../utils/response'
import { log } from '../utils/logger'
import { ErrorCode } from '../types/errors'

/** Stripe's minimum charge for EUR, in cents. */
const STRIPE_MIN_CHARGE = 50
import type {
  PaymentCreateRequest,
  CalculateResponse,
  CreatePaymentResponse,
  ValidatedCartItemResponse,
  AppliedDiscountResponse,
  CouponErrorResponse,
} from '../types/api'
import type {
  SanityCheckoutQueryResult,
  SanityShippingMethodResult,
  AvailableShippingMethod,
  LocaleString,
} from '../types/checkout'
import {
  fetchCheckoutData,
  createOrderMeta,
  fetchOrderMeta,
  countOrdersWithDiscountForEmail,
} from '../services/sanity'
import { createPaymentIntent, updatePaymentIntent } from '../services/stripe'
import { validateCart } from '../lib/cart-validator'
import { freeShippingReason, resolveLocalizedTitle, resolveShippingMethods, selectShippingMethod } from '../lib/shipping'
import { calculateTotals } from '../lib/totals'
import { dominantItemVatRate } from '../lib/tax'
import { buildAppliedDiscountSnapshots, buildOrderMeta } from '../lib/order-builder'
import {
  evaluateDiscounts,
  toDiscountInput,
  waivesShipping,
  type LocaleValue,
  type PipelineInput,
} from '../../shared/discounts'
import { bundleContentsKey } from '../lib/order-item-display'
import { serverT, countryName } from '../utils/i18n'
import { type ServerConfig, resolveServerConfig } from '../types/config'
import { isCountryCode } from '../../shared/countries'

export function createPaymentHandler(config: ServerConfig = {}) {
  const { defaultLocale, hasStock, hasCoupons, volumeUnit } = resolveServerConfig(config)

  return async (request: Request, _context: Context): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 })
  }
  if (request.method !== 'POST') {
    return methodNotAllowed()
  }

  const contentType = request.headers.get('content-type')
  if (!contentType?.includes('application/json')) {
    return badRequest('Content-Type must be application/json')
  }

  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  const validation = validatePaymentRequest(body)
  if (!validation.valid) {
    return validationError(ErrorCode.INVALID_INPUT, validation.message, requestId, validation.details)
  }

  const req = body as PaymentCreateRequest

  try {
    // ── Determine country ───────────────────────────────────────────────
    const requestedCountry = req.partialAddress?.country
      ?? req.address?.shipping.country
      ?? null
    // Pickup accepts any country (any ISO code); a made-up one is rejected before the fetch.
    if (requestedCountry !== null && !isCountryCode(requestedCountry)) {
      return validationError(ErrorCode.INVALID_ADDRESS, serverT(req.locale, 'api.errors.validation.countryShippingNotSupported'), requestId)
    }

    const variantIds = req.cart.items.map(i => i.variantId)
    const initialCountry = requestedCountry ?? 'AT'
    const couponCode = hasCoupons && req.appliedCouponCode ? req.appliedCouponCode.trim() : null

    // ── Fetch all checkout data in one GROQ query ───────────────────────
    let data: SanityCheckoutQueryResult = await fetchCheckoutData(
      variantIds,
      initialCountry,
      couponCode,
      hasCoupons,
    )

    const country = requestedCountry
      ?? data.shopSettings?.defaultCountryCode
      ?? 'AT'

    if (country !== initialCountry) {
      data = await fetchCheckoutData(variantIds, country, couponCode, hasCoupons)
    }

    // ── Pickup methods and the tax country ─────────────────────────────
    // A pickup order is taxed by the pickup location's country (place of supply), not the
    // customer's address. The rules must be known before `validateCart`, so pickup is decided
    // from the raw methods: only an explicitly requested pickup id makes a pickup order.
    const defaultCountryCode = data.shopSettings?.defaultCountryCode ?? null
    const taxRulesFor = (m: SanityShippingMethodResult) => {
      const code = m.pickupAddress?.country ?? defaultCountryCode
      return data.pickupTaxCountries?.find(t => t.countryCode === code)?.rules ?? null
    }
    const pickups = data.shippingMethods.filter(m => {
      if (m.methodType !== 'pickup') return false
      if (taxRulesFor(m)) return true
      log.warn('Pickup method dropped: its country is no enabled tax country', { methodId: m._id, requestId })
      return false
    })
    const pickup = pickups.find(m => m._id === req.shippingMethodId)

    // The address country is no tax country: possible only for pickup (any country) — then the
    // methods are the pickups only; without any pickup method it stays unavailable.
    if (!data.taxCountry && pickups.length === 0) {
      return validationError(ErrorCode.SHIPPING_UNAVAILABLE, serverT(req.locale, 'api.errors.validation.countryShippingNotSupported'), requestId)
    }
    const methodsIn: SanityShippingMethodResult[] = data.taxCountry
      ? [...data.shippingMethods.filter(m => m.methodType !== 'pickup'), ...pickups]
      : pickups
    const taxRules = pickup
      ? taxRulesFor(pickup)!
      : data.taxCountry?.rules ?? taxRulesFor(pickups[0])!

    // ── Validate cart items ─────────────────────────────────────────────
    const defaultTaxCategoryCode = data.shopSettings?.defaultTaxCategoryCode ?? null
    const { items: validatedItems, unavailableItems } = validateCart(
      req.cart.items,
      data.variants,
      taxRules,
      req.locale,
      defaultLocale,
      hasStock,
      defaultTaxCategoryCode,
      volumeUnit,
      Object.fromEntries((data.categories ?? []).map(c => [c._id, c.parentId])),
    )

    if (validatedItems.length === 0) {
      return validationError(ErrorCode.CART_EMPTY, serverT(req.locale, 'api.errors.payment.noValidProducts'), requestId, {
        unavailable: unavailableItems.join(', '),
      })
    }

    // ── Shipping + discounts ────────────────────────────────────────────
    const subtotal = validatedItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const freeShippingCalc = data.shopSettings?.freeShippingCalculation ?? 'beforeDiscount'
    const requestedMethodId = pickup?._id ?? req.shippingMethodId

    // Pass 1: the threshold on the undiscounted subtotal. Shipping discounts never change the
    // method prices here — they are applied after selection (on real prices).
    const pass1Methods = resolveShippingMethods(methodsIn, validatedItems, subtotal, 0, freeShippingCalc, req.locale)
    if (pass1Methods.length === 0) {
      return validationError(ErrorCode.SHIPPING_UNAVAILABLE, serverT(req.locale, 'api.errors.shipping.noSupportedShippingCountries'), requestId)
    }

    const resolveTitle = (title: LocaleValue[] | null | undefined) =>
      resolveLocalizedTitle((title ?? null) as LocaleString[] | null, req.locale, defaultLocale)
    const pipelineBase: PipelineInput = {
      lines: validatedItems.map(item => ({
        selector: item.selector,
        unitPrice: item.price,
        quantity: item.quantity,
        childPrices: item.bundleItems?.map(bi => bi.price) ?? null,
      })),
      couponCode,
      codeDiscount: data.codeDiscount ? toDiscountInput(data.codeDiscount, resolveTitle) : null,
      automaticDiscounts: (data.automaticDiscounts ?? []).map(d => toDiscountInput(d, resolveTitle)),
      exclusions: data.shopSettings?.discountExclusions ?? null,
    }
    const shippingOf = (m: AvailableShippingMethod | null) => (m ? { price: m.price, methodType: m.methodType } : null)

    const run = (emailRedemptions?: Record<string, number>) => {
      let methods = pass1Methods
      let selected = selectShippingMethod(methods, requestedMethodId)
      let result = evaluateDiscounts({ ...pipelineBase, shipping: shippingOf(selected), emailRedemptions })
      // Pass 2 (`afterDiscount`): the threshold sees the subtotal minus items + order discounts.
      if (freeShippingCalc === 'afterDiscount' && result.itemsOrderTotal > 0) {
        methods = resolveShippingMethods(methodsIn, validatedItems, subtotal, result.itemsOrderTotal, freeShippingCalc, req.locale)
        selected = selectShippingMethod(methods, requestedMethodId)
        result = evaluateDiscounts({ ...pipelineBase, shipping: shippingOf(selected), emailRedemptions })
      }
      return { methods, selected, result }
    }

    let { methods: shippingMethods, selected: selectedShipping, result: discounts } = run()

    // Per-email limit: needs the email, so only on createPayment (calculate sends no address).
    // Over the limit → the code is dropped and the pipeline re-runs; the grand total then differs
    // from the page and the client's reconfirm stops the payment.
    const contactEmail = req.createPayment ? req.address?.contactEmail?.trim() : undefined
    const limited = discounts.applied.find(a => a.discount.trigger === 'code' && (a.discount.maxPerEmail ?? 0) > 0)
    if (contactEmail && limited) {
      const used = await countOrdersWithDiscountForEmail(limited.discount._id, contactEmail)
      if (used >= limited.discount.maxPerEmail!) {
        ;({ methods: shippingMethods, selected: selectedShipping, result: discounts } = run({ [limited.discount._id]: used }))
      }
    }

    const couponError: CouponErrorResponse | null = discounts.couponError
      ? {
          code: discounts.couponError.code,
          errorCode: discounts.couponError.errorCode,
          message: serverT(req.locale, `api.errors.coupon.${discounts.couponError.errorCode}`),
          ...(discounts.couponError.discountTitle && { discountTitle: discounts.couponError.discountTitle }),
        }
      : null
    const appliedDiscounts: AppliedDiscountResponse[] = discounts.applied.map(({ discount, amount }) => ({
      title: discount.title,
      ...(discount.trigger === 'code' && discount.code && { code: discount.code }),
      trigger: discount.trigger,
      target: discount.target,
      amount,
    }))
    const notDiscountedVariantIds = discounts.notDiscountedLines.map(i => validatedItems[i].variantId)

    // ── Calculate totals ────────────────────────────────────────────────
    // Shipping VAT follows the "dominant goods": the rate whose items have the largest
    // undiscounted gross goods value (sum of shop prices).
    const shippingVatRate = selectedShipping ? dominantItemVatRate(validatedItems) : 0

    const totals = calculateTotals(validatedItems, selectedShipping, shippingVatRate, discounts)

    // ── Build response ──────────────────────────────────────────────────
    const responseItems: ValidatedCartItemResponse[] = validatedItems.map(item => {
      const cartItem = req.cart.items.find(ci => ci.variantId === item.variantId)
      return {
        variantId: item.variantId,
        kind: item.kind,
        title: item.title,
        subtitle: item.subtitle,
        price: item.price,
        quantity: item.quantity,
        requestedQuantity: cartItem?.quantity ?? item.quantity,
        stock: null,
        imageUrl: null,
        weight: item.weight,
        bundleKey: item.bundleItems ? bundleContentsKey(item.bundleItems) : null,
      }
    })

    const supportedCountries = data.supportedCountries.map(c => ({
      code: c.countryCode,
      title: countryName(req.locale, c.countryCode),
    }))

    const calculateResponse: CalculateResponse = {
      items: responseItems,
      unavailableItems,
      totals: {
        subtotal: totals.subtotal,
        shipping: totals.shipping,
        tax: totals.tax,
        discount: totals.discount,
        grandTotal: totals.grandTotal,
        vatBreakdown: totals.vatBreakdown,
      },
      shippingMethods: shippingMethods.map(m => ({
        _id: m._id,
        title: m.title,
        methodType: m.methodType,
        price: waivesShipping(discounts, m.methodType) ? 0 : m.price,
        isFree: waivesShipping(discounts, m.methodType) ? true : m.isFree,
        ...(m.deliveryTime && { deliveryTime: m.deliveryTime }),
        ...(m.pickupAddress && { pickupAddress: m.pickupAddress }),
        ...(m.pickupInstructions && { pickupInstructions: m.pickupInstructions }),
        ...(m.pickupHoldDays && { pickupHoldDays: m.pickupHoldDays }),
        ...(m.pickupAnnounceReady && { pickupAnnounceReady: true }),
      })),
      selectedShippingMethodId: selectedShipping?._id ?? null,
      selectedCountry: country,
      supportedCountries,
      currency: 'EUR',
      appliedDiscounts,
      notDiscountedVariantIds,
      couponError,
    }

    if (!req.createPayment) {
      return success(calculateResponse)
    }

    // ── Create payment ──────────────────────────────────────────────────
    if (!req.address) {
      return validationError(ErrorCode.INVALID_ADDRESS, serverT(req.locale, 'api.errors.payment.addressRequired'), requestId)
    }

    if (!selectedShipping) {
      return validationError(ErrorCode.SHIPPING_UNAVAILABLE, serverT(req.locale, 'api.errors.validation.shippingRateMustBeProvided'), requestId)
    }

    // Stripe refuses EUR charges below 0.50 (a 100 % code, stacked discounts) — say so instead of
    // failing in Stripe with a generic error. A free order would need a flow without payment.
    if (totals.grandTotal < STRIPE_MIN_CHARGE) {
      return validationError(ErrorCode.ORDER_TOTAL_BELOW_MINIMUM, serverT(req.locale, 'api.errors.payment.belowMinimum'), requestId)
    }

    const orderMetaId = req.orderMetaId ?? `orderMeta-${crypto.randomUUID()}`

    const orderMetaDoc = buildOrderMeta({
      items: validatedItems,
      totals,
      selectedShipping,
      shippingVatRate,
      // Pickup: the main fields are the billing address; no shipping address is stored.
      ...(selectedShipping.methodType === 'delivery' && { shippingAddress: req.address.shipping }),
      billingAddress: req.address.billing ?? req.address.shipping,
      contactEmail: req.address.contactEmail,
      locale: req.locale,
      paymentIntentId: '',
      lineDiscounts: discounts.lines,
      appliedDiscounts: buildAppliedDiscountSnapshots(discounts.applied),
      freeShippingReason: freeShippingReason(selectedShipping, waivesShipping(discounts, selectedShipping.methodType)),
    })

    if (req.orderMetaId) {
      const existing = await fetchOrderMeta(req.orderMetaId)
      if (!existing) {
        return errorResponse(ErrorCode.ORDER_META_NOT_FOUND, serverT(req.locale, 'api.errors.orderNotFound'), requestId, 404)
      }

      const intent = await updatePaymentIntent(existing.paymentIntentId, {
        amount: totals.grandTotal,
        metadata: { orderMetaId },
      })

      orderMetaDoc.paymentIntentId = intent.id
      // Replace, not merge: a discount dropped since the last submit (or an old-frontend
      // `appliedCoupons`) must not survive in the stored document.
      await createOrderMeta(orderMetaId, orderMetaDoc)

      log.info('PaymentIntent updated', { paymentIntentId: intent.id, requestId })

      return success<CreatePaymentResponse>({
        ...calculateResponse,
        clientSecret: intent.client_secret!,
        orderMetaId,
      })
    } else {
      const intent = await createPaymentIntent({
        amount: totals.grandTotal,
        currency: 'eur',
        automatic_payment_methods: { enabled: true },
        metadata: { orderMetaId },
      })

      orderMetaDoc.paymentIntentId = intent.id
      await createOrderMeta(orderMetaId, orderMetaDoc)

      log.info('PaymentIntent created', { paymentIntentId: intent.id, orderMetaId, requestId })

      return success<CreatePaymentResponse>({
        ...calculateResponse,
        clientSecret: intent.client_secret!,
        orderMetaId,
      })
    }
  } catch (err) {
    log.error('Payment create failed', {
      requestId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return errorResponse(ErrorCode.INTERNAL_ERROR, serverT(req.locale, 'api.errors.payment.general'), requestId)
  }
  }
}
