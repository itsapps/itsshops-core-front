import { clearCart } from './cart-store'

export function initOrderThanks(): void {
  const params = new URL(window.location.href).searchParams
  const redirectStatus = params.get('redirect_status')

  if (redirectStatus === 'succeeded') {
    clearCart()
    return
  }

  if (redirectStatus === 'failed') {
    const el = document.querySelector<HTMLElement>('[data-order-thanks]')
    const checkoutUrl = el?.dataset.checkoutUrl
    if (checkoutUrl) window.location.href = checkoutUrl
  }
}
