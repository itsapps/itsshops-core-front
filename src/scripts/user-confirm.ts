import type { ConfirmInput, ConfirmResult } from '../shared/user-api'
import { setLocalUser } from './user-store'

/**
 * Confirmation requires an explicit button click. Auto-firing on page load
 * breaks when an email client (iOS Mail, link-scanning proxies) prefetches
 * the URL — the prefetch consumes the single-use OTP, so the user's actual
 * click hits an already-expired token.
 */
export function initUserConfirm(): void {
  const root = document.querySelector<HTMLElement>('[data-user-confirm]')
  if (!root) return

  const api = root.dataset.api ?? '/api/user/confirm'
  const locale = root.dataset.locale ?? document.documentElement.lang ?? 'de'
  const submitBtn = root.querySelector<HTMLButtonElement>('[data-user-confirm-submit]')
  const submitText = root.querySelector<HTMLElement>('[data-submit-text]')
  const submitLoading = root.querySelector<HTMLElement>('[data-submit-loading]')
  const errorEl = root.querySelector<HTMLElement>('[data-confirm-error]')
  const errorMsg = root.querySelector<HTMLElement>('[data-confirm-error-message]')

  const params = new URL(window.location.href).searchParams
  const token = params.get('token_hash')

  if (!token) {
    window.location.href = `/${locale}/`
    return
  }

  if (!submitBtn) return

  submitBtn.addEventListener('click', () => {
    setLoading(true)
    if (errorEl) errorEl.hidden = true

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
  })

  function setLoading(loading: boolean): void {
    if (submitBtn) submitBtn.disabled = loading
    if (submitText) submitText.hidden = loading
    if (submitLoading) submitLoading.hidden = !loading
  }

  function showError(message: string): void {
    setLoading(false)
    if (errorMsg) errorMsg.textContent = message
    if (errorEl) errorEl.hidden = false
  }
}
