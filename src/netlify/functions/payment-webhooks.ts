import type { Context } from '@netlify/functions'
import type Stripe from 'stripe'
import type { SanityClient } from '@sanity/client'
import { constructWebhookEvent } from '../services/stripe'
import {
  fetchOrderMeta,
  createOrder,
  decrementStock,
  updateOrderPaymentStatus,
  getSanityClient,
} from '../services/sanity-checkout'
import { buildOrder, formatOrderNumber } from '../lib/order-builder'
import { errorResponse, methodNotAllowed, success } from '../utils/response'
import { createLogger, generateRequestId } from '../utils/logger'
import { ErrorCode } from '../types/errors'
import type { OrderDocument } from '../types/checkout'

export type WebhookHandlerOptions = {
  onOrderCreated?: (order: OrderDocument & { _id: string }, sanityClient: SanityClient) => Promise<void>
}

async function getNextInvoiceNumber(client: SanityClient): Promise<{
  invoiceNumber: number
  orderNumberPrefix: string | null
  invoiceNumberPrefix: string | null
}> {
  // Atomically increment lastInvoiceNumber
  const settings = await client.fetch(
    `*[_type == "shopSettings"][0]{ _id, lastInvoiceNumber, orderNumberPrefix, invoiceNumberPrefix }`,
  )
  if (!settings?._id) throw new Error('shopSettings not found')

  const result = await client.patch(settings._id).inc({ lastInvoiceNumber: 1 }).commit()

  return {
    invoiceNumber: (result as any).lastInvoiceNumber,
    orderNumberPrefix: settings.orderNumberPrefix ?? null,
    invoiceNumberPrefix: settings.invoiceNumberPrefix ?? null,
  }
}

async function handlePaymentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
  options: WebhookHandlerOptions,
  logger: ReturnType<typeof createLogger>,
): Promise<void> {
  const orderMetaId = paymentIntent.metadata?.orderMetaId
  if (!orderMetaId) {
    logger.error('PaymentIntent missing orderMetaId metadata', { id: paymentIntent.id })
    return
  }

  // Check if order already exists (idempotency)
  const client = getSanityClient()
  const existingOrder = await client.fetch<string | null>(
    `*[_type == "order" && paymentIntentId == $pid][0]._id`,
    { pid: paymentIntent.id },
  )
  if (existingOrder) {
    logger.info('Order already exists, skipping', { orderId: existingOrder })
    return
  }

  // Fetch orderMeta
  const orderMeta = await fetchOrderMeta(orderMetaId, logger)
  if (!orderMeta) {
    logger.error('OrderMeta not found', { orderMetaId })
    return
  }

  // Generate order and invoice numbers
  const { invoiceNumber, orderNumberPrefix, invoiceNumberPrefix } = await getNextInvoiceNumber(client)

  const orderDoc = buildOrder({
    orderMeta,
    orderNumber: formatOrderNumber(orderNumberPrefix, invoiceNumber),
    invoiceNumber: formatOrderNumber(invoiceNumberPrefix, invoiceNumber),
  })

  // Create order
  const created = await createOrder(orderDoc, logger)
  logger.info('Order created', {
    orderId: created._id,
    orderNumber: orderDoc.orderNumber,
  })

  // Decrement stock for each item
  for (const item of orderDoc.orderItems) {
    if (item.variantId) {
      await decrementStock(item.variantId, item.quantity, logger)
    }
  }

  // Call customer hook
  if (options.onOrderCreated) {
    try {
      await options.onOrderCreated({ ...orderDoc, _id: created._id }, client)
    } catch (err) {
      logger.error('onOrderCreated hook failed', {
        error: err instanceof Error ? err.message : String(err),
      })
      // Don't re-throw — order is already created
    }
  }
}

async function handleChargeRefunded(
  charge: Stripe.Charge,
  logger: ReturnType<typeof createLogger>,
): Promise<void> {
  const paymentIntentId = typeof charge.payment_intent === 'string'
    ? charge.payment_intent
    : charge.payment_intent?.id

  if (!paymentIntentId) {
    logger.warn('Charge has no payment_intent', { chargeId: charge.id })
    return
  }

  const isFullRefund = charge.amount_refunded === charge.amount
  const status = isFullRefund ? 'refunded' as const : 'partiallyRefunded' as const

  await updateOrderPaymentStatus(paymentIntentId, status, logger)
  logger.info('Order payment status updated', { paymentIntentId, status })
}

export function createWebhookHandler(options: WebhookHandlerOptions = {}) {
  return async (request: Request, _context: Context): Promise<Response> => {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204 })
    }
    if (request.method !== 'POST') {
      return methodNotAllowed()
    }

    const requestId = generateRequestId()
    const logger = createLogger('webhook', requestId)

    const signature = request.headers.get('stripe-signature')
    if (!signature) {
      logger.warn('Missing stripe-signature header')
      return errorResponse(ErrorCode.WEBHOOK_SIGNATURE_INVALID, 'Missing stripe-signature header', 401)
    }

    let body: string
    try {
      body = await request.text()
    } catch {
      return errorResponse(ErrorCode.INVALID_INPUT, 'Failed to read request body', 400)
    }

    try {
      const event = constructWebhookEvent(body, signature)
      logger.info('Webhook event received', { type: event.type, id: event.id })

      switch (event.type) {
        case 'payment_intent.succeeded':
          await handlePaymentSucceeded(
            event.data.object as Stripe.PaymentIntent,
            options,
            logger,
          )
          break

        case 'charge.refunded':
          await handleChargeRefunded(
            event.data.object as Stripe.Charge,
            logger,
          )
          break

        default:
          logger.info('Unhandled event type, acknowledging', { type: event.type })
      }

      return success({ received: true })
    } catch (err) {
      if (err instanceof Error && err.message.includes('signature')) {
        logger.warn('Invalid webhook signature')
        return errorResponse(ErrorCode.WEBHOOK_SIGNATURE_INVALID, 'Invalid signature', 401)
      }
      logger.error('Webhook error', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      })
      return errorResponse(ErrorCode.INTERNAL_ERROR, 'Webhook processing failed')
    }
  }
}
