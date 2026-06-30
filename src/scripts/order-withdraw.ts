import type { WithdrawInput } from '../shared/order-api'
import { hasCaptcha, ensureHcaptchaScript, getCaptchaToken, resetCaptcha } from './captcha'

export function initOrderWithdraw(): void {
  const root = document.querySelector<HTMLElement>('[data-order-withdraw]')
  if (!root) return

  const api = root.dataset.api ?? '/api/order/withdraw'
  const locale = root.dataset.locale ?? document.documentElement.lang ?? 'de'
  const form = root.querySelector<HTMLFormElement>('form')
  if (!form) return

  if (hasCaptcha(root)) ensureHcaptchaScript()

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

  let isSubmitting = false

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (isSubmitting) return
    if (formError) formError.hidden = true
    setFieldError('orderNumber', null)
    setFieldError('email', null)

    const captchaPresent = hasCaptcha(root)
    const captchaToken = captchaPresent ? getCaptchaToken(root) : ''
    if (captchaPresent && !captchaToken) {
      if (formError) {
        formError.textContent = root.dataset.tErrorCaptcha ?? 'Please solve the captcha.'
        formError.hidden = false
      }
      return
    }

    isSubmitting = true
    setLoading(true)

    const data = new FormData(form)
    const reason = (data.get('reason') as string)?.trim()
    const body: WithdrawInput = {
      orderNumber: ((data.get('orderNumber') as string) ?? '').trim(),
      email: ((data.get('email') as string) ?? '').trim(),
      ...(reason && { reason }),
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

      if (json.error?.details?.orderNumber) {
        setFieldError('orderNumber', json.error.details.orderNumber)
      } else if (json.error?.details?.email) {
        setFieldError('email', json.error.details.email)
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
      isSubmitting = false
      setLoading(false)
    }
  })
}
