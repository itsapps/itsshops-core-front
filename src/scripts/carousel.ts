import EmblaCarousel, { type EmblaOptionsType, type EmblaPluginType } from 'embla-carousel'
import Autoplay from 'embla-carousel-autoplay'
import Fade from 'embla-carousel-fade'

function initCarousel(el: HTMLElement) {
  const viewport = el.querySelector<HTMLElement>('.carousel-viewport')
  if (!viewport) return

  const loop          = el.dataset.loop          === 'true'
  const autoplay      = el.dataset.autoplay      === 'true'
  const fade          = el.dataset.fade          === 'true'
  const delay         = Number(el.dataset.delay  ?? 5) * 1000
  const duration      = el.dataset.duration      !== undefined ? Number(el.dataset.duration) : undefined
  const containScroll = el.dataset.containScroll !== undefined ? el.dataset.containScroll as EmblaOptionsType['containScroll'] : undefined

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const options: EmblaOptionsType = { loop }
  if (duration !== undefined)      options.duration      = duration
  if (reducedMotion)               options.duration      = 0
  if (containScroll !== undefined) options.containScroll = containScroll

  const plugins: EmblaPluginType[] = []
  if (fade || reducedMotion) plugins.push(Fade())
  if (autoplay)              plugins.push(Autoplay({ delay, stopOnInteraction: false, playOnInit: !reducedMotion }))

  const embla = EmblaCarousel(viewport, options, plugins)

  const pauseBtn = el.querySelector<HTMLButtonElement>('[data-carousel-pause]')
  if (pauseBtn && autoplay) {
    const pauseIcon      = pauseBtn.querySelector<SVGElement>('.carousel__pause-icon')
    const playIcon       = pauseBtn.querySelector<SVGElement>('.carousel__play-icon')
    const autoplayPlugin = embla.plugins().autoplay as ReturnType<typeof Autoplay> | undefined

    if (reducedMotion) {
      pauseBtn.setAttribute('aria-label', el.dataset.tPlay ?? 'Play')
      pauseIcon?.setAttribute('hidden', '')
      playIcon?.removeAttribute('hidden')
    }

    pauseBtn.addEventListener('click', () => {
      if (!autoplayPlugin) return
      if (autoplayPlugin.isPlaying()) {
        autoplayPlugin.stop()
        pauseBtn.setAttribute('aria-label', el.dataset.tPlay ?? 'Play')
        pauseIcon?.setAttribute('hidden', '')
        playIcon?.removeAttribute('hidden')
      } else {
        autoplayPlugin.play()
        pauseBtn.setAttribute('aria-label', el.dataset.tPause ?? 'Pause')
        playIcon?.setAttribute('hidden', '')
        pauseIcon?.removeAttribute('hidden')
      }
    })
  }
}

export function initCarousels() {
  document.querySelectorAll<HTMLElement>('[data-carousel]').forEach(initCarousel)
}
