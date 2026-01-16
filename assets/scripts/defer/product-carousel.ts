import EmblaCarousel, {
  EmblaOptionsType,
  EmblaCarouselType
} from 'embla-carousel'

const setupEmbla = (main: HTMLElement, thumbs: HTMLElement) => {

  const addThumbBtnsClickHandlers = (
    emblaApiMain: EmblaCarouselType,
    emblaApiThumb: EmblaCarouselType
  ): (() => void) => {
    const slidesThumbs = emblaApiThumb.slideNodes()

    const scrollToIndex = slidesThumbs.map(
      (_, index) => (): void => emblaApiMain.scrollTo(index)
    )

    slidesThumbs.forEach((slideNode, index) => {
      slideNode.addEventListener('click', scrollToIndex[index], false)
    })

    return (): void => {
      slidesThumbs.forEach((slideNode, index) => {
        slideNode.removeEventListener('click', scrollToIndex[index], false)
      })
    }
  }

  const addToggleThumbBtnsActive = (
    emblaApiMain: EmblaCarouselType,
    emblaApiThumb: EmblaCarouselType
  ): (() => void) => {
    const slidesThumbs = emblaApiThumb.slideNodes()

    const toggleThumbBtnsState = (): void => {
      emblaApiThumb.scrollTo(emblaApiMain.selectedScrollSnap())
      const previous = emblaApiMain.previousScrollSnap()
      const selected = emblaApiMain.selectedScrollSnap()
      slidesThumbs[previous].classList.remove('embla-thumbs__slide--selected')
      slidesThumbs[selected].classList.add('embla-thumbs__slide--selected')
    }

    emblaApiMain.on('select', toggleThumbBtnsState)
    emblaApiThumb.on('init', toggleThumbBtnsState)

    return (): void => {
      const selected = emblaApiMain.selectedScrollSnap()
      slidesThumbs[selected].classList.remove('embla-thumbs__slide--selected')
    }
  }

  const OPTIONS: EmblaOptionsType = {}
  const OPTIONS_THUMBS: EmblaOptionsType = {
    containScroll: 'keepSnaps',
    dragFree: true
  }
  const emblaApiMain = EmblaCarousel(main, OPTIONS)
  if (thumbs) {
    const emblaApiThumb = EmblaCarousel(thumbs, OPTIONS_THUMBS)

    const removeThumbBtnsClickHandlers = addThumbBtnsClickHandlers(
      emblaApiMain,
      emblaApiThumb
    )
    const removeToggleThumbBtnsActive = addToggleThumbBtnsActive(
      emblaApiMain,
      emblaApiThumb
    )

    emblaApiMain
      .on('destroy', removeThumbBtnsClickHandlers)
      .on('destroy', removeToggleThumbBtnsActive)

    emblaApiThumb
      .on('destroy', removeThumbBtnsClickHandlers)
      .on('destroy', removeToggleThumbBtnsActive)
  }
}
const viewportNodeMainCarousel = < HTMLElement > (
  document.querySelector('.embla__viewport')
)
const viewportNodeThumbCarousel = < HTMLElement > (
  document.querySelector('.embla-thumbs__viewport')
)
if (viewportNodeMainCarousel && viewportNodeThumbCarousel) {
  setupEmbla(viewportNodeMainCarousel, viewportNodeThumbCarousel)
}