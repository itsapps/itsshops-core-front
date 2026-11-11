// Inlined in <head> (manifest.colorScheme != 'light'), runs synchronously before paint:
// 1. applies the stored choice (localStorage "theme") as data-theme on <html> — no flash of the
//    wrong theme. localStorage can throw (blocked site data, some private modes); the page then
//    follows the system theme.
// 2. keeps the `theme-color` meta tags (browser chrome: Safari's tab bar, mobile toolbars) on the
//    page's theme: with an explicit data-theme both tags get that theme's colour, without one
//    they follow the system again via their `media`. It watches data-theme, so any toggle that
//    sets it (core's theme-toggle.ts or a customer's) is followed. The tags come earlier in the
//    head (core/head/favicons.njk), so they exist here.
;(function () {
  const root = document.documentElement
  const metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"][media]'))
  const original = metas.map(m => m.getAttribute('content') ?? '')
  const colorFor: Record<string, string> = {}
  metas.forEach((m, i) => {
    const media = m.getAttribute('media') ?? ''
    if (media.includes('dark')) colorFor.dark = original[i]
    else if (media.includes('light')) colorFor.light = original[i]
  })

  const sync = () => {
    const theme = root.getAttribute('data-theme')
    const color = theme ? colorFor[theme] : undefined
    metas.forEach((m, i) => m.setAttribute('content', color ?? original[i]))
  }

  try {
    const theme = localStorage.getItem('theme')
    if (theme) root.setAttribute('data-theme', theme)
  } catch {
    /* no storage: system theme */
  }

  if (metas.length) {
    sync()
    new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-theme'] })
  }
})()

// A module only for the tests' import; the IIFE build drops it.
export {}
