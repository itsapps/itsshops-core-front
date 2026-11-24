// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { initMenu } from '../menu'

// jsdom has no layout: stub the toggle's getClientRects to say whether it is rendered.
function setRendered(btn: HTMLElement, rendered: boolean) {
  btn.getClientRects = () => (rendered ? [{} as DOMRect] : []) as unknown as DOMRectList
}
const resize = () => window.dispatchEvent(new Event('resize'))

function setup(targetAttrs = '') {
  document.body.innerHTML = `
    <header>
      <button type="button" data-menu-toggle="site-nav" aria-controls="site-nav" aria-expanded="false">Menu</button>
      <nav id="site-nav" ${targetAttrs}><a href="/a">A</a></nav>
    </header>
    <main><a href="/b">B</a></main>`
  const btn = document.querySelector<HTMLButtonElement>('[data-menu-toggle]')!
  const nav = document.getElementById('site-nav')!
  setRendered(btn, true)
  initMenu()
  return { btn, nav, main: document.querySelector('main')! }
}

describe('menu: state after the toggle stops being rendered', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('core default target (no initial attrs) is reachable again after open → close → resize', () => {
    const { btn, nav } = setup()
    btn.click()
    btn.click()
    expect(nav.hasAttribute('inert')).toBe(true)
    setRendered(btn, false)
    resize()
    expect(nav.hasAttribute('inert')).toBe(false)
    expect(nav.hasAttribute('aria-hidden')).toBe(false)
  })

  it('an open overlay starting inert/aria-hidden closes without moving focus and keeps its start state', () => {
    const { btn, nav, main } = setup('inert aria-hidden="true"')
    btn.click()
    expect(nav.classList.contains('is-open')).toBe(true)
    expect(main.hasAttribute('inert')).toBe(true)
    const link = nav.querySelector('a')!
    expect(document.activeElement).toBe(link)
    setRendered(btn, false)
    resize()
    expect(nav.classList.contains('is-open')).toBe(false)
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    expect(nav.hasAttribute('inert')).toBe(true)
    expect(nav.getAttribute('aria-hidden')).toBe('true')
    expect(main.hasAttribute('inert')).toBe(false)
    expect(document.activeElement).not.toBe(btn)
  })

  it('a target starting hidden gets hidden back', () => {
    const { btn, nav } = setup('hidden')
    btn.click()
    expect(nav.hasAttribute('hidden')).toBe(false)
    setRendered(btn, false)
    resize()
    expect(nav.hasAttribute('hidden')).toBe(true)
    expect(nav.hasAttribute('inert')).toBe(false)
  })

  it('resize while the toggle is rendered changes nothing', () => {
    const { btn, nav, main } = setup()
    btn.click()
    resize()
    expect(nav.classList.contains('is-open')).toBe(true)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    expect(main.hasAttribute('inert')).toBe(true)
  })
})
