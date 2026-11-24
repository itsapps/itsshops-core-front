import type { ValidatedCartItemResponse } from '../shared/checkout-api'

const STORAGE_KEY = `itsshops_cart_${location.host}`
const COUPON_STORAGE_KEY = `itsshops_coupon_${location.host}`

export type CartItem = {
  id: string
  title: string
  subtitle?: string
  price: number
  quantity: number
  imageUrl: string
  url: string
  /** Bundles: locale-independent contents key ("id:qty,…", `data-bundle-key`) — compared with the
   *  server's to tell a contents change from a mere wording/locale difference in `subtitle`. */
  bundleKey?: string
}

function dispatch(): void {
  document.dispatchEvent(new CustomEvent('cart:updated', { detail: getCart() }))
}

export function getCart(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function save(items: CartItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  dispatch()
}

export function addItem(item: Omit<CartItem, 'quantity'>, quantity = 1): void {
  const items = getCart()
  const existing = items.find(i => i.id === item.id)
  if (existing) {
    existing.quantity += quantity
  } else {
    items.push({ ...item, quantity })
  }
  save(items)
}

export function removeItem(id: string): void {
  save(getCart().filter(i => i.id !== id))
}

export function updateQuantity(id: string, quantity: number): void {
  if (quantity <= 0) {
    removeItem(id)
    return
  }
  const items = getCart()
  const item = items.find(i => i.id === id)
  if (item) {
    item.quantity = quantity
    save(items)
  }
}

export function clearCart(): void {
  save([])
  clearAppliedCouponCode()
}

// ── Applied coupon ───────────────────────────────────────────────────────────

export function getAppliedCouponCode(): string | null {
  try {
    const value = localStorage.getItem(COUPON_STORAGE_KEY)
    return value && value.trim() ? value : null
  } catch {
    return null
  }
}

export function setAppliedCouponCode(code: string): void {
  const trimmed = code.trim()
  if (!trimmed) {
    clearAppliedCouponCode()
    return
  }
  if (localStorage.getItem(COUPON_STORAGE_KEY) === trimmed) return
  localStorage.setItem(COUPON_STORAGE_KEY, trimmed)
}

export function clearAppliedCouponCode(): void {
  if (localStorage.getItem(COUPON_STORAGE_KEY) == null) return
  localStorage.removeItem(COUPON_STORAGE_KEY)
}

/** What checkout's server answer changed in the stored cart (`syncCartFromServer`). */
export type CartChanges = {
  removed: CartItem[]
  price: { item: CartItem; from: number; to: number }[]
  quantity: { item: CartItem; from: number; to: number }[]
  /** Bundles whose items changed; the item carries the new `subtitle`. */
  contents: CartItem[]
}

export function emptyCartChanges(): CartChanges {
  return { removed: [], price: [], quantity: [], contents: [] }
}

export function hasCartChanges(c: CartChanges): boolean {
  return c.removed.length + c.price.length + c.quantity.length + c.contents.length > 0
}

/**
 * Remove the given ids from the cart (one save, one `cart:updated` when anything was removed).
 * Returns the removed entries (their titles name them in the notice).
 */
export function removeItems(ids: string[]): CartItem[] {
  const drop = new Set(ids)
  const items = getCart()
  const removed = items.filter(i => drop.has(i.id))
  if (removed.length) save(items.filter(i => !drop.has(i.id)))
  return removed
}

/**
 * Bring the stored cart in line with checkout's server answer and report what changed — compared
 * against the cart **before** writing; one save (one `cart:updated`) when anything changed:
 * - ids in `unavailableItems` → removed;
 * - price → the server's;
 * - quantity → capped to the server's, only while the stored quantity still is the one that was
 *   sent (otherwise the customer changed it meanwhile and the next calculate decides);
 * - bundles: `subtitle` and `bundleKey` → the server's; reported as `contents` only when both
 *   keys exist and differ (another subtitle alone — locale, a renamed item — is silent).
 */
export function syncCartFromServer(response: {
  items: Pick<ValidatedCartItemResponse, 'variantId' | 'kind' | 'subtitle' | 'price' | 'quantity' | 'requestedQuantity' | 'bundleKey'>[]
  unavailableItems: string[]
}): CartChanges {
  const changes = emptyCartChanges()
  const unavailable = new Set(response.unavailableItems)
  const byId = new Map(response.items.map(i => [i.variantId, i]))
  let dirty = false
  const next: CartItem[] = []

  for (const stored of getCart()) {
    if (unavailable.has(stored.id)) {
      changes.removed.push(stored)
      dirty = true
      continue
    }
    const server = byId.get(stored.id)
    if (!server) { next.push(stored); continue }
    const item = { ...stored }

    if (item.price !== server.price) {
      changes.price.push({ item, from: stored.price, to: server.price })
      item.price = server.price
    }
    if (server.quantity < server.requestedQuantity && stored.quantity === server.requestedQuantity) {
      changes.quantity.push({ item, from: stored.quantity, to: server.quantity })
      item.quantity = server.quantity
    }
    if (server.kind === 'bundle') {
      if (stored.bundleKey && server.bundleKey && stored.bundleKey !== server.bundleKey) {
        changes.contents.push(item)
      }
      if (server.subtitle) item.subtitle = server.subtitle
      if (server.bundleKey) item.bundleKey = server.bundleKey
    }
    if (item.price !== stored.price || item.quantity !== stored.quantity
      || item.subtitle !== stored.subtitle || item.bundleKey !== stored.bundleKey) dirty = true
    next.push(item)
  }

  if (dirty) save(next)
  return changes
}

export function getCount(): number {
  return getCart().reduce((sum, i) => sum + i.quantity, 0)
}

export function getTotal(): number {
  return getCart().reduce((sum, i) => sum + i.price * i.quantity, 0)
}
