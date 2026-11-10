// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { initGallery } from '../gallery' // vi.mock below is hoisted above this import

// Minimal embla stub: records event handlers and the selected index per instance.
type Handler = () => void
const instances: { handlers: Record<string, Handler[]>; selected: number; previous: number; root: HTMLElement }[] = []
vi.mock('embla-carousel', () => ({
  default: (root: HTMLElement) => {
    const inst = { handlers: {} as Record<string, Handler[]>, selected: 0, previous: 0, root }
    instances.push(inst)
    const api = {
      on: (ev: string, fn: Handler) => { (inst.handlers[ev] ??= []).push(fn); return api },
      scrollTo: (i: number) => { inst.previous = inst.selected; inst.selected = i },
      selectedScrollSnap: () => inst.selected,
      previousScrollSnap: () => inst.previous,
      slideNodes: () => Array.from(root.querySelectorAll<HTMLElement>('.embla-thumbs__slide')),
    }
    return api
  },
}))


describe('gallery thumbs', () => {
  beforeEach(() => { instances.length = 0 })

  it('moves aria-current to the selected thumb', () => {
    document.body.innerHTML = `
      <div data-gallery>
        <div class="embla"><div class="embla__viewport"><div class="embla__container"></div></div></div>
        <div class="embla-thumbs"><div class="embla-thumbs__viewport"><div class="embla-thumbs__container">
          <div class="embla-thumbs__slide embla-thumbs__slide--selected"><button aria-current="true">1</button></div>
          <div class="embla-thumbs__slide"><button>2</button></div>
        </div></div></div>
      </div>`
    initGallery()
    const [main] = instances
    main.previous = 0
    main.selected = 1
    main.handlers.select.forEach(fn => fn())
    const buttons = document.querySelectorAll('.embla-thumbs__slide button')
    expect(buttons[0].hasAttribute('aria-current')).toBe(false)
    expect(buttons[1].getAttribute('aria-current')).toBe('true')
    expect(buttons[1].parentElement!.classList.contains('embla-thumbs__slide--selected')).toBe(true)
  })
})
