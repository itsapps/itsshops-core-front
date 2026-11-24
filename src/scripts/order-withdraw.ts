import type { WithdrawInput } from '../shared/order-api'
import { checkWithdrawText, validateEmail } from '../shared/validation'

type ErrorBody = { redirectUrl?: string; error?: { message?: string; details?: Record<string, string> } }

const FIELDS = ['name', 'orderNumber', 'email'] as const
type Field = (typeof FIELDS)[number]

export function initOrderWithdraw(): void {
  const root = document.querySelector<HTMLElement>('[data-order-withdraw]')
  if (!root) return

  const api = root.dataset.api ?? '/api/order/withdraw'
  const locale = root.dataset.locale ?? document.documentElement.lang ?? 'de'
  const form = root.querySelector<HTMLFormElement>('form')
  if (!form) return

  const submitBtn = form.querySelector<HTMLButtonElement>('[type="submit"]')
  const submitText = form.querySelector<HTMLElement>('[data-submit-text]')
  const submitLoading = form.querySelector<HTMLElement>('[data-submit-loading]')
  const formError = form.querySelector<HTMLElement>('[data-form-error]')

  const fieldMessages: Record<Field, string> = {
    name: root.dataset.tErrorName ?? 'Please enter your name.',
    orderNumber: root.dataset.tErrorOrderNumber ?? 'Please enter your order number.',
    email: root.dataset.tErrorEmail ?? 'Please enter a valid email address.',
  }

  function setFieldError(field: string, message: string | null): void {
    const el = form!.querySelector<HTMLElement>(`[data-field-error="${field}"]`)
    const input = form!.querySelector<HTMLInputElement>(`[name="${field}"]`)
    if (el) {
      el.textContent = message ?? ''
      el.hidden = !message
    }
    if (input) {
      if (message) input.setAttribute('aria-invalid', 'true')
      else input.removeAttribute('aria-invalid')
    }
  }

  function showFormError(message: string): void {
    if (!formError) return
    formError.textContent = message
    formError.hidden = false
  }

  function setLoading(loading: boolean): void {
    if (submitBtn) submitBtn.disabled = loading
    if (submitText) submitText.hidden = loading
    if (submitLoading) submitLoading.hidden = !loading
  }

  /** Client-side checks mirror the function's (`shared/validation`). Returns the first invalid field. */
  function validate(body: WithdrawInput): Field | null {
    let first: Field | null = null
    const noLinks = root!.dataset.tErrorNoLinks ?? 'Please do not enter links.'
    const textMessage = (field: Field, value: string) => {
      const check = checkWithdrawText(value)
      return check === 'invalid' ? noLinks : check === 'empty' ? fieldMessages[field] : null
    }
    const messages: Record<Field, string | null> = {
      name: textMessage('name', body.name),
      orderNumber: textMessage('orderNumber', body.orderNumber),
      email: validateEmail(body.email) ? null : fieldMessages.email,
    }
    for (const field of FIELDS) {
      setFieldError(field, messages[field])
      if (messages[field] && !first) first = field
    }
    return first
  }

  let isSubmitting = false

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (isSubmitting) return
    if (formError) formError.hidden = true

    const data = new FormData(form)
    const get = (key: string) => ((data.get(key) as string | null) ?? '').trim()
    const reason = get('reason')
    const website = get('website')
    const body: WithdrawInput = {
      name: get('name'),
      orderNumber: get('orderNumber'),
      email: get('email'),
      ...(reason && { reason }),
      ...(website && { website }),
    }

    const invalidField = validate(body)
    if (invalidField) {
      form.querySelector<HTMLElement>(`[name="${invalidField}"]`)?.focus()
      return
    }

    isSubmitting = true
    setLoading(true)

    try {
      const res = await fetch(api, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-locale': locale },
        body: JSON.stringify(body),
      })

      // Netlify's rate limiter answers itself (not our JSON) before the function runs.
      if (res.status === 429) {
        showFormError(root.dataset.tErrorRateLimited ?? 'Too many requests. Please try again later.')
        return
      }

      let json: ErrorBody = {}
      try {
        json = (await res.json()) as ErrorBody
      } catch {
        // Non-JSON response (proxy/platform error) → generic message below.
      }

      if (res.ok && json.redirectUrl) {
        window.location.href = json.redirectUrl
        return
      }

      const details = json.error?.details ?? {}
      let focused = false
      for (const field of FIELDS) {
        setFieldError(field, details[field] ?? null)
        if (details[field] && !focused) {
          form.querySelector<HTMLElement>(`[name="${field}"]`)?.focus()
          focused = true
        }
      }
      if (!focused) showFormError(json.error?.message ?? root.dataset.tErrorService ?? 'Service unavailable')
    } catch {
      showFormError(root.dataset.tErrorService ?? 'Service unavailable')
    } finally {
      isSubmitting = false
      setLoading(false)
    }
  })
}
