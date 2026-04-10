import type { ConfirmInput, ConfirmResult } from '../shared/user-api'
import { setLocalUser } from './user-store'

export function initUserConfirm(): void {
  const root = document.querySelector<HTMLElement>('[data-user-confirm]')
  if (!root) return

  const api = root.dataset.api ?? '/api/user/confirm'
  const locale = root.dataset.locale ?? document.documentElement.lang ?? 'de'
  const loadingEl = root.querySelector<HTMLElement>('[data-confirm-loading]')
  const errorEl = root.querySelector<HTMLElement>('[data-confirm-error]')
  const errorMsg = root.querySelector<HTMLElement>('[data-confirm-error-message]')

  const params = new URL(window.location.href).searchParams
  const token = params.get('token_hash')

  if (!token) {
    window.location.href = `/${locale}/`
    return
  }

  if (loadingEl) loadingEl.hidden = false

  const body: ConfirmInput = { token }

  fetch(api, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-locale': locale },
    body: JSON.stringify(body),
  })
    .then(res => res.json() as Promise<{ user?: ConfirmResult['user']; redirectUrl?: string; error?: { message?: string } }>)
    .then(json => {
      if (json.user) setLocalUser(json.user)
      if (json.redirectUrl) {
        window.location.href = json.redirectUrl
      } else {
        showError(json.error?.message ?? 'Confirmation failed')
      }
    })
    .catch(() => showError('Service unavailable'))

  function showError(message: string): void {
    if (loadingEl) loadingEl.hidden = true
    if (errorMsg) errorMsg.textContent = message
    if (errorEl) errorEl.hidden = false
  }
}
