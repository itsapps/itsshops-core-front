import { createClient, type SanityClient } from '@sanity/client'
import type {
  SanityCheckoutQueryResult,
  OrderMetaDocument,
  OrderDocument,
  OrderStatusHistoryEntry,
} from '../types/checkout'
import type { Logger } from '../utils/logger'

let sanityClient: SanityClient | null = null

export function getSanityClient(): SanityClient {
  if (!sanityClient) {
    const projectId = process.env.SANITY_PROJECT_ID
    const dataset = process.env.SANITY_DATASET
    const token = process.env.SANITY_TOKEN
    if (!projectId || !dataset || !token) {
      throw new Error('SANITY_PROJECT_ID, SANITY_DATASET, and SANITY_TOKEN must be set')
    }
    sanityClient = createClient({
      projectId,
      dataset,
      token,
      apiVersion: '2024-01-01',
      useCdn: false,
      perspective: 'published',
      maxRetries: 2,
      retryDelay: (attempt) => 1000 * 2 ** attempt,
    })
  }
  return sanityClient
}

const CHECKOUT_QUERY = `{
  "variants": *[_type == "productVariant" && _id in $variantIds]{
    _id, status, kind, title, sku, price, weight, stock,
    "taxCategoryCode": taxCategory->code.current,
    "productTitle": product->title,
    "productWeight": product->weight,
    "productPrice": product->price,
    "productTaxCategoryCode": product->taxCategory->code.current,
    wine,
    options[]->{ title, "groupTitle": group->title },
    bundleItems[]{ quantity, "variant": product->{ _id, title, weight, stock } }
  },
  "taxCountry": *[_type == "taxCountry" && countryCode == $country && enabled == true][0]{
    countryCode,
    rules[]{ "taxCategoryCode": taxCategory->code.current, rate, exciseDuty }
  },
  "shippingMethods": *[_type == "shippingMethod" && references(*[_type == "taxCountry" && countryCode == $country]._id)]{
    _id, title, methodType, pickupFee, freeShippingThreshold,
    "taxCategoryCode": taxCategory->code.current,
    rates[]{ maxWeight, price }
  },
  "shopSettings": *[_type == "shopSettings"][0]{
    "defaultCountryCode": defaultCountry->countryCode,
    freeShippingCalculation,
    "defaultTaxCategoryCode": defaultTaxCategory->code.current,
    orderNumberPrefix, invoiceNumberPrefix, lastInvoiceNumber
  },
  "supportedCountries": *[_type == "taxCountry" && enabled == true]{ countryCode }
}`

export async function fetchCheckoutData(
  variantIds: string[],
  country: string,
  logger: Logger,
): Promise<SanityCheckoutQueryResult> {
  return logger.timed('Sanity: fetch checkout data', () =>
    getSanityClient().fetch<SanityCheckoutQueryResult>(CHECKOUT_QUERY, { variantIds, country }),
  )
}

export async function createOrderMeta(
  id: string,
  doc: OrderMetaDocument,
  logger: Logger,
): Promise<void> {
  await logger.timed('Sanity: create orderMeta', () =>
    getSanityClient().createOrReplace({ _id: id, ...doc }),
  )
}

export async function updateOrderMeta(
  id: string,
  doc: Partial<OrderMetaDocument>,
  logger: Logger,
): Promise<void> {
  await logger.timed('Sanity: update orderMeta', () =>
    getSanityClient().patch(id).set(doc).commit(),
  )
}

export async function fetchOrderMeta(
  id: string,
  logger: Logger,
): Promise<(OrderMetaDocument & { _id: string }) | null> {
  return logger.timed('Sanity: fetch orderMeta', () =>
    getSanityClient().getDocument<OrderMetaDocument & { _id: string }>(id),
  ).then(doc => doc ?? null)
}

export async function createOrder(
  doc: OrderDocument & { _type: 'order' },
  logger: Logger,
): Promise<{ _id: string }> {
  return logger.timed('Sanity: create order', () =>
    getSanityClient().create(doc),
  )
}

export async function incrementInvoiceNumber(
  logger: Logger,
): Promise<number> {
  return logger.timed('Sanity: increment invoice number', async () => {
    const result = await getSanityClient()
      .patch('*[_type == "shopSettings"][0]._id')
      .inc({ lastInvoiceNumber: 1 })
      .commit()
    return (result as any).lastInvoiceNumber as number
  })
}

export async function decrementStock(
  variantId: string,
  quantity: number,
  logger: Logger,
): Promise<void> {
  await logger.timed(`Sanity: decrement stock for ${variantId}`, () =>
    getSanityClient()
      .patch(variantId)
      .dec({ stock: quantity })
      .commit(),
  )
}

export async function updateOrderPaymentStatus(
  paymentIntentId: string,
  status: 'refunded' | 'partiallyRefunded',
  logger: Logger,
): Promise<void> {
  const query = `*[_type == "order" && paymentIntentId == $pid][0]._id`
  const orderId = await getSanityClient().fetch<string | null>(query, { pid: paymentIntentId })
  if (!orderId) {
    logger.warn('Order not found for refund update', { paymentIntentId })
    return
  }

  const historyEntry: Omit<OrderStatusHistoryEntry, '_key'> = {
    _type: 'orderStatusHistory',
    type: 'payment',
    status,
    timestamp: new Date().toISOString(),
    source: 'stripe',
  }

  await logger.timed('Sanity: update order payment status', () =>
    getSanityClient()
      .patch(orderId)
      .set({ paymentStatus: status })
      .append('statusHistory', [{ ...historyEntry, _key: crypto.randomUUID() }])
      .commit(),
  )
}
