export function initAgeGate(): void {
  const el = document.querySelector<HTMLElement>('[data-age-gate]')
  if (!el) return

  const root = document.documentElement
  const storageKey = 'ageGate.confirmed'

  let stored: string | null = null
  try { stored = localStorage.getItem(storageKey) } catch { /* ignore */ }

  if (stored === '1') {
    root.removeAttribute('data-age-gate-state')
    el.remove()
    return
  }

  // Show overlay and lock scroll.
  el.hidden = false
  root.setAttribute('data-age-gate-state', 'open')

  const deniedMsg = el.querySelector<HTMLElement>('[data-age-gate-denied-msg]')
  const confirmBtn = el.querySelector<HTMLButtonElement>('[data-age-gate-confirm]')
  const denyBtn = el.querySelector<HTMLButtonElement>('[data-age-gate-deny]')

  confirmBtn?.addEventListener('click', () => {
    try { localStorage.setItem(storageKey, '1') } catch { /* ignore */ }
    root.removeAttribute('data-age-gate-state')
    el.remove()
  })

  denyBtn?.addEventListener('click', () => {
    try { localStorage.removeItem(storageKey) } catch { /* ignore */ }
    if (deniedMsg) deniedMsg.hidden = false
    denyBtn.disabled = true
  })

  // Focus the confirm button for keyboard users.
  requestAnimationFrame(() => confirmBtn?.focus())
}
