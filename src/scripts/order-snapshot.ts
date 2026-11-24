import type { AddressInput, CreatePaymentResponse } from '../shared/checkout-api'
import type { CartItem } from './cart-store'
import type { CartItemDisplay } from './cart-item-render'
import type { TotalsData } from './order-totals'

/**
 * Order summary handed from the checkout to the order-thanks page across the Stripe redirect.
 *
 * Holds personal data (email, name, address), so:
 * - sessionStorage only (per tab, gone when the tab closes), never localStorage
 * - minimal fields: no phone, no billing address, no client secret, no orderMetaId; for pickup
 *   no customer address at all (the page shows the pickup location instead)
 * - only read back for the matching PaymentIntent, within MAX_AGE_MS, and deleted on read
 * - the page renders it via textContent only
 */

const STORAGE_KEY = 'itsshops_order_snapshot'
const MAX_AGE_MS = 30 * 60 * 1000

export type OrderSnapshot = {
  /** 2 = discounts model (`summary.appliedDiscounts`); other versions are dropped by the reader. */
  v: 2
  paymentIntentId: string
  createdAt: number
  email: string
  firstName?: string
  items: CartItemDisplay[]
  summary: TotalsData
  shippingMethod?: { title: string; methodType: 'delivery' | 'pickup' }
  /** Pickup only: the pickup location (from the calculate response) — country as a name. */
  pickupAddress?: { line1: string; line2?: string; zip: string; city: string; country: string }
  pickupInstructions?: string
  /** Pickup only: the shop prepares the order first and mails when it's ready. */
  pickupAnnounceReady?: boolean
  shippingAddress?: {
    name: string
    line1: string
    line2?: string
    zip: string
    city: string
    country: string
  }
}

/** `pi_123_secret_abc` → `pi_123`. The secret part is never stored. */
export function paymentIntentIdFromSecret(clientSecret: string): string | null {
  const i = clientSecret.indexOf('_secret_')
  return clientSecret.startsWith('pi_') && i > 0 ? clientSecret.slice(0, i) : null
}

export function buildOrderSnapshot(input: {
  response: CreatePaymentResponse
  localCart: Map<string, CartItem>
  email: string
  address: AddressInput
  shippingMethodId?: string | null
  now?: number
}): OrderSnapshot | null {
  const { response, localCart, email, address } = input
  const paymentIntentId = paymentIntentIdFromSecret(response.clientSecret)
  if (!paymentIntentId) return null

  const methodId = input.shippingMethodId ?? response.selectedShippingMethodId
  const method = response.shippingMethods.find(m => m._id === methodId)
  // Any ISO country (pickup accepts every country) → its localized name, else the code.
  const countryTitle = (code: string): string => {
    try {
      return new Intl.DisplayNames([document.documentElement.lang || 'de'], { type: 'region' }).of(code) ?? code
    } catch {
      return response.supportedCountries.find(c => c.code === code)?.title ?? code
    }
  }
  const isPickup = method?.methodType === 'pickup'

  return {
    v: 2,
    paymentIntentId,
    createdAt: input.now ?? Date.now(),
    email,
    // Only a first name the customer typed (manual form); express checkout has just the full name.
    firstName: address.prename?.trim() || undefined,
    // Server quantities/prices, local display strings — same precedence as the checkout summary.
    items: response.items.map(item => {
      const local = localCart.get(item.variantId)
      return {
        title: local?.title ?? item.title,
        subtitle: local?.subtitle ?? item.subtitle ?? undefined,
        imageUrl: local?.imageUrl ?? item.imageUrl ?? '',
        url: local?.url ?? '#',
        price: item.price,
        quantity: item.quantity,
      }
    }),
    summary: { totals: response.totals, appliedDiscounts: response.appliedDiscounts },
    ...(method && { shippingMethod: { title: method.title, methodType: method.methodType } }),
    ...(isPickup
      ? {
          ...(method.pickupAddress && {
            pickupAddress: { ...method.pickupAddress, country: countryTitle(method.pickupAddress.country) },
          }),
          ...(method.pickupInstructions && { pickupInstructions: method.pickupInstructions }),
          ...(method.pickupAnnounceReady && { pickupAnnounceReady: true }),
        }
      : {
          shippingAddress: {
            name: address.name,
            line1: address.line1,
            ...(address.line2 && { line2: address.line2 }),
            zip: address.zip,
            city: address.city,
            country: countryTitle(address.country),
          },
        }),
  }
}

export function saveOrderSnapshot(snapshot: OrderSnapshot | null): void {
  if (!snapshot) return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // Storage blocked/full — the thanks page falls back to its generic content.
  }
}

/**
 * Read and delete the snapshot. Returns it only if it belongs to `paymentIntentId` and is fresh;
 * any other snapshot is discarded too.
 */
export function takeOrderSnapshot(paymentIntentId: string, now = Date.now()): OrderSnapshot | null {
  let raw: string | null
  try {
    raw = sessionStorage.getItem(STORAGE_KEY)
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    return null
  }
  if (!raw) return null

  try {
    const snapshot = JSON.parse(raw) as OrderSnapshot
    if (snapshot?.v !== 2) return null
    if (snapshot.paymentIntentId !== paymentIntentId) return null
    if (!(now - snapshot.createdAt >= 0 && now - snapshot.createdAt < MAX_AGE_MS)) return null
    if (!Array.isArray(snapshot.items) || !snapshot.summary?.totals || !Array.isArray(snapshot.summary.appliedDiscounts)) return null
    return snapshot
  } catch {
    return null
  }
}
