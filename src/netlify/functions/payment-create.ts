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
import type { SanityCheckoutQueryResult, AppliedCouponSnapshot } from '../types/checkout'
import { fetchCheckoutData, createOrderMeta, updateOrderMeta, fetchOrderMeta } from '../services/sanity'
import { createPaymentIntent, updatePaymentIntent } from '../services/stripe'
import { validateCart } from '../lib/cart-validator'
import { resolveShippingMethods, selectShippingMethod } from '../lib/shipping'
import { calculateTotals, type CouponDiscount } from '../lib/totals'
import { dominantItemVatRate } from '../lib/tax'
import { buildOrderMeta } from '../lib/order-builder'
import { validateCoupon, buildAppliedCouponSnapshot } from '../lib/coupon'
import { serverT, countryName } from '../utils/i18n'
import { type ServerConfig, resolveServerConfig } from '../types/config'

export function createPaymentHandler(config: ServerConfig = {}) {
  const { defaultLocale, hasStock, hasCoupons } = resolveServerConfig(config)

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

    // ── Validate tax country ────────────────────────────────────────────
    if (!data.taxCountry) {
      return validationError(ErrorCode.SHIPPING_UNAVAILABLE, serverT(req.locale, 'api.errors.validation.countryShippingNotSupported'), requestId)
    }

    // ── Validate cart items ─────────────────────────────────────────────
    const defaultTaxCategoryCode = data.shopSettings?.defaultTaxCategoryCode ?? null
    const { items: validatedItems, unavailableItems } = validateCart(
      req.cart.items,
      data.variants,
      data.taxCountry.rules,
      req.locale,
      defaultLocale,
      hasStock,
      defaultTaxCategoryCode,
    )

    if (validatedItems.length === 0) {
      return validationError(ErrorCode.CART_EMPTY, serverT(req.locale, 'api.errors.payment.noValidProducts'), requestId, {
        unavailable: unavailableItems.join(', '),
      })
    }

    // ── Calculate shipping ──────────────────────────────────────────────
    const subtotal = validatedItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const freeShippingCalc = data.shopSettings?.freeShippingCalculation ?? 'afterDiscount'

    const shippingMethods = resolveShippingMethods(
      data.shippingMethods,
      validatedItems,
      subtotal,
      0,
      freeShippingCalc,
      req.locale,
    )

    const selectedShipping = selectShippingMethod(shippingMethods, req.shippingMethodId)

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
        appliedCoupons = [{
          code: result.coupon.code,
          discountType: result.coupon.discountType,
          value: result.coupon.value,
          discountAmount: result.discountAmount,
        }]
        appliedCouponSnapshots = [
          buildAppliedCouponSnapshot(result.coupon, result.discountAmount),
        ]
      } else {
        couponError = {
          code: result.code,
          errorCode: result.errorCode,
          message: serverT(req.locale, `api.errors.coupon.${result.errorCode}`),
        }
      }
    }

    // ── Calculate totals ────────────────────────────────────────────────
    // Shipping VAT follows the "dominant goods" rule: use the rate that
    // contributes the most VAT across cart items (AT tax practice).
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
        price: m.price,
        isFree: m.isFree,
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
      shippingAddress: req.address.shipping,
      billingAddress: req.address.billing ?? req.address.shipping,
      contactEmail: req.address.contactEmail,
      locale: req.locale,
      paymentIntentId: '',
      appliedCoupons: appliedCouponSnapshots,
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
