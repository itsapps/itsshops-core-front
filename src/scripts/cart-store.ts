const STORAGE_KEY = `itsshops_cart_${location.host}`

export type CartItem = {
  id: string
  title: string
  price: number
  quantity: number
  imageUrl: string
  url: string
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
}

export function getCount(): number {
  return getCart().reduce((sum, i) => sum + i.quantity, 0)
}

export function getTotal(): number {
  return getCart().reduce((sum, i) => sum + i.price * i.quantity, 0)
}
