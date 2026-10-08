import { createClient } from '@sanity/client'
import { sanityApiVersion } from '../../config/constants'
import { log } from '../utils/logger'
import type { WithdrawalPeriodStart } from '../../shared/withdrawal-instructions'
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
    "productId": product._ref,
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
    _id, title, deliveryTime, methodType, pickupFee, freeShippingThreshold,
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
  "supportedCountries": *[_type == "taxCountry" && enabled == true]{ countryCode },
  "coupon": *[_type == "coupon" && $couponEnabled && defined($couponCode) && code == $couponCode][0]{
    _id, code, enabled, discountType, value,
    validFrom, validTo, minSubtotal, maxRedemptions, redemptionCount
  }
}`

export function fetchCheckoutData(
  variantIds: string[],
  country: string,
  couponCode?: string | null,
  couponEnabled = false,
): Promise<SanityCheckoutQueryResult> {
  return sanityClient.fetch<SanityCheckoutQueryResult>(CHECKOUT_QUERY, {
    variantIds,
    country,
    couponCode: couponCode ?? null,
    couponEnabled,
  })
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

export type CommitOrderInput = {
  doc: OrderDocument & { _type: 'order' }
  stockDecrements: { variantId: string; quantity: number }[]
  couponIncrements: { couponId: string; by: number }[]
}

/**
 * Atomically create the order, decrement stock on each variant, and bump
 * redemptionCount on each applied coupon. One Sanity round trip.
 */
export async function commitOrderTransaction(
  input: CommitOrderInput,
): Promise<{ _id: string }> {
  const newOrderId = `order-${crypto.randomUUID()}`
  const tx = sanityClient.transaction().create({ _id: newOrderId, ...input.doc })

  for (const { variantId, quantity } of input.stockDecrements) {
    tx.patch(variantId, (p) => p.dec({ stock: quantity }))
  }
  for (const { couponId, by } of input.couponIncrements) {
    tx.patch(couponId, (p) => p.inc({ redemptionCount: by }))
  }

  await tx.commit()
  return { _id: newOrderId }
}

export async function findOrderByPaymentIntent(
  paymentIntentId: string,
): Promise<string | null> {
  return sanityClient.fetch<string | null>(
    `*[_type == "order" && paymentIntentId == $pid][0]._id`,
    { pid: paymentIntentId },
  )
}

export async function fetchOrderNumberByPaymentIntent(
  paymentIntentId: string,
): Promise<string | null> {
  return sanityClient.fetch<string | null>(
    `*[_type == "order" && paymentIntentId == $pid][0].orderNumber`,
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

export type OrderWithdrawalLookup = {
  _id: string
  orderNumber: string
  createdAt: string
  /** Order fulfillment status — drives whether the confirmation asks for a return. */
  status: string
  customer: {
    contactEmail: string
    locale: string
    name: string
  }
}

const ORDER_LOOKUP_PROJECTION = `{
  _id,
  orderNumber,
  status,
  "createdAt": _createdAt,
  "customer": {
    "contactEmail": customer.contactEmail,
    "locale": customer.locale,
    "name": customer.billingAddress.name
  }
}`

/** Look up an order by its human order number (for the withdrawal endpoint). */
export async function fetchOrderByNumber(
  orderNumber: string,
): Promise<OrderWithdrawalLookup | null> {
  const doc = await sanityClient.fetch<OrderWithdrawalLookup | null>(
    `*[_type == "order" && orderNumber == $orderNumber][0]${ORDER_LOOKUP_PROJECTION}`,
    { orderNumber },
  )
  return doc ?? null
}

const WITHDRAWAL_PROJECTION = `{
  _id,
  status,
  declaredAt,
  name,
  email,
  orderNumber,
  locale,
  reason,
  "order": orderRef->${ORDER_LOOKUP_PROJECTION}
}`

/**
 * A stored `orderWithdrawal` record. Every withdrawal mail reads this — date/time, name and reason
 * come from the record, never from "now" or the request.
 */
export type WithdrawalRecord = {
  _id: string
  status: 'unmatched' | 'received' | 'processing' | 'refunded' | 'rejected'
  declaredAt: string
  /** Submitted via the web form (absent on records logged in the Studio). */
  name?: string | null
  email?: string | null
  orderNumber?: string | null
  /** Locale of the submission — the unmatched receipt has no order to take it from. */
  locale?: string | null
  reason?: string | null
  /** Linked order; null while `unmatched`. */
  order: OrderWithdrawalLookup | null
}

const OPEN_STATUSES = ['received', 'processing']

/** The open (received|processing) withdrawal for an order, if any. */
export async function findOpenWithdrawal(orderId: string): Promise<WithdrawalRecord | null> {
  return sanityClient.fetch<WithdrawalRecord | null>(
    `*[_type == "orderWithdrawal" && orderRef._ref == $orderId && status in $open] | order(declaredAt asc)[0]${WITHDRAWAL_PROJECTION}`,
    { orderId, open: OPEN_STATUSES },
  )
}

/** An open unmatched declaration with the same (normalized) email + order number, if any. */
export async function findOpenUnmatchedWithdrawal(
  email: string,
  orderNumber: string,
): Promise<WithdrawalRecord | null> {
  return sanityClient.fetch<WithdrawalRecord | null>(
    `*[_type == "orderWithdrawal" && status == "unmatched" && email == $email && orderNumber == $orderNumber] | order(declaredAt asc)[0]${WITHDRAWAL_PROJECTION}`,
    { email, orderNumber },
  )
}

export type NewWithdrawal = {
  /** Deterministic id — see `withdrawalId()` in the order-withdraw function. */
  _id: string
  orderId: string | null
  declaredAt: string
  name: string
  email: string
  orderNumber: string
  locale: string
  reason?: string
}

/**
 * Store a web declaration. `createIfNotExists` on a deterministic id makes two quick submits
 * produce one record: `created` is false when the id already existed (the caller then treats the
 * submission as a repeat). Returns the stored record either way.
 */
export async function createWithdrawalIfNotExists(
  input: NewWithdrawal,
): Promise<{ record: WithdrawalRecord; created: boolean }> {
  const stored = await sanityClient.createIfNotExists({
    _id: input._id,
    _type: 'orderWithdrawal',
    ...(input.orderId && { orderRef: { _type: 'reference', _ref: input.orderId } }),
    declaredAt: input.declaredAt,
    status: input.orderId ? 'received' : 'unmatched',
    name: input.name,
    email: input.email,
    orderNumber: input.orderNumber,
    locale: input.locale,
    ...(input.reason && { reason: input.reason }),
  })
  const record = await fetchWithdrawal(stored._id)
  if (!record) throw new Error(`orderWithdrawal ${stored._id} not readable after create`)
  return { record, created: stored.declaredAt === input.declaredAt }
}

/** Number of web-created withdrawal records whose id starts with `prefix` (id sequence). */
export async function countWithdrawalIds(prefix: string): Promise<number> {
  return sanityClient.fetch<number>(
    `count(*[_type == "orderWithdrawal" && string::startsWith(_id, $prefix)])`,
    { prefix },
  )
}

/** Load a withdrawal record + its order (web path after create, admin resend endpoint). */
export async function fetchWithdrawal(withdrawalId: string): Promise<WithdrawalRecord | null> {
  return sanityClient.fetch<WithdrawalRecord | null>(
    `*[_type == "orderWithdrawal" && _id == $id][0]${WITHDRAWAL_PROJECTION}`,
    { id: withdrawalId },
  )
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
  returnAddress: {
    line1: string | null
    line2: string | null
    zip: string | null
    city: string | null
    country: string | null
  } | null
  returnShippingBorneBy: 'customer' | 'merchant' | null
  returnPolicyNote: string | null
  withdrawalPeriodStart: WithdrawalPeriodStart | null
  withdrawalExceptions: string[] | null
  /** Inbox for mails to the shop (order copies, withdrawals); null → senderEmail. */
  shopNotificationEmail: string | null
  /** `settings.company` — business details for the mail footer. */
  company: {
    name: string | null
    owner: string | null
    email: string | null
    phone: string | null
    vatId: string | null
    registerNumber: string | null
    registerCourt: string | null
    address: {
      line1: string | null
      line2: string | null
      zip: string | null
      city: string | null
      country: string | null
    } | null
  } | null
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
        orderNumberPrefix,
        invoiceNumberPrefix,
        billingAddress{
          line1,
          line2,
          "city": coalesce(city[language == $locale][0].value, city[language == "de"][0].value),
          zip,
          country
        },
        bankAccount{ name, bic, iban },
        returnAddress{
          line1,
          line2,
          "city": coalesce(city[language == $locale][0].value, city[language == "de"][0].value),
          zip,
          country
        },
        returnShippingBorneBy,
        withdrawalPeriodStart,
        withdrawalExceptions,
        "returnPolicyNote": coalesce(returnPolicyNote[language == $locale][0].value, returnPolicyNote[language == "de"][0].value)
      },
      "site": *[_type == "settings"][0]{
        senderName,
        senderEmail,
        shopNotificationEmail,
        "shopName": coalesce(siteTitle[language == $locale][0].value, siteTitle[language == "de"][0].value),
        company{
          "name": coalesce(name[language == $locale][0].value, name[language == "de"][0].value),
          owner,
          email,
          phone,
          vatId,
          registerNumber,
          registerCourt,
          address{
            line1,
            line2,
            "city": coalesce(city[language == $locale][0].value, city[language == "de"][0].value),
            zip,
            country
          }
        }
      }
    }{
      "shopName": site.shopName,
      // Email sender lives on the general settings doc (Settings → Notifications),
      // so it works on non-shop sites too.
      "senderName": site.senderName,
      "senderEmail": site.senderEmail,
      "billingAddress": shop.billingAddress,
      "bankAccount": shop.bankAccount,
      "orderNumberPrefix": shop.orderNumberPrefix,
      "invoiceNumberPrefix": shop.invoiceNumberPrefix,
      "returnAddress": shop.returnAddress,
      "returnShippingBorneBy": shop.returnShippingBorneBy,
      "returnPolicyNote": shop.returnPolicyNote,
      "withdrawalPeriodStart": shop.withdrawalPeriodStart,
      "withdrawalExceptions": shop.withdrawalExceptions,
      "shopNotificationEmail": site.shopNotificationEmail,
      "company": site.company
    }`,
    { locale },
  )
}

/** One entry in a Sanity `internationalizedArray` (sanity-plugin-internationalized-array). */
export type InternationalizedString = {
  _type: 'internationalizedArrayStringValue'
  _key: string
  language: string
  value: string
}

export type CustomerDocument = {
  _type: 'customer'
  email: string
  locale: string
  supabaseId: string
  status: 'registered' | 'invited' | 'active'
  customerNumber: string
  /**
   * Customer address. Note that `city` is stored as an i18nString array
   * (matches core-back's `address` schema), while the other fields are plain
   * strings.
   */
  address?: {
    prename?: string
    lastname?: string
    phone?: string
    line1?: string
    line2?: string
    zip?: string
    city?: InternationalizedString[]
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
      .set({ status: doc.status })
      .setIfMissing({
        email: doc.email,
        locale: doc.locale,
        ...doc.address?.prename && { 'address.prename': doc.address.prename },
        ...doc.address?.lastname && { 'address.lastname': doc.address.lastname },
        ...doc.address?.phone && { 'address.phone': doc.address.phone },
        ...doc.address?.line1 && { 'address.line1': doc.address.line1 },
        ...doc.address?.line2 && { 'address.line2': doc.address.line2 },
        ...doc.address?.zip && { 'address.zip': doc.address.zip },
        ...doc.address?.city && { 'address.city': doc.address.city },
        ...doc.address?.country && { 'address.country': doc.address.country },
        ...doc.address?.state && { 'address.state': doc.address.state },
      })
      .commit()
  } else {
    const customerNumber = await getLatestCustomerNumber()
    await createCustomer({ _type: 'customer', supabaseId, customerNumber, ...doc })
  }
}

// ── Newsletter subscribers ──────────────────────────────────────────────────

export type NewsletterSubscriberStatus = 'pending' | 'confirmed' | 'unsubscribed'

export type NewsletterSubscriberDocument = {
  _type: 'newsletterSubscriber'
  email: string
  locale: string
  status: NewsletterSubscriberStatus
  source: 'standalone' | 'registration'
  token: string
  supabaseId?: string
  confirmedAt?: string
}

type StoredSubscriber = NewsletterSubscriberDocument & { _id: string }

export async function getSubscriberByEmail(email: string): Promise<StoredSubscriber | null> {
  const doc = await sanityClient.fetch<StoredSubscriber | null>(
    `*[_type == "newsletterSubscriber" && email == $email][0]`,
    { email },
  )
  return doc ?? null
}

export async function getSubscriberByToken(token: string): Promise<StoredSubscriber | null> {
  const doc = await sanityClient.fetch<StoredSubscriber | null>(
    `*[_type == "newsletterSubscriber" && token == $token][0]`,
    { token } as Record<string, string>,
  )
  return doc ?? null
}

export async function createSubscriber(doc: NewsletterSubscriberDocument): Promise<{ _id: string }> {
  return sanityClient.create(doc)
}

export async function patchSubscriber(
  id: string,
  set: Partial<Omit<NewsletterSubscriberDocument, '_type'>>,
): Promise<void> {
  await sanityClient.patch(id).set(set).commit()
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
  const order = await sanityClient.fetch<{ _id: string; status: string } | null>(
    `*[_type == "order" && paymentIntentId == $pid][0]{ _id, status }`,
    { pid: paymentIntentId },
  )
  if (!order?._id) {
    log.warn('Order not found for refund update', { paymentIntentId })
    return
  }

  const timestamp = new Date().toISOString()
  const historyEntries: OrderStatusHistoryEntry[] = [
    { _type: 'orderStatusHistory', _key: crypto.randomUUID(), type: 'payment', status, timestamp, source: 'stripe' },
  ]
  const set: Record<string, string> = { paymentStatus: status }

  // Full refund of a still-undispatched order also cancels fulfillment, so the
  // order doesn't stay stuck reading as `created`/`processing`. Mirrors the
  // Studio refund action — keeps every refund source (action / dashboard /
  // webhook reconciliation) consistent. Idempotent: a re-run sees `canceled`
  // and does nothing more.
  if (status === 'refunded' && (order.status === 'created' || order.status === 'processing')) {
    set.status = 'canceled'
    historyEntries.push({
      _type: 'orderStatusHistory',
      _key: crypto.randomUUID(),
      type: 'fulfillment',
      status: 'canceled',
      timestamp,
      source: 'stripe',
    })
  }

  await sanityClient.patch(order._id).set(set).append('statusHistory', historyEntries).commit()
}
