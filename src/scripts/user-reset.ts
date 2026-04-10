import type { ResetInput, ResetResult } from '../shared/user-api'
import { deleteLocalUser } from './user-store'

export function initUserReset(): void {
  const root = document.querySelector<HTMLElement>('[data-user-reset]')
  if (!root) return

  const api = root.dataset.api ?? '/api/user/reset'
  const locale = root.dataset.locale ?? document.documentElement.lang ?? 'de'
  const form = root.querySelector<HTMLFormElement>('form')
  if (!form) return

  const params = new URL(window.location.href).searchParams
  const token = params.get('token_hash')
  const type = params.get('type') ?? undefined

  // No token → redirect home
  if (!token) {
    window.location.href = `/${locale}/`
    return
  }

  // Enable submit now that we have a token
  const submitBtn = form.querySelector<HTMLButtonElement>('[data-reset-submit]')
  if (submitBtn) submitBtn.disabled = false

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

  deleteLocalUser()

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    setFieldError('password', null)
    if (formError) formError.hidden = true
    setLoading(true)

    const body: ResetInput = {
      token,
      password: (new FormData(form).get('password') as string) ?? '',
      type,
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

      if (json.error?.details?.password) {
        setFieldError('password', json.error.details.password)
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
