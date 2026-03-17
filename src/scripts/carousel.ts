function initCarousel(el: HTMLElement) {
  const slides = Array.from(el.querySelectorAll<HTMLElement>('.carousel-slide'))
  if (slides.length <= 1) return

  const loop     = el.dataset.loop     === 'true'
  const autoplay = el.dataset.autoplay === 'true'
  const delay    = Number(el.dataset.delay ?? 4000)
  let current = 0

  function show(index: number) {
    if (loop) index = ((index % slides.length) + slides.length) % slides.length
    else      index = Math.max(0, Math.min(index, slides.length - 1))
    slides[current].classList.remove('is-active')
    current = index
    slides[current].classList.add('is-active')
  }

  show(0)

  el.querySelector('[data-carousel-prev]')?.addEventListener('click', () => show(current - 1))
  el.querySelector('[data-carousel-next]')?.addEventListener('click', () => show(current + 1))

  if (autoplay) setInterval(() => show(current + 1), delay)
}

export function initCarousels() {
  document.querySelectorAll<HTMLElement>('.carousel').forEach(initCarousel)
}
