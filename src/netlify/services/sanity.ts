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

export const sanityClient = initSanityClient()

const CHECKOUT_QUERY = `{
  "variants": *[_type == "productVariant" && _id in $variantIds]{
    _id, status, kind, title, sku, price, weight, stock,
    "productId": product->._id,
    "taxCategoryCode": taxCategory->code.current,
    "productTitle": product->title,
    "productWeight": product->weight,
    "productPrice": product->price,
    "productTaxCategoryCode": product->taxCategory->code.current,
    wine,
    options[]->{ title, "groupTitle": group->title },
    bundleItems[]{
      quantity,
      "variant": product->{
        _id, kind, title, weight, stock, wine,
        "productWeight": product->weight
      }
    }
  },
  "taxCountry": *[_type == "taxCountry" && countryCode == $country && enabled == true][0]{
    countryCode,
    rules[]{ "taxCategoryCode": taxCategory->code.current, rate }
  },
  "shippingMethods": *[_type == "shippingMethod" && references(*[_type == "taxCountry" && countryCode == $country]._id)]{
    _id, title, methodType, pickupFee, freeShippingThreshold,
    "taxCategoryCode": taxCategory->code.current,
    rates[]{ maxWeight, price },
    packagingConfigs[]{ volume, packages[]{ count, price } }
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

export async function fetchOrderById(
  id: string,
): Promise<(OrderDocument & { _id: string; _createdAt: string; _updatedAt: string }) | null> {
  const doc = await sanityClient.getDocument<
    OrderDocument & { _id: string; _createdAt: string; _updatedAt: string }
  >(id)
  return doc ?? null
}

export type EmailSettingsQueryResult = {
  shopName: string | null
  senderName: string | null
  senderEmail: string | null
  billingAddress: {
    line1: string | null
    line2: string | null
    zip: string | null
    city: string | null
    country: string | null
  } | null
  bankAccount: {
    name: string | null
    bic: string | null
    iban: string | null
  } | null
  orderNumberPrefix: string | null
  invoiceNumberPrefix: string | null
}

/**
 * Fetch the data required to render an email: shop settings (sender, address,
 * bank account, prefixes) plus the localized shop name from the general
 * `settings.siteTitle` field.
 *
 * Locale is needed because `siteTitle` and `billingAddress.city` are i18nString
 * arrays — we resolve them via array-find for the requested locale, falling
 * back to `de`.
 */
export async function fetchEmailSettings(
  locale: string,
): Promise<EmailSettingsQueryResult | null> {
  return sanityClient.fetch<EmailSettingsQueryResult | null>(
    `{
      "shop": *[_type == "shopSettings"][0]{
        senderName,
        senderEmail,
        orderNumberPrefix,
        invoiceNumberPrefix,
        billingAddress{
          line1,
          line2,
          "city": coalesce(city[language == $locale][0].value, city[language == "de"][0].value),
          zip,
          country
        },
        bankAccount{ name, bic, iban }
      },
      "site": *[_type == "settings"][0]{
        "shopName": coalesce(siteTitle[language == $locale][0].value, siteTitle[language == "de"][0].value)
      }
    }{
      "shopName": site.shopName,
      "senderName": shop.senderName,
      "senderEmail": shop.senderEmail,
      "billingAddress": shop.billingAddress,
      "bankAccount": shop.bankAccount,
      "orderNumberPrefix": shop.orderNumberPrefix,
      "invoiceNumberPrefix": shop.invoiceNumberPrefix
    }`,
    { locale },
  )
}

export type CustomerDocument = {
  _type: 'customer'
  email: string
  locale: string
  supabaseId: string
  status: 'registered' | 'invited' | 'active'
  customerNumber: string
  receiveNewsletter: boolean
  address?: {
    prename?: string
    lastname?: string
    phone?: string
    line1?: string
    line2?: string
    zip?: string
    city?: string
    country?: string
    state?: string
  }
}

export async function getCustomer(supabaseId: string): Promise<(CustomerDocument & { _id: string }) | null> {
  const doc = await sanityClient.fetch<(CustomerDocument & { _id: string }) | null>(
    `*[_type == "customer" && supabaseId == $supabaseId][0]`,
    { supabaseId },
  )
  return doc ?? null
}

export async function createCustomer(doc: CustomerDocument): Promise<{ _id: string }> {
  return sanityClient.create(doc)
}

export async function upsertCustomer(
  supabaseId: string,
  doc: Omit<CustomerDocument, '_type' | 'supabaseId' | 'customerNumber'>,
): Promise<void> {
  const existing = await getCustomer(supabaseId)
  if (existing) {
    await sanityClient
      .patch(existing._id)
      .set({ receiveNewsletter: doc.receiveNewsletter, status: doc.status })
      .setIfMissing({
        email: doc.email,
        locale: doc.locale,
        ...doc.address?.prename && { 'address.prename': doc.address.prename },
        ...doc.address?.lastname && { 'address.lastname': doc.address.lastname },
        ...doc.address?.phone && { 'address.phone': doc.address.phone },
      })
      .commit()
  } else {
    const customerNumber = await getLatestCustomerNumber()
    await createCustomer({ _type: 'customer', supabaseId, customerNumber, ...doc })
  }
}

export async function getLatestCustomerNumber(): Promise<string> {
  const latest = await sanityClient.fetch<{ customerNumber: string } | null>(
    `*[_type == "customer"] | order(customerNumber desc)[0]{ customerNumber }`,
  )
  const last = parseInt(latest?.customerNumber ?? '10000', 10)
  return String(last + 1)
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
