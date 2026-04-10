import type { RecoverInput, RecoverResult } from '../shared/user-api'

export function initUserRecover(): void {
  const root = document.querySelector<HTMLElement>('[data-user-recover]')
  if (!root) return

  const api = root.dataset.api ?? '/api/user/recover'
  const locale = root.dataset.locale ?? document.documentElement.lang ?? 'de'
  const form = root.querySelector<HTMLFormElement>('form')
  if (!form) return

  const submitBtn = form.querySelector<HTMLButtonElement>('[type="submit"]')
  const submitText = form.querySelector<HTMLElement>('[data-submit-text]')
  const submitLoading = form.querySelector<HTMLElement>('[data-submit-loading]')
  const formError = form.querySelector<HTMLElement>('[data-form-error]')

  function setFieldError(field: string, message: string | null): void {
    const el = form!.querySelector<HTMLElement>(`[data-field-error="${field}"]`)
    if (!el) return
    el.textContent = message ?? ''
    el.hidden = !message
  }

  function setLoading(loading: boolean): void {
    if (submitBtn) submitBtn.disabled = loading
    if (submitText) submitText.hidden = loading
    if (submitLoading) submitLoading.hidden = !loading
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (formError) formError.hidden = true
    setFieldError('email', null)
    setLoading(true)

    const body: RecoverInput = {
      email: (new FormData(form).get('email') as string) ?? '',
    }

    try {
      const res = await fetch(api, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-locale': locale },
        body: JSON.stringify(body),
      })
      const json = await res.json() as { redirectUrl?: string; error?: { message?: string; details?: Record<string, string> } }

      if (res.ok && json.redirectUrl) {
        window.location.href = json.redirectUrl
        return
      }

      if (json.error?.details?.email) {
        setFieldError('email', json.error.details.email)
      } else if (json.error?.message && formError) {
        formError.textContent = json.error.message
        formError.hidden = false
      }
    } catch {
      if (formError) {
        formError.textContent = root.dataset.tErrorService ?? 'Service unavailable'
        formError.hidden = false
      }
    } finally {
      setLoading(false)
    }
  })
}
