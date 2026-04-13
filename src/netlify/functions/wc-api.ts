/**
 * WooCommerce REST API v3 compatibility layer.
 *
 * Exposes Sanity orders through a WC-compatible interface so third-party
 * tools (e.g. wineNET) can consume them without code changes.
 *
 * Supported endpoints:
 *   GET  /wp-json/wc/v3/system_status
 *   GET  /wp-json/wc/v3/orders
 *   PUT  /wp-json/wc/v3/orders/:id
 *
 * Auth: consumer_key / consumer_secret via query params or Basic auth header.
 * Env:  WC_CONSUMER_KEY, WC_CONSUMER_SECRET, SANITY_PROJECT_ID, SANITY_DATASET, SANITY_TOKEN
 *       WC_TIMEZONE (optional, default "Europe/Vienna")
 */

import type { Context } from '@netlify/functions'
import { sanityClient } from '../services/sanity'

// ── Types ────────────────────────────────────────────────────────────────────

type WcApiConfig = {
  timezone?: string
  version?: string
}

type SanityOrder = {
  _id: string
  _createdAt: string
  orderNumber: string
  invoiceNumber: string
  status: string
  paymentStatus: string
  paymentIntentId: string
  customer: {
    contactEmail: string
    locale: string
    billingAddress: SanityAddress | null
    shippingAddress: SanityAddress | null
  }
  totals: {
    grandTotal: number
    subtotal: number
    shipping: number
    discount: number
    totalVat: number
    vatBreakdown: Array<{ rate: number; net: number; vat: number }> | null
    currency: string
  }
  orderItems: SanityOrderItem[]
  fulfillment: {
    methodTitle: string | null
    methodType: string | null
    shippingCost: number
    taxSnapshot: { rate: number; net: number; vat: number } | null
    trackingCode: string | null
    packagingLines: Array<{ _key: string; quantity: number; packSize: number; volume: number; price: number }> | null
  } | null
}

type SanityAddress = {
  name: string | null
  prename: string | null
  lastname: string | null
  line1: string | null
  line2: string | null
  zip: string | null
  city: string | null
  country: string | null
  state: string | null
  phone: string | null
}

type SanityOrderItem = {
  _key: string
  kind: string
  variantId: string
  productId: string
  title: string
  subtitle: string | null
  sku: string | null
  quantity: number
  price: number
  vatRate: number
  vatAmount: number
  weight: number | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const JSON_HEADERS = { 'content-type': 'application/json' } as const

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS })
}

function wcError(code: string, message: string, status = 400): Response {
  return json({ code, message, data: { status } }, status)
}

/** Extract integer ID from orderNumber (e.g. "TH-000123" → 123). */
function orderNumberToId(orderNumber: string): number {
  const match = orderNumber.match(/(\d+)$/)
  return match ? parseInt(match[1], 10) : 0
}

/** Pad integer back to 6-digit suffix for GROQ lookup. */
function idToSuffix(id: number): string {
  return String(id).padStart(6, '0')
}

/** Format cents to decimal string (e.g. 1234 → "12.34"). */
function price(cents: number): string {
  return (cents / 100).toFixed(2)
}

/** Format ISO date to WC response format: 2020-01-01T12:01:01 in the given timezone. */
function formatDate(iso: string, tz: string): string {
  const d = new Date(iso)
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`
}

/** Format ISO date to UTC WC format. */
function formatDateGmt(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
}

// ── Status mapping ───────────────────────────────────────────────────────────

const STATUS_TO_WC: Record<string, string> = {
  created: 'processing',
  processing: 'processing',
  shipped: 'completed',
  delivered: 'completed',
  canceled: 'cancelled',
  returned: 'refunded',
}

const STATUS_FROM_WC: Record<string, string> = {
  processing: 'processing',
  completed: 'shipped',
  cancelled: 'canceled',
  refunded: 'returned',
  'on-hold': 'processing',
}

// ── Auth ─────────────────────────────────────────────────────────────────────

function authenticate(request: Request): boolean {
  const expectedKey = process.env.WC_CONSUMER_KEY
  const expectedSecret = process.env.WC_CONSUMER_SECRET
  if (!expectedKey || !expectedSecret) return false

  const url = new URL(request.url)

  // Try query params first
  const qKey = url.searchParams.get('consumer_key')
  const qSecret = url.searchParams.get('consumer_secret')
  if (qKey && qSecret) {
    return qKey === expectedKey && qSecret === expectedSecret
  }

  // Try Authorization: Basic header
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Basic ')) {
    const decoded = atob(authHeader.slice(6))
    const [user, pass] = decoded.split(':')
    return user === expectedKey && pass === expectedSecret
  }

  return false
}

// ── Address mapping ──────────────────────────────────────────────────────────

function mapAddress(addr: SanityAddress | null) {
  if (!addr) return {
    first_name: '', last_name: '', company: '', address_1: '', address_2: '',
    city: '', state: '', postcode: '', country: '', phone: '',
  }
  return {
    first_name: addr.prename ?? '',
    last_name: addr.lastname ?? '',
    company: '',
    address_1: addr.line1 ?? '',
    address_2: addr.line2 ?? '',
    city: addr.city ?? '',
    state: addr.state ?? '',
    postcode: addr.zip ?? '',
    country: addr.country ?? '',
    phone: addr.phone ?? '',
  }
}

// ── Order mapping ────────────────────────────────────────────────────────────

/** Simple string-to-positive-integer hash for stable IDs. */
function stableId(s: string): number {
  let hash = 5381
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) + hash + s.charCodeAt(i)) >>> 0
  return (hash % 2_000_000_000) + 1
}

function mapOrder(order: SanityOrder, tz: string) {
  const id = orderNumberToId(order.orderNumber)
  const t = order.totals
  const f = order.fulfillment
  const shippingTax = f?.taxSnapshot?.vat ?? 0
  const shippingNet = f ? f.shippingCost - shippingTax : 0
  const discountTotal = t.discount
  const discountTax = 0 // We don't track tax on discounts separately

  // Tax lines from vatBreakdown
  const taxLines = (t.vatBreakdown ?? []).map((vb, i) => ({
    id: i + 1,
    rate_code: `TAX-${vb.rate}`,
    rate_id: i + 1,
    label: `${vb.rate}%`,
    compound: false,
    rate_percent: vb.rate.toFixed(2),
    tax_total: price(vb.vat),
    shipping_tax_total: '0.00',
  }))

  // If there's shipping tax, add it to the matching tax line
  if (shippingTax > 0 && f?.taxSnapshot && taxLines.length > 0) {
    const match = taxLines.find(tl => tl.rate_percent === f.taxSnapshot!.rate.toFixed(2))
    if (match) match.shipping_tax_total = price(shippingTax)
  }

  return {
    id,
    number: order.orderNumber,
    status: STATUS_TO_WC[order.status] ?? order.status,
    currency: t.currency ?? 'EUR',
    prices_include_tax: true,
    date_created: formatDate(order._createdAt, tz),
    date_created_gmt: formatDateGmt(order._createdAt),
    date_paid: order.paymentStatus === 'succeeded' ? formatDate(order._createdAt, tz) : null,
    date_paid_gmt: order.paymentStatus === 'succeeded' ? formatDateGmt(order._createdAt) : null,
    discount_total: price(discountTotal),
    discount_tax: price(discountTax),
    shipping_total: price(shippingNet),
    shipping_tax: price(shippingTax),
    total: price(t.grandTotal),
    total_tax: price(t.totalVat),
    customer_id: 0,
    customer_note: '',
    billing: {
      ...mapAddress(order.customer?.billingAddress),
      email: order.customer?.contactEmail ?? '',
    },
    shipping: mapAddress(order.customer?.shippingAddress),
    payment_method: 'stripe',
    payment_method_title: 'Stripe',
    transaction_id: order.paymentIntentId ?? '',
    meta_data: [],
    line_items: order.orderItems.map((item) => {
      const lineTotal = item.price * item.quantity
      const lineTax = item.vatAmount * item.quantity
      const unitPrice = item.price - item.vatAmount // net unit price
      return {
        id: stableId(item.variantId),
        name: item.subtitle ? `${item.title} – ${item.subtitle}` : item.title,
        product_id: stableId(item.productId),
        quantity: item.quantity,
        sku: item.sku ?? '',
        price: price(unitPrice),
        subtotal: price(lineTotal - lineTax),
        subtotal_tax: price(lineTax),
        total: price(lineTotal - lineTax),
        total_tax: price(lineTax),
        taxes: taxLines
          .filter(tl => tl.rate_percent === item.vatRate.toFixed(2))
          .map(tl => ({
            id: tl.id,
            total: price(lineTax),
            subtotal: price(lineTax),
          })),
      }
    }),
    tax_lines: taxLines,
    shipping_lines: f ? [{
      id: 1,
      method_id: f.methodType ?? 'flat_rate',
      method_title: f.methodTitle ?? '',
      total: price(shippingNet),
      total_tax: price(shippingTax),
      taxes: f.taxSnapshot ? [{
        id: taxLines.find(tl => tl.rate_percent === f.taxSnapshot!.rate.toFixed(2))?.id ?? 1,
        total: price(shippingTax),
        subtotal: price(shippingTax),
      }] : [],
    }] : [],
    fee_lines: [],
  }
}

// ── GROQ ─────────────────────────────────────────────────────────────────────

const ORDER_PROJECTION = `{
  _id, _createdAt,
  orderNumber, invoiceNumber, status, paymentStatus, paymentIntentId,
  customer { contactEmail, locale, billingAddress, shippingAddress },
  totals { grandTotal, subtotal, shipping, discount, totalVat, vatBreakdown, currency },
  orderItems[] { _key, kind, variantId, productId, title, subtitle, sku, quantity, price, vatRate, vatAmount, weight },
  fulfillment { methodTitle, methodType, shippingCost, taxSnapshot, trackingCode, packagingLines }
}`

// ── Route handlers ───────────────────────────────────────────────────────────

function handleSystemStatus(config: Required<WcApiConfig>): Response {
  return json({
    environment: {
      version: config.version,
      default_timezone: config.timezone,
    },
    settings: {
      api_enabled: true,
      currency: 'EUR',
    },
  })
}

async function handleListOrders(
  request: Request,
  config: Required<WcApiConfig>,
): Promise<Response> {
  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per_page') ?? '10', 10)))
  const statusFilter = url.searchParams.get('status') ?? ''
  const after = url.searchParams.get('after') ?? ''
  const before = url.searchParams.get('before') ?? ''

  // Map WC status to internal status for GROQ filter
  const internalStatuses = statusFilter
    ? Object.entries(STATUS_TO_WC)
      .filter(([, wc]) => wc === statusFilter)
      .map(([internal]) => internal)
    : []

  // Build GROQ filter
  const filters = ['_type == "order"']
  const params: Record<string, unknown> = {}

  if (internalStatuses.length > 0) {
    filters.push('status in $statuses')
    params.statuses = internalStatuses
  }
  if (after) {
    filters.push('_createdAt > $after')
    params.after = new Date(after).toISOString()
  }
  if (before) {
    filters.push('_createdAt < $before')
    params.before = new Date(before).toISOString()
  }

  const start = (page - 1) * perPage
  const end = start + perPage

  const query = `*[${filters.join(' && ')}] | order(_createdAt desc) [$start...$end] ${ORDER_PROJECTION}`
  params.start = start
  params.end = end

  const orders = await sanityClient.fetch<SanityOrder[]>(query, params)
  const totalQuery = `count(*[${filters.join(' && ')}])`
  const total = await sanityClient.fetch<number>(totalQuery, params)
  const totalPages = Math.ceil(total / perPage)

  const mapped = orders.map(o => mapOrder(o, config.timezone))

  return new Response(JSON.stringify(mapped), {
    status: 200,
    headers: {
      ...JSON_HEADERS,
      'x-wp-total': String(total),
      'x-wp-totalpages': String(totalPages),
    },
  })
}

async function handleUpdateOrder(
  orderId: number,
  request: Request,
  config: Required<WcApiConfig>,
): Promise<Response> {
  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return wcError('woocommerce_rest_invalid_json', 'Invalid JSON body')
  }

  const wcStatus = typeof body.status === 'string' ? body.status : null
  if (!wcStatus) {
    return wcError('woocommerce_rest_missing_status', 'Missing status parameter')
  }

  const internalStatus = STATUS_FROM_WC[wcStatus] ?? wcStatus
  const validStatuses = ['created', 'processing', 'shipped', 'delivered', 'canceled', 'returned']
  if (!validStatuses.includes(internalStatus)) {
    return wcError('woocommerce_rest_invalid_status', `Invalid status: ${wcStatus}`)
  }

  // Find order by numeric suffix
  const suffix = idToSuffix(orderId)
  const order = await sanityClient.fetch<{ _id: string; status: string } | null>(
    `*[_type == "order" && orderNumber match $suffix][0]{ _id, status }`,
    { suffix: `*${suffix}` },
  )

  if (!order) {
    return wcError('woocommerce_rest_order_invalid_id', `Order ${orderId} not found`, 404)
  }

  // Update status + append to history
  const historyEntry = {
    _type: 'orderStatusHistory',
    _key: crypto.randomUUID(),
    type: 'fulfillment',
    status: internalStatus,
    timestamp: new Date().toISOString(),
    source: 'wc-api',
  }

  await sanityClient
    .patch(order._id)
    .set({ status: internalStatus })
    .append('statusHistory', [historyEntry])
    .commit()

  // Refetch and return updated order
  const updated = await sanityClient.fetch<SanityOrder>(
    `*[_type == "order" && _id == $id][0] ${ORDER_PROJECTION}`,
    { id: order._id },
  )

  return json(mapOrder(updated, config.timezone))
}

// ── Main handler factory ─────────────────────────────────────────────────────

export function createWcApiHandler(userConfig: WcApiConfig = {}) {
  const config: Required<WcApiConfig> = {
    timezone: userConfig.timezone ?? process.env.WC_TIMEZONE ?? 'Europe/Vienna',
    version: userConfig.version ?? '9.0.0',
  }

  return async (request: Request, _context: Context): Promise<Response> => {
    // Auth
    if (!authenticate(request)) {
      return wcError('woocommerce_rest_cannot_view', 'Unauthorized', 401)
    }

    // Parse route: everything after /wp-json/wc/v3/
    const url = new URL(request.url)
    const path = url.pathname.replace(/.*\/wp-json\/wc\/v3\/?/, '')

    try {
      // GET /system_status
      if (path === 'system_status' && request.method === 'GET') {
        return handleSystemStatus(config)
      }

      // GET /orders
      if (path === 'orders' && request.method === 'GET') {
        return handleListOrders(request, config)
      }

      // PUT /orders/:id
      const orderMatch = path.match(/^orders\/(\d+)$/)
      if (orderMatch && request.method === 'PUT') {
        const id = parseInt(orderMatch[1], 10)
        return handleUpdateOrder(id, request, config)
      }

      return wcError('woocommerce_rest_no_route', `No route found for ${request.method} ${path}`, 404)
    } catch (err) {
      console.error('[wc-api] Error:', err)
      return wcError('woocommerce_rest_internal_error', 'Internal server error', 500)
    }
  }
}
