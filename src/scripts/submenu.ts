/**
 * Submenu disclosure for `[data-submenu-toggle]` buttons (core's default header renders them for
 * menu items with children). Each button controls the list named by its `aria-controls`.
 *
 * - The lists are hidden here, at init — without JS they stay visible, so every link is reachable.
 * - Click toggles (`hidden` on the list, `aria-expanded` on the button); opening one closes the
 *   other open submenus of the same navigation.
 * - Escape closes the open submenu and returns focus to its button if focus was inside it.
 * - A click outside the navigation closes its open submenus (focus stays where it is).
 */
type Entry = { btn: HTMLButtonElement; list: HTMLElement; nav: Element }

export function initSubmenus(): void {
  const entries: Entry[] = []
  for (const btn of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-submenu-toggle]'))) {
    const id = btn.getAttribute('aria-controls')
    const list = id ? document.getElementById(id) : null
    if (list) entries.push({ btn, list, nav: btn.closest('nav') ?? document.body })
  }

  const isOpen = (e: Entry) => e.btn.getAttribute('aria-expanded') === 'true'
  const setOpen = (e: Entry, open: boolean) => {
    e.btn.setAttribute('aria-expanded', String(open))
    e.list.hidden = !open
  }

  for (const e of entries) {
    setOpen(e, false)
    e.btn.addEventListener('click', () => {
      const open = !isOpen(e)
      if (open) for (const other of entries) if (other !== e && other.nav === e.nav) setOpen(other, false)
      setOpen(e, open)
    })
  }

  document.addEventListener('keydown', ev => {
    if (ev.key !== 'Escape') return
    for (const e of entries) {
      if (!isOpen(e)) continue
      const focusInside = e.list.contains(document.activeElement)
      setOpen(e, false)
      if (focusInside) e.btn.focus()
    }
  })

  document.addEventListener('click', ev => {
    const target = ev.target as Node | null
    for (const e of entries) if (isOpen(e) && target && !e.nav.contains(target)) setOpen(e, false)
  })
}
