import type { LoginInput, LoginResult } from '../shared/user-api'
import { setLocalUser } from './user-store'

export function initUserLogin(): void {
  const root = document.querySelector<HTMLElement>('[data-user-login]')
  if (!root) return

  const api = root.dataset.api ?? '/api/user/login'
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

  function clearErrors(): void {
    form!.querySelectorAll<HTMLElement>('[data-field-error]').forEach(el => {
      el.textContent = ''
      el.hidden = true
    })
    if (formError) formError.hidden = true
  }

  function setLoading(loading: boolean): void {
    if (submitBtn) submitBtn.disabled = loading
    if (submitText) submitText.hidden = loading
    if (submitLoading) submitLoading.hidden = !loading
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    clearErrors()
    setLoading(true)

    const data = new FormData(form)
    const body: LoginInput = {
      email: (data.get('email') as string) ?? '',
      password: (data.get('password') as string) ?? '',
    }

    try {
      const res = await fetch(api, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-locale': locale },
        body: JSON.stringify(body),
      })
      const json = await res.json() as { user?: LoginResult['user']; error?: { message?: string; details?: Record<string, string> } }

      if (res.ok && json.user) {
        setLocalUser(json.user)
        const next = new URL(window.location.href).searchParams.get('next')
        window.location.href = next ? decodeURIComponent(next) : `/${locale}/`
        return
      }

      if (json.error?.details) {
        for (const [field, msg] of Object.entries(json.error.details)) {
          setFieldError(field, msg)
        }
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
