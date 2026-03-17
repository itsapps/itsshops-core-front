export function initMenu() {
  document.querySelectorAll<HTMLButtonElement>('[data-menu-toggle]').forEach(btn => {
    const targetId = btn.dataset.menuToggle
    const target = targetId ? document.getElementById(targetId) : null
    if (!target) return

    function close() {
      target.classList.remove('is-open')
      target.setAttribute('aria-hidden', 'true')
      btn.setAttribute('aria-expanded', 'false')
      document.body.classList.remove('menu-open')
    }

    function open() {
      target.classList.add('is-open')
      target.setAttribute('aria-hidden', 'false')
      btn.setAttribute('aria-expanded', 'true')
      document.body.classList.add('menu-open')
    }

    btn.addEventListener('click', () => {
      target.classList.contains('is-open') ? close() : open()
    })

    // Close on Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && target.classList.contains('is-open')) close()
    })

    // Close button inside the target (optional)
    target.querySelector('[data-menu-close]')?.addEventListener('click', close)
  })
}
