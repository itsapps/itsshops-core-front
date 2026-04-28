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
}

function dispatch(): void {
  document.dispatchEvent(new CustomEvent('cart:updated', { detail: getCart() }))
}

function dispatchCoupon(): void {
  document.dispatchEvent(
    new CustomEvent('cart:coupon-changed', { detail: getAppliedCouponCode() }),
  )
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
  dispatchCoupon()
}

export function clearAppliedCouponCode(): void {
  if (localStorage.getItem(COUPON_STORAGE_KEY) == null) return
  localStorage.removeItem(COUPON_STORAGE_KEY)
  dispatchCoupon()
}

/**
 * Update local cart prices from authoritative server values.
 * No-op (no save, no event) if nothing actually changed.
 */
export function syncPricesFromServer(updates: { id: string; price: number }[]): void {
  const items = getCart()
  let changed = false
  for (const update of updates) {
    const item = items.find(i => i.id === update.id)
    if (item && item.price !== update.price) {
      item.price = update.price
      changed = true
    }
  }
  if (changed) save(items)
}

export function getCount(): number {
  return getCart().reduce((sum, i) => sum + i.quantity, 0)
}

export function getTotal(): number {
  return getCart().reduce((sum, i) => sum + i.price * i.quantity, 0)
}
