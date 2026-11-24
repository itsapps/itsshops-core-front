import { lockInertOutside } from './inert-lock'

export function initMenu() {
  document.querySelectorAll<HTMLButtonElement>('[data-menu-toggle]').forEach(btn => {
    // Prefer data-menu-toggle value, fall back to aria-controls
    const targetId = btn.dataset.menuToggle || btn.getAttribute('aria-controls') || ''
    const target = targetId ? document.getElementById(targetId) : null
    if (!target) return
    const el: HTMLElement = target

    // The target's initial state — restored when the toggle stops being rendered (see resize).
    // If the element starts hidden, manage the hidden attribute alongside aria-hidden.
    const startsHidden = el.hasAttribute('hidden')
    const startsInert = el.hasAttribute('inert')
    const startsAriaHidden = el.getAttribute('aria-hidden')
    let lock: { release: () => void } | null = null

    function close({ focus = true }: { focus?: boolean } = {}) {
      btn.dataset.closing = ''
      el.classList.remove('is-open')
      el.setAttribute('aria-hidden', 'true')
      el.setAttribute('inert', '')
      btn.setAttribute('aria-expanded', 'false')
      if (startsHidden) el.setAttribute('hidden', '')
      setTimeout(() => delete btn.dataset.closing, 300)
      lock?.release()
      lock = null
      if (focus) btn.focus()
    }

    function open() {
      if (startsHidden) el.removeAttribute('hidden')
      el.classList.add('is-open')
      el.setAttribute('aria-hidden', 'false')
      el.removeAttribute('inert')
      btn.setAttribute('aria-expanded', 'true')
      lock = lockInertOutside([el, btn])
      const firstFocusable = el.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      firstFocusable?.focus()
    }

    function restoreInitialState() {
      el.toggleAttribute('hidden', startsHidden)
      el.toggleAttribute('inert', startsInert)
      if (startsAriaHidden === null) el.removeAttribute('aria-hidden')
      else el.setAttribute('aria-hidden', startsAriaHidden)
    }

    // `getClientRects`, not `offsetParent`: the latter is null for a `position: fixed` button.
    const isRendered = () => btn.getClientRects().length > 0

    btn.addEventListener('click', () => {
      el.classList.contains('is-open') ? close() : open()
    })

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && el.classList.contains('is-open')) close()
    })

    el.querySelector('[data-menu-close]')?.addEventListener('click', () => close())

    // When the toggle disappears (window widened past the breakpoint where the menu shows
    // inline, or the burger is hidden), an open menu must not stay open with the page inert,
    // and a menu that is inline on large screens must not stay inert/aria-hidden from an earlier
    // close. The toggle's own CSS visibility is the single source — no breakpoint here.
    window.addEventListener('resize', () => {
      if (isRendered()) return
      if (el.classList.contains('is-open')) close({ focus: false })
      restoreInitialState()
    })
  })
}
