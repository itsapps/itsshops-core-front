// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { initSubmenus } from '../submenu'

function setup() {
  document.body.innerHTML = `
    <nav id="site-nav">
      <ul>
        <li><a href="/a">A</a>
          <button type="button" data-submenu-toggle aria-expanded="false" aria-controls="sub-1">A sub</button>
          <ul id="sub-1"><li><a href="/a/1">A1</a></li></ul>
        </li>
        <li><button type="button" data-submenu-toggle aria-expanded="false" aria-controls="sub-2">B</button>
          <ul id="sub-2"><li><a href="/b/1">B1</a></li></ul>
        </li>
      </ul>
    </nav>
    <main><a href="/x" id="outside">X</a></main>`
  initSubmenus()
  const [t1, t2] = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-submenu-toggle]'))
  return { t1, t2, s1: document.getElementById('sub-1')!, s2: document.getElementById('sub-2')! }
}
const esc = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

describe('submenu disclosure', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('hides the lists at init and toggles on click', () => {
    const { t1, s1 } = setup()
    expect(s1.hidden).toBe(true)
    expect(t1.getAttribute('aria-expanded')).toBe('false')
    t1.click()
    expect(s1.hidden).toBe(false)
    expect(t1.getAttribute('aria-expanded')).toBe('true')
    t1.click()
    expect(s1.hidden).toBe(true)
  })

  it('opening one closes the other', () => {
    const { t1, t2, s1, s2 } = setup()
    t1.click()
    t2.click()
    expect(s1.hidden).toBe(true)
    expect(t1.getAttribute('aria-expanded')).toBe('false')
    expect(s2.hidden).toBe(false)
  })

  it('Escape closes and returns focus to the button when focus was inside', () => {
    const { t1, s1 } = setup()
    t1.click()
    s1.querySelector('a')!.focus()
    esc()
    expect(s1.hidden).toBe(true)
    expect(document.activeElement).toBe(t1)
  })

  it('a click outside the navigation closes without moving focus', () => {
    const { t1, s1 } = setup()
    t1.click()
    const outside = document.getElementById('outside')!
    outside.focus()
    outside.click()
    expect(s1.hidden).toBe(true)
    expect(document.activeElement).toBe(outside)
  })
})
