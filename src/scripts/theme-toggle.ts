/**
 * Light/dark switch for `[data-theme-toggle]` buttons (`overridable/partials/theme-toggle.njk`,
 * rendered only with `manifest.colorScheme: 'light dark'`).
 *
 * Contract (shared with the inline `scripts/inline/theme.ts`): the choice is stored in
 * localStorage "theme" and set as `data-theme` on <html>; the inline script applies it before
 * paint on the next page and keeps the `theme-color` meta tags in sync. Without a stored choice
 * the page follows the system setting through CSS alone, and the button only mirrors it.
 *
 * The button is rendered `hidden` (it only works with JS) and revealed here. A toggle button with
 * a fixed label: `aria-pressed` carries the state ("Dunkles Design, gedrückt").
 */
const KEY = 'theme'

export function initThemeToggle(): void {
  const root = document.documentElement
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]'))
  if (!buttons.length) return
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)')

  const stored = (): string | null => {
    try {
      return localStorage.getItem(KEY)
    } catch {
      return null
    }
  }

  const current = (): 'light' | 'dark' => {
    const theme = root.getAttribute('data-theme') ?? stored()
    if (theme === 'light' || theme === 'dark') return theme
    return systemDark.matches ? 'dark' : 'light'
  }

  const reflect = (): void => {
    const pressed = String(current() === 'dark')
    buttons.forEach(button => button.setAttribute('aria-pressed', pressed))
  }

  buttons.forEach(button => {
    button.hidden = false
    button.addEventListener('click', () => {
      const next = current() === 'dark' ? 'light' : 'dark'
      root.setAttribute('data-theme', next)
      try {
        localStorage.setItem(KEY, next)
      } catch {
        // Private mode / blocked storage: the switch still works for this page.
      }
      reflect()
    })
  })

  // Only matters while no explicit choice is set.
  systemDark.addEventListener('change', reflect)
  reflect()
}
