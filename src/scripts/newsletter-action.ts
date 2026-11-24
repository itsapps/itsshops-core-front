/**
 * Shared driver for the newsletter confirm + unsubscribe landing pages.
 *
 * Both require an explicit button click before POSTing the token — never
 * auto-firing on load. Email clients and link-scanning proxies prefetch URLs;
 * an auto-fire would let a scanner confirm a double-opt-in (or unsubscribe) on
 * the user's behalf. The token travels in the query string and is posted to the
 * matching API only on a real click.
 */
function initTokenAction(selector: string, defaultApi: string): void {
  const root = document.querySelector<HTMLElement>(selector)
  if (!root) return

  const api = root.dataset.api ?? defaultApi
  const locale = root.dataset.locale ?? document.documentElement.lang ?? 'de'
  const submitBtn = root.querySelector<HTMLButtonElement>('[data-newsletter-submit]')
  const submitText = root.querySelector<HTMLElement>('[data-submit-text]')
  const submitLoading = root.querySelector<HTMLElement>('[data-submit-loading]')
  const errorEl = root.querySelector<HTMLElement>('[data-newsletter-error]')
  const errorMsg = root.querySelector<HTMLElement>('[data-newsletter-error-message]')

  const token = new URL(window.location.href).searchParams.get('token')
  if (!token) {
    window.location.href = `/${locale}/`
    return
  }
  if (!submitBtn) return

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

  submitBtn.addEventListener('click', () => {
    setLoading(true)
    if (errorEl) errorEl.hidden = true

    fetch(api, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-locale': locale },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json() as Promise<{ ok?: boolean; redirectUrl?: string; error?: { message?: string } }>)
      .then((json) => {
        if (json.ok && json.redirectUrl) {
          window.location.href = json.redirectUrl
        } else {
          showError(json.error?.message ?? root.dataset.tErrorService ?? 'Something went wrong')
        }
      })
      .catch(() => showError(root.dataset.tErrorService ?? 'Service unavailable'))
  })
}

export function initNewsletterConfirm(): void {
  initTokenAction('[data-newsletter-confirm]', '/api/newsletter/confirm')
}

export function initNewsletterUnsubscribe(): void {
  initTokenAction('[data-newsletter-unsubscribe]', '/api/newsletter/unsubscribe')
}
