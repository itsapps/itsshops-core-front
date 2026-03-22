import EmblaCarousel, { type EmblaOptionsType } from 'embla-carousel'
import Autoplay from 'embla-carousel-autoplay'

function initCarousel(el: HTMLElement) {
  const viewport = el.querySelector<HTMLElement>('.carousel-viewport')
  if (!viewport) return

  const loop          = el.dataset.loop          === 'true'
  const autoplay      = el.dataset.autoplay      === 'true'
  const fade          = el.dataset.fade          === 'true'
  const delay         = Number(el.dataset.delay  ?? 5) * 1000
  const duration      = el.dataset.duration      !== undefined ? Number(el.dataset.duration)      : undefined
  const containScroll = el.dataset.containScroll !== undefined ? el.dataset.containScroll as EmblaOptionsType['containScroll'] : undefined

  const options: EmblaOptionsType = { loop }
  if (fade)                        options.duration      = duration ?? 20
  if (duration !== undefined)      options.duration      = duration
  if (containScroll !== undefined) options.containScroll = containScroll

  const plugins = autoplay ? [Autoplay({ delay, stopOnInteraction: false })] : []

  EmblaCarousel(viewport, options, plugins)
}

export function initCarousels() {
  document.querySelectorAll<HTMLElement>('.carousel').forEach(initCarousel)
}
