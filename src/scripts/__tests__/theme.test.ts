// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { initThemeToggle } from '../theme-toggle'

const LIGHT = '#FBFAF7'
const DARK = '#26272E'

function stubSystem(dark: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: dark && q.includes('dark'),
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

function setupHead() {
  document.head.innerHTML = `
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="${LIGHT}">
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="${DARK}">`
  document.body.innerHTML = `
    <button type="button" data-theme-toggle aria-pressed="false" hidden>T</button>`
}

const metas = () => Array.from(document.querySelectorAll('meta[name="theme-color"]')).map(m => m.getAttribute('content'))
const flush = () => new Promise(r => setTimeout(r, 0)) // MutationObserver callbacks are microtasks

async function runInline() {
  vi.resetModules()
  await import('../inline/theme')
}

afterEach(() => { vi.restoreAllMocks() })

describe('inline theme script', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme')
    localStorage.clear()
    setupHead()
  })

  it('without a stored choice leaves the meta tags on their system colours', async () => {
    await runInline()
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    expect(metas()).toEqual([LIGHT, DARK])
  })

  it('applies a stored choice and sets both meta tags to its colour', async () => {
    localStorage.setItem('theme', 'light')
    await runInline()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(metas()).toEqual([LIGHT, LIGHT])
  })

  it('follows later data-theme changes and restores the system colours when removed', async () => {
    await runInline()
    document.documentElement.setAttribute('data-theme', 'dark')
    await flush()
    expect(metas()).toEqual([DARK, DARK])
    document.documentElement.removeAttribute('data-theme')
    await flush()
    expect(metas()).toEqual([LIGHT, DARK])
  })

  it('survives blocked storage', async () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    await expect(runInline()).resolves.toBeUndefined()
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    expect(spy).toHaveBeenCalled()
  })
})

describe('theme toggle', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme')
    localStorage.clear()
    setupHead()
  })

  it('reveals the button and mirrors the system theme', () => {
    stubSystem(true)
    initThemeToggle()
    const btn = document.querySelector<HTMLButtonElement>('[data-theme-toggle]')!
    expect(btn.hidden).toBe(false)
    expect(btn.getAttribute('aria-pressed')).toBe('true')
  })

  it('switches, stores the choice and updates aria-pressed', () => {
    stubSystem(false)
    initThemeToggle()
    const btn = document.querySelector<HTMLButtonElement>('[data-theme-toggle]')!
    btn.click()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(btn.getAttribute('aria-pressed')).toBe('true')
    btn.click()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(btn.getAttribute('aria-pressed')).toBe('false')
  })
})
