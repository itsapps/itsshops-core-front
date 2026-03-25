export function initMenu() {
  document.querySelectorAll<HTMLButtonElement>('[data-menu-toggle]').forEach(btn => {
    const targetId = btn.dataset.menuToggle
    const target = targetId ? document.getElementById(targetId) : null
    if (!target) return
    const el: HTMLElement = target

    function close() {
      btn.dataset.closing = ''
      el.classList.remove('is-open')
      el.setAttribute('aria-hidden', 'true')
      btn.setAttribute('aria-expanded', 'false')
      document.body.classList.remove('menu-open')
      setTimeout(() => delete btn.dataset.closing, 300)
    }

    function open() {
      el.classList.add('is-open')
      el.setAttribute('aria-hidden', 'false')
      btn.setAttribute('aria-expanded', 'true')
      document.body.classList.add('menu-open')
    }

    btn.addEventListener('click', () => {
      el.classList.contains('is-open') ? close() : open()
    })

    // Close on Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && el.classList.contains('is-open')) close()
    })

    // Close button inside the target (optional)
    el.querySelector('[data-menu-close]')?.addEventListener('click', close)
  })
}
