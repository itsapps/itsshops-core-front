import type { RegisterInput, RegisterResult } from '../shared/user-api'
import { validateEmail, validatePassword } from '../shared/validation'
import { hasCaptcha, ensureHcaptchaScript, getCaptchaToken, resetCaptcha } from './captcha'

const REQUIRED_INPUTS_FOR_FIELD: Record<string, string[]> = {
  prename: ['prename'],
  lastname: ['lastname'],
  address: ['line1', 'zip', 'city', 'country'],
}

export function initUserRegister(): void {
  const root = document.querySelector<HTMLElement>('[data-user-register]')
  if (!root) return

  const api = root.dataset.api ?? '/api/user/register'
  const locale = root.dataset.locale ?? document.documentElement.lang ?? 'de'
  const form = root.querySelector<HTMLFormElement>('form')
  if (!form) return

  if (hasCaptcha(root)) ensureHcaptchaScript()

  const fields = (root.dataset.fields ?? '').split(',').filter(Boolean)
  for (const field of fields) {
    const wrapper = root.querySelector<HTMLElement>(`[data-register-field="${field}"]`)
    if (!wrapper) continue
    wrapper.removeAttribute('hidden')
    for (const inputName of REQUIRED_INPUTS_FOR_FIELD[field] ?? []) {
      wrapper.querySelector<HTMLElement>(`[name="${inputName}"]`)?.setAttribute('required', '')
    }
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

  function validateForm(data: FormData): boolean {
    let firstError: string | null = null

    function fail(field: string, msg: string): void {
      setFieldError(field, msg)
      if (!firstError) firstError = field
    }

    const email = (data.get('email') as string) ?? ''
    if (!validateEmail(email)) fail('email', root!.dataset.tErrorEmail ?? 'Invalid email')

    const password = (data.get('password') as string) ?? ''
    if (!validatePassword(password)) fail('password', root!.dataset.tErrorPassword ?? 'Invalid password')

    if (fields.includes('prename') && !((data.get('prename') as string) ?? '').trim())
      fail('prename', root!.dataset.tErrorPrename ?? 'Required')

    if (fields.includes('lastname') && !((data.get('lastname') as string) ?? '').trim())
      fail('lastname', root!.dataset.tErrorLastname ?? 'Required')

    if (fields.includes('address')) {
      if (!((data.get('line1') as string) ?? '').trim())
        fail('line1', root!.dataset.tErrorLine1 ?? 'Required')
      if (!((data.get('zip') as string) ?? '').trim())
        fail('zip', root!.dataset.tErrorZip ?? 'Required')
      if (!((data.get('city') as string) ?? '').trim())
        fail('city', root!.dataset.tErrorCity ?? 'Required')
      if (!((data.get('country') as string) ?? '').trim())
        fail('country', root!.dataset.tErrorCountry ?? 'Required')
    }

    if (firstError) {
      form!.querySelector<HTMLElement>(`[name="${firstError}"]`)?.focus()
    }

    return firstError === null
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    clearErrors()

    const captchaPresent = hasCaptcha(root)
    const captchaToken = captchaPresent ? getCaptchaToken(root) : ''
    if (captchaPresent && !captchaToken) {
      if (formError) {
        formError.textContent = root.dataset.tErrorCaptcha ?? 'Please solve the captcha.'
        formError.hidden = false
      }
      return
    }

    const data = new FormData(form)
    if (!validateForm(data)) return

    setLoading(true)

    const body: RegisterInput = {
      email: (data.get('email') as string) ?? '',
      password: (data.get('password') as string) ?? '',
      prename: (data.get('prename') as string) || undefined,
      lastname: (data.get('lastname') as string) || undefined,
      phone: (data.get('phone') as string) || undefined,
      line1: (data.get('line1') as string) || undefined,
      line2: (data.get('line2') as string) || undefined,
      zip: (data.get('zip') as string) || undefined,
      city: (data.get('city') as string) || undefined,
      country: (data.get('country') as string) || undefined,
      state: (data.get('state') as string) || undefined,
      newsletter: data.has('newsletter'),
      ...(captchaToken && { captchaToken }),
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
      if (captchaPresent) resetCaptcha(root)
    } catch {
      if (formError) {
        formError.textContent = root.dataset.tErrorService ?? 'Service unavailable'
        formError.hidden = false
      }
      if (captchaPresent) resetCaptcha(root)
    } finally {
      setLoading(false)
    }
  })
}
