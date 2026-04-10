import type { RegisterInput, RegisterResult } from '../shared/user-api'

export function initUserRegister(): void {
  const root = document.querySelector<HTMLElement>('[data-user-register]')
  if (!root) return

  const api = root.dataset.api ?? '/api/user/register'
  const locale = root.dataset.locale ?? document.documentElement.lang ?? 'de'
  const form = root.querySelector<HTMLFormElement>('form')
  if (!form) return

  // Show registration fields configured via coreConfig.features.users.registrationFields
  const fields = (root.dataset.fields ?? '').split(',').filter(Boolean)
  for (const field of fields) {
    root.querySelector<HTMLElement>(`[data-register-field="${field}"]`)?.removeAttribute('hidden')
  }

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
    const body: RegisterInput = {
      email: (data.get('email') as string) ?? '',
      password: (data.get('password') as string) ?? '',
      prename: (data.get('prename') as string) || undefined,
      lastname: (data.get('lastname') as string) || undefined,
      phone: (data.get('phone') as string) || undefined,
      newsletter: data.has('newsletter'),
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
