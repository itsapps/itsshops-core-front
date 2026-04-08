import { initMenu } from './menu'

initMenu()

if (document.querySelector('[data-carousel]')) {
  import('./carousel').then(m => m.initCarousels())
}

if (document.querySelector('[data-product-list]')) {
  import('./product-filter').then(m => m.initProductFilter())
}

if (document.querySelector('[data-gallery]')) {
  import('./gallery').then(m => m.initGallery())
}

if (document.getElementById('cart-sidebar')) {
  import('./cart-ui').then(m => m.initCart())
}

if (document.querySelector('[data-checkout]')) {
  import('./checkout').then(m => m.initCheckout())
}

if (document.querySelector('[data-order-thanks]')) {
  import('./order-thanks').then(m => m.initOrderThanks())
}
