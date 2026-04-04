import { createClient } from '@sanity/client'
import { sanityApiVersion } from '../../config/constants'
import { log } from '../utils/logger'
import type {
  SanityCheckoutQueryResult,
  OrderMetaDocument,
  OrderDocument,
  OrderStatusHistoryEntry,
} from '../types/checkout'

function initSanityClient() {
  const projectId = process.env.SANITY_PROJECT_ID
  const dataset = process.env.SANITY_DATASET
  const token = process.env.SANITY_TOKEN
  if (!projectId || !dataset || !token) {
    throw new Error('SANITY_PROJECT_ID, SANITY_DATASET, and SANITY_TOKEN must be set')
  }
  return createClient({
    projectId,
    dataset,
    token,
    apiVersion: sanityApiVersion,
    useCdn: false,
    perspective: 'published',
    maxRetries: 2,
    retryDelay: (attempt) => 1000 * 2 ** attempt,
  })
}

const sanityClient = initSanityClient()

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

export function fetchCheckoutData(
  variantIds: string[],
  country: string,
): Promise<SanityCheckoutQueryResult> {
  return sanityClient.fetch<SanityCheckoutQueryResult>(CHECKOUT_QUERY, { variantIds, country })
}

export async function createOrderMeta(
  id: string,
  doc: OrderMetaDocument,
): Promise<void> {
  await sanityClient.createOrReplace({ _id: id, ...doc })
}

export async function updateOrderMeta(
  id: string,
  doc: Partial<OrderMetaDocument>,
): Promise<void> {
  await sanityClient.patch(id).set(doc).commit()
}

export async function fetchOrderMeta(
  id: string,
): Promise<(OrderMetaDocument & { _id: string }) | null> {
  const doc = await sanityClient.getDocument<OrderMetaDocument & { _id: string }>(id)
  return doc ?? null
}

export async function createOrder(
  doc: OrderDocument & { _type: 'order' },
): Promise<{ _id: string }> {
  return sanityClient.create(doc)
}

export async function decrementStock(
  variantId: string,
  quantity: number,
): Promise<void> {
  await sanityClient
    .patch(variantId)
    .dec({ stock: quantity })
    .commit()
}

export async function findOrderByPaymentIntent(
  paymentIntentId: string,
): Promise<string | null> {
  return sanityClient.fetch<string | null>(
    `*[_type == "order" && paymentIntentId == $pid][0]._id`,
    { pid: paymentIntentId },
  )
}

export async function getNextInvoiceNumber(): Promise<{
  invoiceNumber: number
  orderNumberPrefix: string | null
  invoiceNumberPrefix: string | null
}> {
  const settings = await sanityClient.fetch<{
    _id: string
    lastInvoiceNumber: number
    orderNumberPrefix?: string
    invoiceNumberPrefix?: string
  } | null>(
    `*[_type == "shopSettings"][0]{ _id, lastInvoiceNumber, orderNumberPrefix, invoiceNumberPrefix }`,
  )
  if (!settings?._id) throw new Error('shopSettings not found')
  const result = await sanityClient.patch(settings._id).inc({ lastInvoiceNumber: 1 }).commit()
  return {
    invoiceNumber: (result as any).lastInvoiceNumber,
    orderNumberPrefix: settings.orderNumberPrefix ?? null,
    invoiceNumberPrefix: settings.invoiceNumberPrefix ?? null,
  }
}

export async function updateOrderPaymentStatus(
  paymentIntentId: string,
  status: 'refunded' | 'partiallyRefunded',
): Promise<void> {
  const orderId = await sanityClient.fetch<string | null>(
    `*[_type == "order" && paymentIntentId == $pid][0]._id`,
    { pid: paymentIntentId },
  )
  if (!orderId) {
    log.warn('Order not found for refund update', { paymentIntentId })
    return
  }

  const historyEntry: Omit<OrderStatusHistoryEntry, '_key'> = {
    _type: 'orderStatusHistory',
    type: 'payment',
    status,
    timestamp: new Date().toISOString(),
    source: 'stripe',
  }

  await sanityClient
    .patch(orderId)
    .set({ paymentStatus: status })
    .append('statusHistory', [{ ...historyEntry, _key: crypto.randomUUID() }])
    .commit()
}
