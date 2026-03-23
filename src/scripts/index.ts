import { initMenu } from './menu'

initMenu()

if (document.querySelector('[data-carousel]')) {
  import('./carousel').then(m => m.initCarousels())
}
