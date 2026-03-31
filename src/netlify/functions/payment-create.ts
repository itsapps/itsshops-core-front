import type { Context } from '@netlify/functions'
import { validatePaymentRequest } from '../utils/validation'
import { success, validationError, errorResponse, methodNotAllowed, badRequest } from '../utils/response'
import { createLogger, generateRequestId } from '../utils/logger'
import { ErrorCode } from '../types/errors'
import type { PaymentCreateRequest, CalculateResponse, CreatePaymentResponse, ValidatedCartItemResponse } from '../types/api'
import type { SanityCheckoutQueryResult } from '../types/checkout'
import { fetchCheckoutData, createOrderMeta, updateOrderMeta } from '../services/sanity-checkout'
import { createPaymentIntent, updatePaymentIntent } from '../services/stripe'
import { validateCart } from '../lib/cart-validator'
import { resolveShippingMethods, selectShippingMethod } from '../lib/shipping'
import { calculateTotals } from '../lib/totals'
import { findTaxRate } from '../lib/tax'
import { buildOrderMeta } from '../lib/order-builder'

export type PaymentCreateParams = {
  request: Request
  context: Context
}

export const paymentCreate = async ({ request }: PaymentCreateParams): Promise<Response> => {
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

  const requestId = generateRequestId()
  const logger = createLogger('payment-create', requestId)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest('Invalid JSON body')
  }

  const validation = validatePaymentRequest(body)
  if (!validation.valid) {
    logger.warn('Validation failed', { message: validation.message })
    return validationError(ErrorCode.INVALID_INPUT, validation.message, validation.details)
  }

  const req = body as PaymentCreateRequest
  logger.info('Request received', {
    createPayment: req.createPayment,
    locale: req.locale,
    itemCount: req.cart.items.length,
  })

  try {
    // ── Determine country ───────────────────────────────────────────────
    const requestedCountry = req.partialAddress?.country
      ?? req.address?.shipping.country
      ?? null

    // We need a first fetch to get shopSettings.defaultCountryCode if no country provided
    const variantIds = req.cart.items.map(i => i.variantId)
    const initialCountry = requestedCountry ?? 'AT' // temporary fallback for first query

    // ── Fetch all checkout data in one GROQ query ───────────────────────
    let data: SanityCheckoutQueryResult = await fetchCheckoutData(variantIds, initialCountry, logger)

    // Resolve the actual country: requested → shopSettings default → AT
    const country = requestedCountry
      ?? data.shopSettings?.defaultCountryCode
      ?? 'AT'

    // If the resolved country differs from what we queried, re-fetch
    if (country !== initialCountry) {
      data = await fetchCheckoutData(variantIds, country, logger)
    }

    // ── Validate tax country ────────────────────────────────────────────
    if (!data.taxCountry) {
      logger.warn('Country not supported', { country })
      return validationError(ErrorCode.SHIPPING_UNAVAILABLE, `Country ${country} is not supported for checkout`)
    }

    // ── Validate cart items ─────────────────────────────────────────────
    const { items: validatedItems, unavailableItems } = validateCart(
      req.cart.items,
      data.variants,
      data.taxCountry.rules,
      req.locale,
    )

    if (validatedItems.length === 0) {
      return validationError(ErrorCode.CART_EMPTY, 'No valid items in cart', {
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
      0, // discount — not implemented yet
      freeShippingCalc,
      req.locale,
    )

    const selectedShipping = selectShippingMethod(shippingMethods, req.shippingMethodId)

    if (!selectedShipping && shippingMethods.length === 0) {
      logger.warn('No shipping methods available', { country })
      return validationError(ErrorCode.SHIPPING_UNAVAILABLE, 'No shipping methods available for this country')
    }

    // ── Calculate totals ────────────────────────────────────────────────
    const shippingVatRate = selectedShipping
      ? findTaxRate(data.taxCountry.rules, selectedShipping.taxCategoryCode)
      : 0

    const totals = calculateTotals(validatedItems, selectedShipping, shippingVatRate)

    // ── Build response items ────────────────────────────────────────────
    const responseItems: ValidatedCartItemResponse[] = validatedItems.map(item => {
      const cartItem = req.cart.items.find(ci => ci.variantId === item.variantId)
      return {
        variantId: item.variantId,
        kind: item.kind,
        title: item.title,
        variantTitle: item.variantTitle,
        price: item.price,
        quantity: item.quantity,
        requestedQuantity: cartItem?.quantity ?? item.quantity,
        stock: null, // don't expose exact stock to client
        imageUrl: null, // client already has this from cart store
        weight: item.weight,
      }
    })

    // ── Supported countries ─────────────────────────────────────────────
    const supportedCountries = data.supportedCountries.map(c => ({
      code: c.countryCode,
      title: c.countryCode, // client maps codes to names
    }))

    // ── Calculate-only response ─────────────────────────────────────────
    const calculateResponse: CalculateResponse = {
      items: responseItems,
      unavailableItems,
      totals: {
        subtotal: totals.subtotal,
        shipping: totals.shipping,
        tax: totals.tax,
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
    }

    if (!req.createPayment) {
      logger.info('Calculate complete', {
        itemCount: validatedItems.length,
        grandTotal: totals.grandTotal,
      })
      return success(calculateResponse)
    }

    // ── Create payment ──────────────────────────────────────────────────
    if (!req.address) {
      return validationError(ErrorCode.INVALID_ADDRESS, 'Address is required for payment')
    }

    if (!selectedShipping) {
      return validationError(ErrorCode.SHIPPING_UNAVAILABLE, 'A shipping method must be selected')
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
      paymentIntentId: '', // will be set after Stripe call
    })

    // Create or update Stripe PaymentIntent
    if (req.orderMetaId) {
      // Update existing PaymentIntent
      const existingMeta = await fetchCheckoutData([], country, logger)
        .catch(() => null)

      // Find existing payment intent ID from orderMeta
      const { fetchOrderMeta } = await import('../services/sanity-checkout')
      const existing = await fetchOrderMeta(req.orderMetaId, logger)
      if (!existing) {
        return errorResponse(ErrorCode.ORDER_META_NOT_FOUND, 'Order meta not found', 404)
      }

      const intent = await updatePaymentIntent(
        existing.paymentIntentId,
        {
          amount: totals.grandTotal,
          metadata: { orderMetaId },
        },
        logger,
      )

      orderMetaDoc.paymentIntentId = intent.id
      await updateOrderMeta(orderMetaId, orderMetaDoc, logger)

      const createResponse: CreatePaymentResponse = {
        ...calculateResponse,
        clientSecret: intent.client_secret!,
        orderMetaId,
      }

      logger.info('PaymentIntent updated', {
        paymentIntentId: intent.id,
        amount: totals.grandTotal,
      })

      return success(createResponse)
    } else {
      // Create new PaymentIntent
      const intent = await createPaymentIntent(
        {
          amount: totals.grandTotal,
          currency: 'eur',
          automatic_payment_methods: { enabled: true },
          metadata: { orderMetaId },
        },
        logger,
      )

      orderMetaDoc.paymentIntentId = intent.id
      await createOrderMeta(orderMetaId, orderMetaDoc, logger)

      const createResponse: CreatePaymentResponse = {
        ...calculateResponse,
        clientSecret: intent.client_secret!,
        orderMetaId,
      }

      logger.info('PaymentIntent created', {
        paymentIntentId: intent.id,
        orderMetaId,
        amount: totals.grandTotal,
      })

      return success(createResponse)
    }
  } catch (err) {
    logger.error('Unhandled error', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return errorResponse(ErrorCode.INTERNAL_ERROR, 'An unexpected error occurred')
  }
}
