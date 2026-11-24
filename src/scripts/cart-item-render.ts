import type { CartItem } from './cart-store'
import { fillSlot, fillImageSlot, fillLinkSlot } from './template-utils'

/** The display fields of a cart line — what an item row (cart, checkout, order thanks) shows. */
export type CartItemDisplay = Pick<CartItem, 'title' | 'subtitle' | 'imageUrl' | 'url' | 'price' | 'quantity'>

/**
 * Fill a row cloned from a `cartItem` macro template (`macros/cart.njk`): image, title link,
 * subtitle, line price and quantity. Button wiring (editable rows) stays with the caller.
 */
export function fillCartItem(
  el: HTMLElement,
  item: CartItemDisplay,
  formatPrice: (cents: number) => string,
  image?: { width?: number; height?: number },
): void {
  fillImageSlot(el, 'image', item.imageUrl, image?.width, image?.height)
  fillLinkSlot(el, 'title', item.title, item.url)
  if (item.subtitle) fillSlot(el, 'subtitle', item.subtitle)
  fillSlot(el, 'price', formatPrice(item.price * item.quantity))

  const qtyValue = el.querySelector<HTMLElement>('[data-qty-value]')
  if (qtyValue) qtyValue.textContent = String(item.quantity)
}
