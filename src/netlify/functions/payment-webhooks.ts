import type { Context } from '@netlify/functions'
import type Stripe from 'stripe'
import { constructWebhookEvent } from '../services/stripe'
import {
  fetchOrderMeta,
  createOrder,
  decrementStock,
  updateOrderPaymentStatus,
  findOrderByPaymentIntent,
  getNextInvoiceNumber,
} from '../services/sanity'
import { buildOrder, formatOrderNumber } from '../lib/order-builder'
import {
  sendOrderNotification,
  type SendOrderNotificationOptions,
} from '../lib/order-notifier'
import { log } from '../utils/logger'
import type { OrderDocument } from '../types/checkout'
import { type ServerConfig, resolveServerConfig } from '../types/config'

export type WebhookHandlerOptions = ServerConfig & {
  onOrderCreated?: (order: OrderDocument & { _id: string }) => Promise<void>
  /**
   * Template / invoice / baseUrl overrides forwarded to the order-confirmation
   * email sent automatically when an order is created. Same shape as the
   * options passed to `createNotifyHandler`.
   */
  notify?: SendOrderNotificationOptions
}

async function handlePaymentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
  hasStock: boolean,
  onOrderCreated?: WebhookHandlerOptions['onOrderCreated'],
  notifyOptions?: SendOrderNotificationOptions,
): Promise<void> {
  const orderMetaId = paymentIntent.metadata?.orderMetaId
  if (!orderMetaId) {
    log.error('PaymentIntent missing orderMetaId metadata', { paymentIntentId: paymentIntent.id })
    return
  }

  const existingOrder = await findOrderByPaymentIntent(paymentIntent.id)
  if (existingOrder) {
    log.debug('Order already exists, skipping', { orderId: existingOrder })
    return
  }

  const orderMeta = await fetchOrderMeta(orderMetaId)
  if (!orderMeta) {
    log.error('OrderMeta not found', { orderMetaId })
    return
  }

  const { invoiceNumber, orderNumberPrefix, invoiceNumberPrefix } = await getNextInvoiceNumber()

  const orderDoc = buildOrder({
    orderMeta,
    orderNumber: formatOrderNumber(orderNumberPrefix, invoiceNumber),
    invoiceNumber: formatOrderNumber(invoiceNumberPrefix, invoiceNumber),
  })

  const created = await createOrder(orderDoc)
  log.info('Order created', { orderId: created._id, orderNumber: orderDoc.orderNumber })

  if (hasStock) {
    for (const item of orderDoc.orderItems) {
      if (item.variantId) {
        await decrementStock(item.variantId, item.quantity)
      }
    }
  }

  // Send the order confirmation email. Failures here must NOT abort the
  // webhook (Stripe would retry and we'd duplicate the order) — log and move on.
  try {
    const result = await sendOrderNotification(created._id, 'orderConfirmation', {
      ...notifyOptions,
      bccSender: true,
    })
    log.info('Order confirmation sent', {
      orderId: created._id,
      to: result.to,
      messageId: result.messageId,
    })
  } catch (err) {
    log.error('Order confirmation failed', {
      orderId: created._id,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  if (onOrderCreated) {
    try {
      await onOrderCreated({ ...orderDoc, _id: created._id })
    } catch (err) {
      log.error('onOrderCreated hook failed', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
}

async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const paymentIntentId = typeof charge.payment_intent === 'string'
    ? charge.payment_intent
    : charge.payment_intent?.id

  if (!paymentIntentId) {
    log.warn('Charge has no payment_intent', { chargeId: charge.id })
    return
  }

  const status = charge.amount_refunded === charge.amount ? 'refunded' as const : 'partiallyRefunded' as const
  await updateOrderPaymentStatus(paymentIntentId, status)
  log.info('Order payment status updated', { paymentIntentId, status })
}

export function createWebhookHandler(options: WebhookHandlerOptions = {}) {
  const { hasStock } = resolveServerConfig(options)

  return async (request: Request, _context: Context): Promise<void> => {
    if (request.method !== 'POST') return

    const signature = request.headers.get('stripe-signature')
    if (!signature) {
      log.warn('Missing stripe-signature header')
      return
    }

    let body: string
    try {
      body = await request.text()
    } catch {
      log.warn('Failed to read request body')
      return
    }

    try {
      const event = constructWebhookEvent(body, signature)

      switch (event.type) {
        case 'payment_intent.succeeded':
          await handlePaymentSucceeded(
            event.data.object as Stripe.PaymentIntent,
            hasStock,
            options.onOrderCreated,
            options.notify,
          )
          break
        case 'charge.refunded':
          await handleChargeRefunded(event.data.object as Stripe.Charge)
          break
      }
    } catch (err) {
      log.error('Webhook error', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      })
    }
  }
}
