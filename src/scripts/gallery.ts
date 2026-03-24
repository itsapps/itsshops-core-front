import EmblaCarousel, { type EmblaOptionsType } from 'embla-carousel'

function setupGallery(scope: HTMLElement): void {
  const mainViewport   = scope.querySelector<HTMLElement>('.embla__viewport')
  const thumbsViewport = scope.querySelector<HTMLElement>('.embla-thumbs__viewport')
  if (!mainViewport) return

  const emblaMain = EmblaCarousel(mainViewport, {})
  if (!thumbsViewport) return

  const OPTIONS_THUMBS: EmblaOptionsType = { containScroll: 'keepSnaps', dragFree: true }
  const emblaThumb = EmblaCarousel(thumbsViewport, OPTIONS_THUMBS)
  const thumbSlides = emblaThumb.slideNodes()

  const scrollHandlers = thumbSlides.map((_, i) => () => emblaMain.scrollTo(i))
  thumbSlides.forEach((slide, i) => slide.addEventListener('click', scrollHandlers[i]))

  const syncSelected = (): void => {
    const prev = emblaMain.previousScrollSnap()
    const curr = emblaMain.selectedScrollSnap()
    thumbSlides[prev]?.classList.remove('embla-thumbs__slide--selected')
    thumbSlides[curr]?.classList.add('embla-thumbs__slide--selected')
    emblaThumb.scrollTo(curr)
  }

  emblaMain.on('select', syncSelected)
  emblaThumb.on('init', syncSelected)

  const cleanup = (): void => {
    thumbSlides.forEach((slide, i) => slide.removeEventListener('click', scrollHandlers[i]))
  }
  emblaMain.on('destroy', cleanup)
  emblaThumb.on('destroy', cleanup)
}

export function initGallery(): void {
  document.querySelectorAll<HTMLElement>('[data-gallery]').forEach(setupGallery)
}
