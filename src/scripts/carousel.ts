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

  const embla = EmblaCarousel(viewport, options, plugins)

  const pauseBtn = el.querySelector<HTMLButtonElement>('[data-carousel-pause]')
  if (pauseBtn && autoplay) {
    const pauseIcon = pauseBtn.querySelector<SVGElement>('.carousel__pause-icon')
    const playIcon = pauseBtn.querySelector<SVGElement>('.carousel__play-icon')
    const autoplayPlugin = embla.plugins().autoplay as ReturnType<typeof Autoplay> | undefined

    pauseBtn.addEventListener('click', () => {
      if (!autoplayPlugin) return
      if (autoplayPlugin.isPlaying()) {
        autoplayPlugin.stop()
        pauseBtn.setAttribute('aria-label', el.dataset.tPlay ?? 'Play')
        if (pauseIcon) pauseIcon.setAttribute('hidden', '')
        if (playIcon) playIcon.removeAttribute('hidden')
      } else {
        autoplayPlugin.play()
        pauseBtn.setAttribute('aria-label', el.dataset.tPause ?? 'Pause')
        if (playIcon) playIcon.setAttribute('hidden', '')
        if (pauseIcon) pauseIcon.removeAttribute('hidden')
      }
    })
  }
}

export function initCarousels() {
  document.querySelectorAll<HTMLElement>('[data-carousel]').forEach(initCarousel)
}
