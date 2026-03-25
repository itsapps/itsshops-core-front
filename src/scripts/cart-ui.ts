import { addItem, removeItem, updateQuantity, getCart, getCount, getTotal } from './cart-store'

let cartSidebar: HTMLElement | null = null
let cartItemsEl: HTMLElement | null = null
let cartTotalEl: HTMLElement | null = null
let cartEmptyEl: HTMLElement | null = null
let locale = 'de'
let currency = 'EUR'
let currencyLabel: string | undefined

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

  const tRemove   = cartSidebar?.dataset.tRemove   ?? 'Remove'
  const tDecrease = cartSidebar?.dataset.tDecrease ?? '−'
  const tIncrease = cartSidebar?.dataset.tIncrease ?? '+'

  cartItemsEl.querySelectorAll('.cart-item').forEach(el => el.remove())

  for (const item of items) {
    const div = document.createElement('div')
    div.className = 'cart-item'
    div.dataset.cartItemId = item.id
    div.innerHTML = `
      ${item.imageUrl
        ? `<img src="${item.imageUrl}" alt="" class="cart-item__image" width="80" height="80" loading="lazy">`
        : '<div class="cart-item__image cart-item__image--placeholder"></div>'
      }
      <div class="cart-item__body">
        <a href="${item.url}" class="cart-item__title">${item.title}${item.subtitle ? `<span class="cart-item__subtitle">${item.subtitle}</span>` : ''}</a>
        <div class="cart-item__row">
          <div class="cart-item__qty">
            <button type="button" class="cart-item__qty-btn" data-cart-decrease aria-label="${tDecrease}">−</button>
            <span class="cart-item__qty-count" aria-live="polite">${item.quantity}</span>
            <button type="button" class="cart-item__qty-btn" data-cart-increase aria-label="${tIncrease}">+</button>
          </div>
          <span class="cart-item__price">${formatPrice(item.price * item.quantity)}</span>
          <button type="button" class="cart-item__remove" data-cart-remove aria-label="${tRemove}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
    `

    div.querySelector('[data-cart-decrease]')?.addEventListener('click', () => {
      updateQuantity(item.id, item.quantity - 1)
    })
    div.querySelector('[data-cart-increase]')?.addEventListener('click', () => {
      updateQuantity(item.id, item.quantity + 1)
    })
    div.querySelector('[data-cart-remove]')?.addEventListener('click', () => {
      removeItem(item.id)
    })

    cartItemsEl.appendChild(div)
  }
}

function openCart(): void {
  if (!cartSidebar) return
  cartSidebar.classList.add('is-open')
  cartSidebar.setAttribute('aria-hidden', 'false')
  document.querySelector('[data-cart-overlay]')?.classList.add('is-visible')
}

function closeCart(): void {
  if (!cartSidebar) return
  cartSidebar.classList.remove('is-open')
  cartSidebar.setAttribute('aria-hidden', 'true')
  document.querySelector('[data-cart-overlay]')?.classList.remove('is-visible')
}

export function initCart(): void {
  cartSidebar = document.getElementById('cart-sidebar')
  if (!cartSidebar) return

  cartItemsEl = cartSidebar.querySelector('[data-cart-items]')
  cartTotalEl = cartSidebar.querySelector('[data-cart-total]')
  cartEmptyEl = cartSidebar.querySelector('[data-cart-empty]')

  locale       = document.documentElement.lang || 'de'
  currency     = cartSidebar.dataset.currency || 'EUR'
  currencyLabel = cartSidebar.dataset.currencyLabel || undefined

  updateCount()
  renderItems()

  document.querySelectorAll<HTMLButtonElement>('[data-cart-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
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
    const valueEl = ctrl.querySelector<HTMLElement>('[data-qty-value]')
    if (!valueEl) return
    ctrl.querySelector('[data-qty-decrease]')?.addEventListener('click', () => {
      const n = parseInt(valueEl.textContent || '1', 10)
      if (n > 1) valueEl.textContent = String(n - 1)
    })
    ctrl.querySelector('[data-qty-increase]')?.addEventListener('click', () => {
      const n = parseInt(valueEl.textContent || '1', 10)
      valueEl.textContent = String(n + 1)
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

      // Read quantity from adjacent qty control if present
      const actionsEl = btn.closest('[data-product-actions], .product-card__actions')
      const qtyEl     = actionsEl?.querySelector<HTMLElement>('[data-qty-value]')
      const qty        = qtyEl ? Math.max(1, parseInt(qtyEl.textContent || '1', 10)) : 1

      addItem({ id, title, subtitle, price, imageUrl, url }, qty)

      // Reset qty display back to 1
      if (qtyEl) qtyEl.textContent = '1'

      btn.classList.add('is-added')
      setTimeout(() => btn.classList.remove('is-added'), 1500)

      openCart()
    })
  })

  document.addEventListener('cart:updated', () => {
    updateCount()
    renderItems()
  })
}
