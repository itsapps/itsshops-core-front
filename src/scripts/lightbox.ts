/**
 * Lightbox gallery viewer (loaded on first open — see scripts/index.ts).
 *
 * Reads a `[data-lightbox]` container's JSON items and shows them in a shared
 * <dialog>: Embla-driven slide track (swipe/drag), prev/next + counter + caption
 * + per-image download + close. Nav/counter auto-hide for a single image.
 */
import EmblaCarousel, { type EmblaCarouselType, type EmblaOptionsType } from 'embla-carousel'

type Item = {
  src: string
  srcset: string
  sizes: string
  width: number
  height?: number
  alt: string
  caption: string
  download: string
}

let dialog: HTMLDialogElement | null = null
let embla: EmblaCarouselType | null = null
let track: HTMLElement
let elPrev: HTMLButtonElement
let elNext: HTMLButtonElement
let elCounter: HTMLElement
let elCaption: HTMLElement
let elDownload: HTMLAnchorElement
let items: Item[] = []
let lastFocused: HTMLElement | null = null

function attr(s: unknown): string {
  return String(s ?? '').replace(/"/g, '&quot;')
}

function build(): void {
  dialog = document.createElement('dialog')
  dialog.className = 'lightbox'
  dialog.innerHTML = `
    <button type="button" class="lightbox__close" data-lb-close>&times;</button>
    <button type="button" class="lightbox__nav lightbox__nav--prev" data-lb-prev>&lsaquo;</button>
    <div class="lightbox__viewport"><div class="lightbox__track"></div></div>
    <button type="button" class="lightbox__nav lightbox__nav--next" data-lb-next>&rsaquo;</button>
    <div class="lightbox__bar">
      <span class="lightbox__counter" aria-live="polite"></span>
      <span class="lightbox__caption"></span>
      <a class="lightbox__download" target="_blank" rel="noopener" hidden></a>
    </div>`
  document.body.appendChild(dialog)

  track       = dialog.querySelector('.lightbox__track') as HTMLElement
  elPrev      = dialog.querySelector('[data-lb-prev]') as HTMLButtonElement
  elNext      = dialog.querySelector('[data-lb-next]') as HTMLButtonElement
  elCounter   = dialog.querySelector('.lightbox__counter') as HTMLElement
  elCaption   = dialog.querySelector('.lightbox__caption') as HTMLElement
  elDownload  = dialog.querySelector('.lightbox__download') as HTMLAnchorElement

  elPrev.addEventListener('click', () => embla?.scrollPrev())
  elNext.addEventListener('click', () => embla?.scrollNext())
  dialog.querySelector('[data-lb-close]')!.addEventListener('click', () => dialog!.close())
  // backdrop click closes
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog!.close() })
  // arrow keys navigate
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') embla?.scrollPrev()
    else if (e.key === 'ArrowRight') embla?.scrollNext()
  })
  // teardown + restore focus on close (Esc closes natively)
  dialog.addEventListener('close', () => {
    embla?.destroy()
    embla = null
    track.innerHTML = ''
    lastFocused?.focus()
  })
}

function update(): void {
  const i = embla ? embla.selectedScrollSnap() : 0
  const it = items[i]
  elCounter.textContent = `${i + 1}/${items.length}`
  elCaption.textContent = it?.caption ?? ''
  // keep only the current slide in the a11y tree
  const slides = track.children
  for (let s = 0; s < slides.length; s++) {
    slides[s].toggleAttribute('aria-hidden', s !== i)
  }
  // disable nav at the bounds (no looping)
  if (embla) {
    elPrev.disabled = !embla.canScrollPrev()
    elNext.disabled = !embla.canScrollNext()
  }
  if (it?.download) {
    elDownload.href = it.download
    elDownload.textContent = elDownload.dataset.label ?? ''
    elDownload.hidden = false
  } else {
    elDownload.hidden = true
  }
}

export function open(trigger: HTMLElement): void {
  const container = trigger.closest<HTMLElement>('[data-lightbox]')
  const raw = container?.querySelector('[data-lightbox-items]')?.textContent
  if (!container || !raw) return
  try { items = JSON.parse(raw) } catch { return }
  if (!items.length) return

  if (!dialog) build()

  // localized labels from the container
  dialog!.setAttribute('aria-label', container.dataset.labelDialog ?? 'Image gallery')
  elPrev.setAttribute('aria-label', container.dataset.labelPrev ?? 'Previous')
  elNext.setAttribute('aria-label', container.dataset.labelNext ?? 'Next')
  ;(dialog!.querySelector('[data-lb-close]') as HTMLElement).setAttribute('aria-label', container.dataset.labelClose ?? 'Close')
  elDownload.dataset.label = container.dataset.labelDownload ?? 'Download'

  const start = Number(trigger.dataset.galleryIndex) || 0
  const single = items.length <= 1
  dialog!.classList.toggle('lightbox--single', single)

  track.innerHTML = items
    .map((it, i) => {
      const near = Math.abs(i - start) <= 1
      return (
        `<div class="lightbox__slide">` +
        `<img src="${attr(it.src)}" srcset="${attr(it.srcset)}" sizes="${attr(it.sizes)}"` +
        ` width="${it.width}"${it.height ? ` height="${it.height}"` : ''} alt="${attr(it.alt)}"` +
        ` loading="${near ? 'eager' : 'lazy'}"${near ? ' fetchpriority="high"' : ''}>` +
        `</div>`
      )
    })
    .join('')

  lastFocused = document.activeElement as HTMLElement
  // show first so the viewport has real dimensions — otherwise Embla measures 0
  // (closed dialogs are display:none) and slides snap without animating
  dialog!.showModal()

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // NB: don't pass `duration: undefined` — it overrides Embla's default and kills
  // the animation. Only set it (to 0) when reducing motion.
  const opts: EmblaOptionsType = { startIndex: start, loop: false, active: !single }
  if (reduceMotion) opts.duration = 0
  embla?.destroy()
  embla = EmblaCarousel(dialog!.querySelector('.lightbox__viewport') as HTMLElement, opts)
  embla.on('select', update)
  update()
}
