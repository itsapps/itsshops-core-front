import { lockInertOutside } from './inert-lock'

export function initMenu() {
  document.querySelectorAll<HTMLButtonElement>('[data-menu-toggle]').forEach(btn => {
    // Prefer data-menu-toggle value, fall back to aria-controls
    const targetId = btn.dataset.menuToggle || btn.getAttribute('aria-controls') || ''
    const target = targetId ? document.getElementById(targetId) : null
    if (!target) return
    const el: HTMLElement = target

    // If the element starts hidden, manage the hidden attribute alongside aria-hidden
    const startsHidden = el.hasAttribute('hidden')
    let lock: { release: () => void } | null = null

    function close() {
      btn.dataset.closing = ''
      el.classList.remove('is-open')
      el.setAttribute('aria-hidden', 'true')
      el.setAttribute('inert', '')
      btn.setAttribute('aria-expanded', 'false')
      if (startsHidden) el.setAttribute('hidden', '')
      setTimeout(() => delete btn.dataset.closing, 300)
      lock?.release()
      lock = null
      btn.focus()
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

    btn.addEventListener('click', () => {
      el.classList.contains('is-open') ? close() : open()
    })

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && el.classList.contains('is-open')) close()
    })

    el.querySelector('[data-menu-close]')?.addEventListener('click', close)
  })
}
