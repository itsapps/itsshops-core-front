import type { NewsletterSubscribeInput } from '../shared/newsletter-api'
import { validateEmail } from '../shared/validation'
import { hasCaptcha, ensureHcaptchaScript, getCaptchaToken, resetCaptcha } from './captcha'

/**
 * Standalone newsletter signup form. Progressive enhancement: posts the email
 * to `/api/newsletter/subscribe`, then swaps the form for a generic
 * "check your inbox" notice. The endpoint never reveals whether the address
 * was already subscribed, so the UI is identical in every case.
 */
export function initNewsletterSubscribe(): void {
  const roots = document.querySelectorAll<HTMLElement>('[data-newsletter-subscribe]')
  roots.forEach(initOne)
}

function initOne(root: HTMLElement): void {
  const api = root.dataset.api ?? '/api/newsletter/subscribe'
  const locale = root.dataset.locale ?? document.documentElement.lang ?? 'de'
  const form = root.querySelector<HTMLFormElement>('form')
  if (!form) return

  if (hasCaptcha(root)) ensureHcaptchaScript()

  const submitBtn = form.querySelector<HTMLButtonElement>('[type="submit"]')
  const submitText = form.querySelector<HTMLElement>('[data-submit-text]')
  const submitLoading = form.querySelector<HTMLElement>('[data-submit-loading]')
  const fieldError = form.querySelector<HTMLElement>('[data-field-error="email"]')
  const formError = form.querySelector<HTMLElement>('[data-form-error]')
  const successEl = root.querySelector<HTMLElement>('[data-newsletter-success]')

  function setLoading(loading: boolean): void {
    if (submitBtn) submitBtn.disabled = loading
    if (submitText) submitText.hidden = loading
    if (submitLoading) submitLoading.hidden = !loading
  }

  function showFieldError(message: string | null): void {
    if (!fieldError) return
    fieldError.textContent = message ?? ''
    fieldError.hidden = !message
  }

  function showFormError(message: string): void {
    if (formError) {
      formError.textContent = message
      formError.hidden = false
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    showFieldError(null)
    if (formError) formError.hidden = true

    const data = new FormData(form)
    const email = ((data.get('email') as string) ?? '').trim()
    if (!validateEmail(email)) {
      showFieldError(root.dataset.tErrorEmail ?? 'Invalid email')
      form.querySelector<HTMLElement>('[name="email"]')?.focus()
      return
    }

    const captchaPresent = hasCaptcha(root)
    const captchaToken = captchaPresent ? getCaptchaToken(root) : ''
    if (captchaPresent && !captchaToken) {
      showFormError(root.dataset.tErrorCaptcha ?? 'Please solve the captcha.')
      return
    }

    setLoading(true)

    const body: NewsletterSubscribeInput = {
      email,
      ...(captchaToken && { captchaToken }),
    }

    try {
      const res = await fetch(api, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-locale': locale },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as { ok?: boolean; error?: { message?: string } }

      if (res.ok && json.ok) {
        // Swap the form for the generic confirmation notice.
        form.hidden = true
        if (successEl) successEl.hidden = false
        return
      }

      showFormError(json.error?.message ?? root.dataset.tErrorService ?? 'Service unavailable')
      if (captchaPresent) resetCaptcha(root)
    } catch {
      showFormError(root.dataset.tErrorService ?? 'Service unavailable')
      if (captchaPresent) resetCaptcha(root)
    } finally {
      setLoading(false)
    }
  })
}
