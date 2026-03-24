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
