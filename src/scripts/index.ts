import { initMenu } from './menu'
import { initAgeGate } from './age-gate'

console.groupCollapsed(
  '%c🍺 Site Credits',
  'display:block;padding:0.125em 4em;font-family:courier;font-size:24px;font-weight:bold;line-height:2;text-transform:uppercase;background:black;color:white;'
)
console.log(
  '%cDesign and Development by Thomas Heingärtner\nhttps://www.itsapps.at',
  'display:block;font-family:courier;font-size:19px;font-weight:bold;line-height:1;color:white;'
)
console.groupEnd()

initAgeGate()
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

if (document.querySelector('[data-search]')) {
  import('./search').then(m => m.init())
}
