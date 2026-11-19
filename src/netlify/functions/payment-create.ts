import type { Context } from '@netlify/functions'
import { validatePaymentRequest } from '../utils/validation'
import { success, validationError, errorResponse, methodNotAllowed, badRequest } from '../utils/response'
import { log } from '../utils/logger'
import { ErrorCode } from '../types/errors'
import type {
  PaymentCreateRequest,
  CalculateResponse,
  CreatePaymentResponse,
  ValidatedCartItemResponse,
  AppliedCouponResponse,
  CouponErrorResponse,
} from '../types/api'
import type { SanityCheckoutQueryResult, SanityShippingMethodResult, AppliedCouponSnapshot } from '../types/checkout'
import { fetchCheckoutData, createOrderMeta, updateOrderMeta, fetchOrderMeta } from '../services/sanity'
import { createPaymentIntent, updatePaymentIntent } from '../services/stripe'
import { validateCart } from '../lib/cart-validator'
import { freeShippingReason, resolveShippingMethods, selectShippingMethod } from '../lib/shipping'
import { calculateTotals, type CouponDiscount } from '../lib/totals'
import { dominantItemVatRate } from '../lib/tax'
import { buildOrderMeta } from '../lib/order-builder'
import { validateCoupon, buildAppliedCouponSnapshot } from '../lib/coupon'
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
    )

    if (validatedItems.length === 0) {
      return validationError(ErrorCode.CART_EMPTY, serverT(req.locale, 'api.errors.payment.noValidProducts'), requestId, {
        unavailable: unavailableItems.join(', '),
      })
    }

    // ── Calculate shipping ──────────────────────────────────────────────
    const subtotal = validatedItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const freeShippingCalc = data.shopSettings?.freeShippingCalculation ?? 'beforeDiscount'

    // Pass 1: resolve with discount=0 so we have a shipping price to feed the
    // coupon validator (free-shipping coupons need it).
    let shippingMethods = resolveShippingMethods(
      methodsIn,
      validatedItems,
      subtotal,
      0,
      freeShippingCalc,
      req.locale,
    )

    const requestedMethodId = pickup?._id ?? req.shippingMethodId
    let selectedShipping = selectShippingMethod(shippingMethods, requestedMethodId)

    if (!selectedShipping && shippingMethods.length === 0) {
      return validationError(ErrorCode.SHIPPING_UNAVAILABLE, serverT(req.locale, 'api.errors.shipping.noSupportedShippingCountries'), requestId)
    }

    // ── Validate coupon (if any) ────────────────────────────────────────
    let appliedCoupons: AppliedCouponResponse[] = []
    let appliedCouponSnapshots: AppliedCouponSnapshot[] = []
    let couponDiscount: CouponDiscount | null = null
    let couponError: CouponErrorResponse | null = null

    if (couponCode) {
      const result = validateCoupon(
        couponCode,
        data.coupon,
        subtotal,
        selectedShipping?.price ?? 0,
      )
      if (result.ok) {
        couponDiscount = {
          discountAmount: result.discountAmount,
          zeroShipping: result.zeroShipping,
        }
        // For freeShipping coupons, the monetary discount is the shipping cost
        // that was waived — use that for display so the summary shows the actual
        // saving (e.g. "-7,00€") rather than "-0,00€".
        const displayDiscountAmount = result.zeroShipping
          ? (selectedShipping?.price ?? 0)
          : result.discountAmount
        appliedCoupons = [{
          code: result.coupon.code,
          discountType: result.coupon.discountType,
          value: result.coupon.value,
          discountAmount: displayDiscountAmount,
        }]
        appliedCouponSnapshots = [
          buildAppliedCouponSnapshot(result.coupon, displayDiscountAmount),
        ]
      } else {
        couponError = {
          code: result.code,
          errorCode: result.errorCode,
          message: serverT(req.locale, `api.errors.coupon.${result.errorCode}`),
        }
      }
    }

    // Pass 2: when a percent/fixed coupon is applied AND shop uses
    // `afterDiscount` free-shipping, re-resolve so the threshold check sees
    // the post-discount subtotal. Pure local recomputation, no extra fetch.
    if (couponDiscount && freeShippingCalc === 'afterDiscount' && couponDiscount.discountAmount > 0) {
      shippingMethods = resolveShippingMethods(
        methodsIn,
        validatedItems,
        subtotal,
        couponDiscount.discountAmount,
        freeShippingCalc,
        req.locale,
      )
      selectedShipping = selectShippingMethod(shippingMethods, requestedMethodId)
    }

    // ── Calculate totals ────────────────────────────────────────────────
    // Shipping VAT follows the "dominant goods": the rate whose items have the
    // largest gross goods value (sum of shop prices).
    const shippingVatRate = selectedShipping ? dominantItemVatRate(validatedItems) : 0

    const totals = calculateTotals(validatedItems, selectedShipping, shippingVatRate, couponDiscount)

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
        price: couponDiscount?.zeroShipping ? 0 : m.price,
        isFree: couponDiscount?.zeroShipping ? true : m.isFree,
        ...(m.deliveryTime && { deliveryTime: m.deliveryTime }),
        ...(m.pickupAddress && { pickupAddress: m.pickupAddress }),
        ...(m.pickupInstructions && { pickupInstructions: m.pickupInstructions }),
        ...(m.pickupHoldDays && { pickupHoldDays: m.pickupHoldDays }),
      })),
      selectedShippingMethodId: selectedShipping?._id ?? null,
      selectedCountry: country,
      supportedCountries,
      currency: 'EUR',
      appliedCoupons,
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
      appliedCoupons: appliedCouponSnapshots,
      freeShippingReason: freeShippingReason(selectedShipping, !!couponDiscount?.zeroShipping),
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
      await updateOrderMeta(orderMetaId, orderMetaDoc)

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
