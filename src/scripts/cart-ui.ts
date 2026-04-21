import { addItem, removeItem, updateQuantity, getCart, getCount, getTotal } from './cart-store'
import { cloneTemplate, fillSlot, fillImageSlot, fillLinkSlot } from './template-utils'
import { lockInertOutside } from './inert-lock'

let cartSidebar: HTMLElement | null = null
let lastCartTrigger: HTMLElement | null = null
let cartLock: { release: () => void } | null = null
let cartItemsEl: HTMLElement | null = null
let cartTotalEl: HTMLElement | null = null
let cartEmptyEl: HTMLElement | null = null
let locale = 'de'
let currency = 'EUR'
let currencyLabel: string | undefined
let imgWidth = 80
let imgHeight = 80

function formatPrice(cents: number): string {
  if (currencyLabel) {
    const n = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)
    return `${n} ${currencyLabel}`
  }
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100)
}

function updateCount(): void {
  const count = getCount()
  document.querySelectorAll<HTMLElement>('[data-cart-count]').forEach(el => {
    el.textContent = String(count)
    if ('cartCountHide' in el.dataset) {
      el.style.display = count === 0 ? 'none' : ''
    }
  })
}

function renderItems(): void {
  if (!cartItemsEl) return
  const items = getCart()

  if (cartEmptyEl) cartEmptyEl.hidden = items.length > 0
  if (cartTotalEl) cartTotalEl.textContent = formatPrice(getTotal())

  cartItemsEl.querySelectorAll('[data-cart-item]').forEach(el => el.remove())

  for (const item of items) {
    const el = cloneTemplate('cart-item-template')
    if (!el) continue

    el.dataset.cartItemId = item.id

    fillImageSlot(el, 'image', item.imageUrl, imgWidth, imgHeight)
    fillLinkSlot(el, 'title', item.title, item.url)
    if (item.subtitle) fillSlot(el, 'subtitle', item.subtitle)
    fillSlot(el, 'price', formatPrice(item.price * item.quantity))

    const qtyValue = el.querySelector<HTMLElement>('[data-qty-value]')
    if (qtyValue) qtyValue.textContent = String(item.quantity)

    el.querySelector('[data-qty-decrease]')?.addEventListener('click', () => {
      updateQuantity(item.id, item.quantity - 1)
    })
    el.querySelector('[data-qty-increase]')?.addEventListener('click', () => {
      updateQuantity(item.id, item.quantity + 1)
    })
    el.querySelector('[data-cart-remove]')?.addEventListener('click', () => {
      removeItem(item.id)
    })

    cartItemsEl.appendChild(el)
  }
}

function setCartTogglesExpanded(expanded: boolean): void {
  document.querySelectorAll<HTMLElement>('[data-cart-toggle]').forEach(btn => {
    btn.setAttribute('aria-expanded', String(expanded))
  })
}

function openCart(): void {
  if (!cartSidebar) return
  cartSidebar.classList.add('is-open')
  cartSidebar.setAttribute('aria-hidden', 'false')
  cartSidebar.removeAttribute('inert')
  const overlay = document.querySelector<HTMLElement>('[data-cart-overlay]')
  overlay?.classList.add('is-visible')
  setCartTogglesExpanded(true)
  const keep: HTMLElement[] = [cartSidebar]
  if (overlay) keep.push(overlay)
  if (lastCartTrigger) keep.push(lastCartTrigger)
  cartLock = lockInertOutside(keep)
  cartSidebar.focus()
}

function closeCart(): void {
  if (!cartSidebar) return
  cartSidebar.classList.remove('is-open')
  cartSidebar.setAttribute('aria-hidden', 'true')
  cartSidebar.setAttribute('inert', '')
  document.querySelector('[data-cart-overlay]')?.classList.remove('is-visible')
  setCartTogglesExpanded(false)
  cartLock?.release()
  cartLock = null
  lastCartTrigger?.focus()
}

export function initCart(): void {
  cartSidebar = document.getElementById('cart-sidebar')
  if (!cartSidebar) return

  cartItemsEl = cartSidebar.querySelector('[data-cart-items]')
  cartTotalEl = cartSidebar.querySelector('[data-cart-total]')
  cartEmptyEl = cartSidebar.querySelector('[data-cart-empty]')

  locale        = document.documentElement.lang || 'de'
  currency      = cartSidebar.dataset.currency || 'EUR'
  currencyLabel = cartSidebar.dataset.currencyLabel || undefined
  imgWidth      = parseInt(cartSidebar.dataset.cartImageWidth || '80', 10)
  imgHeight     = parseInt(cartSidebar.dataset.cartImageHeight || '80', 10)

  updateCount()
  renderItems()

  document.querySelectorAll<HTMLButtonElement>('[data-cart-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      lastCartTrigger = btn
      cartSidebar?.classList.contains('is-open') ? closeCart() : openCart()
    })
  })

  cartSidebar.querySelector('[data-cart-close]')?.addEventListener('click', closeCart)

  document.querySelector('[data-cart-overlay]')?.addEventListener('click', closeCart)

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && cartSidebar?.classList.contains('is-open')) closeCart()
  })

  // Standalone qty controls (on product pages, not inside cart sidebar)
  document.querySelectorAll<HTMLElement>('[data-qty-control]').forEach(ctrl => {
    // Skip controls inside the cart sidebar — those are handled above
    if (cartSidebar?.contains(ctrl)) return

    const valueEl = ctrl.querySelector<HTMLElement>('[data-qty-value]')
    if (!valueEl) return
    const decreaseBtn = ctrl.querySelector<HTMLButtonElement>('[data-qty-decrease]')
    const increaseBtn = ctrl.querySelector<HTMLButtonElement>('[data-qty-increase]')
    const tDecrease = ctrl.dataset.tDecrease ?? 'Decrease quantity'
    const tIncrease = ctrl.dataset.tIncrease ?? 'Increase quantity'
    const tQuantity = ctrl.dataset.tQuantity ?? 'Quantity'

    const actionsEl = ctrl.closest('[data-product-actions], .product-card__actions')
    const addBtn = actionsEl?.querySelector<HTMLButtonElement>('[data-add-to-cart]')
    const addBtnBaseLabel = addBtn?.getAttribute('aria-label') ?? ''
    const ariaTemplate = addBtn?.dataset.ariaAddTemplate ?? ''
    const productTitle = addBtn?.dataset.title ?? ''

    function updateQty(newVal: number): void {
      valueEl!.textContent = String(newVal)
      if (decreaseBtn) {
        decreaseBtn.disabled = newVal <= 1
        decreaseBtn.setAttribute('aria-label', `${tDecrease}, ${tQuantity}: ${newVal}`)
      }
      if (increaseBtn) {
        increaseBtn.setAttribute('aria-label', `${tIncrease}, ${tQuantity}: ${newVal}`)
      }
      if (addBtn && ariaTemplate) {
        addBtn.setAttribute('aria-label', newVal > 1
          ? ariaTemplate.replace('{qty}', String(newVal)).replace('{title}', productTitle)
          : addBtnBaseLabel)
      }
    }

    decreaseBtn?.addEventListener('click', () => {
      const n = parseInt(valueEl.textContent || '1', 10)
      if (n > 1) updateQty(n - 1)
    })
    increaseBtn?.addEventListener('click', () => {
      const n = parseInt(valueEl.textContent || '1', 10)
      updateQty(n + 1)
    })
  })

  document.querySelectorAll<HTMLButtonElement>('[data-add-to-cart]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id       = btn.dataset.productId
      const title    = btn.dataset.title
      const subtitle = btn.dataset.subtitle
      const price    = Number(btn.dataset.price)
      const imageUrl = btn.dataset.image ?? ''
      const url      = btn.dataset.url ?? '#'

      if (!id || !title || !price) return

      const actionsEl = btn.closest('[data-product-actions], .product-card__actions')
      const qtyEl     = actionsEl?.querySelector<HTMLElement>('[data-qty-value]')
      const qty        = qtyEl ? Math.max(1, parseInt(qtyEl.textContent || '1', 10)) : 1

      addItem({ id, title, subtitle, price, imageUrl, url }, qty)
      lastCartTrigger = btn

      if (qtyEl) qtyEl.textContent = '1'

      const originalText = btn.textContent
      const addedText = btn.dataset.addedToCart
      btn.classList.add('is-added')
      if (addedText) {
        btn.setAttribute('aria-live', 'assertive')
        btn.textContent = addedText
      }
      setTimeout(() => {
        btn.classList.remove('is-added')
        if (addedText) {
          btn.removeAttribute('aria-live')
          btn.textContent = originalText
        }
      }, 2000)

      openCart()
    })
  })

  document.addEventListener('cart:updated', () => {
    updateCount()
    renderItems()
  })
}
