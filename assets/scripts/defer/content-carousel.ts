import EmblaCarousel, {
  EmblaOptionsType,
  EmblaCarouselType,
  EmblaPluginType,
} from 'embla-carousel'
import Autoplay from 'embla-carousel-autoplay'
import Fade from 'embla-carousel-fade'
import { userPrefersReducedMotion } from '../lib/utils';

type CarouselOptions = {
  autoplay: boolean
  autoplayDelay: number
  loop: boolean,
  fullWidthSlides: boolean,
  fade: boolean,
}
const setupEmbla = (
  main: HTMLElement,
  thumbs: HTMLElement | undefined,
  carouselOptions: CarouselOptions = {
    autoplay: false,
    autoplayDelay: 5000,
    loop: false,
    fullWidthSlides: true,
    fade: false
  }
) => {

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

  const plugins: EmblaPluginType[] = []
  const reducedMotion = userPrefersReducedMotion()
  if (reducedMotion) {
    plugins.push(Fade())
  } else {
    if (carouselOptions.fade) {
      plugins.push(Fade())
    }
    if (carouselOptions.autoplay) {
      plugins.push(Autoplay({ playOnInit: true, delay: carouselOptions.autoplayDelay, stopOnInteraction: true }))
    }
  }
  const options: EmblaOptionsType = {
    loop: carouselOptions.loop,
    // duration: 20
  }
  const optionsThumbs: EmblaOptionsType = {
    containScroll: 'keepSnaps',
    dragFree: true
  }
  const emblaApiMain = EmblaCarousel(main, options, plugins)
  if (thumbs) {
    const emblaApiThumb = EmblaCarousel(thumbs, optionsThumbs)

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

  // turn on/off videos
  // emblaApiMain.on('select', (): void => {
  //   const slidesMain = emblaApiMain.slideNodes()
  //   const slidesInView = emblaApiMain.slidesInView()
  //   const selected = emblaApiMain.selectedScrollSnap()
  //   slidesMain.forEach((s, i) => {
  //     const video = s.querySelector('video') as HTMLVideoElement;
  //     if (video) {
  //       const test = carouselOptions.fullWidthSlides ? (selected == i) : (slidesInView.includes(i))
  //       if (test) {
  //         if (video.paused) {
  //           video.play()
  //         }
  //       } else {
  //         if (!video.paused) {
  //           video.pause()
  //         }
  //       }
  //     }
  //   })
  // })

  // handle prev/next buttons
  const addTogglePrevNextBtnsActive = (
    emblaApi: EmblaCarouselType,
    prevBtn: HTMLElement,
    nextBtn: HTMLElement
  ): (() => void) => {
    const togglePrevNextBtnsState = (): void => {
      if (emblaApi.canScrollPrev()) prevBtn.removeAttribute('disabled')
      else prevBtn.setAttribute('disabled', 'disabled')

      if (emblaApi.canScrollNext()) nextBtn.removeAttribute('disabled')
      else nextBtn.setAttribute('disabled', 'disabled')
    }

    emblaApi
      .on('select', togglePrevNextBtnsState)
      .on('init', togglePrevNextBtnsState)
      .on('reInit', togglePrevNextBtnsState)

    return (): void => {
      prevBtn.removeAttribute('disabled')
      nextBtn.removeAttribute('disabled')
    }
  }

  const addPrevNextBtnsClickHandlers = (
    emblaApi: EmblaCarouselType,
    prevBtn: HTMLElement,
    nextBtn: HTMLElement
  ): (() => void) => {
    const scrollPrev = (): void => {
      emblaApi.scrollPrev()
    }
    const scrollNext = (): void => {
      emblaApi.scrollNext()
    }
    prevBtn.addEventListener('click', scrollPrev, false)
    nextBtn.addEventListener('click', scrollNext, false)

    const removeTogglePrevNextBtnsActive = addTogglePrevNextBtnsActive(
      emblaApi,
      prevBtn,
      nextBtn
    )

    return (): void => {
      removeTogglePrevNextBtnsActive()
      prevBtn.removeEventListener('click', scrollPrev, false)
      nextBtn.removeEventListener('click', scrollNext, false)
    }
  }

  const prevBtn = <HTMLElement>main.querySelector('.embla--controls-prev')
  const nextBtn = <HTMLElement>main.querySelector('.embla--controls-next')
  if (prevBtn && nextBtn) {
    const removePrevNextBtnsClickHandlers = addPrevNextBtnsClickHandlers(
      emblaApiMain,
      prevBtn,
      nextBtn
    )
    emblaApiMain.on('destroy', removePrevNextBtnsClickHandlers)  
  }
}

const emblaViewports = document.querySelectorAll('[data-content-carousel]') as NodeListOf<HTMLElement>
emblaViewports.forEach(viewport => {
  const dataset = viewport.dataset
  const autoplay = dataset.autoplay !== undefined ? (dataset.autoplay === 'true') : false
  const autoplayDelay = dataset.autoplayDelay !== undefined ? (Number(dataset.autoplayDelay)*1000) : 5000
  const loop = dataset.loop !== undefined ? (dataset.loop === 'true') : false
  const fade = dataset.fade !== undefined ? (dataset.fade === 'true') : false
  setupEmbla(viewport, undefined, {
    autoplay,
    autoplayDelay,
    loop,
    fullWidthSlides: true,
    fade,
  })
})