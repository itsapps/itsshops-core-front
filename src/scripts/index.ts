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

if (document.querySelector('[data-user-register]')) {
  import('./user-register').then(m => m.initUserRegister())
}

if (document.querySelector('[data-user-login]')) {
  import('./user-login').then(m => m.initUserLogin())
}

if (document.querySelector('[data-user-confirm]')) {
  import('./user-confirm').then(m => m.initUserConfirm())
}

if (document.querySelector('[data-user-recover]')) {
  import('./user-recover').then(m => m.initUserRecover())
}

if (document.querySelector('[data-user-reset]')) {
  import('./user-reset').then(m => m.initUserReset())
}
