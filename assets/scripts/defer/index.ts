import "./app"
import "./search"
import "./sidebar"
import "./cookie-notice"

// lazy components
if (document.querySelector('[data-product-carousel]')) {
  import('./product-carousel');
}
if (document.querySelector('[data-content-carousel]')) {
  import('./content-carousel');
}
if (document.querySelector('[data-youtube]')) {
  import('./youtube');
}
if (document.querySelector('[data-side-cart]')) {
  import('./side-cart');
}
if (document.querySelector('[data-checkout]')) {
  import('./checkout');
}
if (document.querySelector('[data-order-thanks]')) {
  import('./order-thanks');
}
if (document.querySelector('[data-user-confirm]')) {
  import('./user-confirm');
}
if (document.querySelector('[data-user-login]')) {
  import('./user-login');
}
if (document.querySelector('[data-user-orders]')) {
  import('./user-orders');
}
if (document.querySelector('[data-user-recover-password]')) {
  import('./user-recover-password');
}
if (document.querySelector('[data-user-register]')) {
  import('./user-register');
}
if (document.querySelector('[data-user-reset-password]')) {
  import('./user-reset-password');
}