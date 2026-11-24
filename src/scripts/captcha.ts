/**
 * Client-side hCaptcha helpers. Used by user-register, user-recover,
 * order-withdraw and newsletter-subscribe.
 *
 * The widget markup (`<div class="h-captcha" data-sitekey="…">`) is rendered by
 * the form templates when `coreConfig.captchaSiteKey` is set. The hCaptcha API
 * script is injected **once per page** by `ensureHcaptchaScript()` — never from
 * the templates — because multiple captcha-bearing forms can share a page (e.g.
 * the register form plus the site-wide newsletter footer). Loading
 * `api.js` more than once breaks hCaptcha's auto-render, leaving every widget
 * unrendered ("No hCaptcha exists").
 *
 * Token reads are scoped to a form's own widget via its `data-hcaptcha-widget-id`
 * (set by hCaptcha after render), so one form never reads another's token.
 */

declare global {
  interface Window {
    hcaptcha?: {
      getResponse(widgetId?: string): string
      reset(widgetId?: string): void
    }
  }
}

const HCAPTCHA_SRC = 'https://js.hcaptcha.com/1/api.js'

/** Inject the hCaptcha API script once per page. No-op if already present. */
export function ensureHcaptchaScript(): void {
  if (document.querySelector('script[data-hcaptcha-api]')) return
  const script = document.createElement('script')
  script.src = HCAPTCHA_SRC
  script.async = true
  script.defer = true
  script.setAttribute('data-hcaptcha-api', '')
  document.head.appendChild(script)
}

/** True if a captcha widget exists within `root`. */
export function hasCaptcha(root: ParentNode = document): boolean {
  return !!root.querySelector('.h-captcha')
}

/** hCaptcha widget id of the captcha inside `root` (set after auto-render). */
function widgetId(root: ParentNode): string | undefined {
  return root.querySelector<HTMLElement>('.h-captcha')?.dataset.hcaptchaWidgetId
}

/** Returns the solved captcha token for the widget inside `root`, or '' if not solved / not loaded. */
export function getCaptchaToken(root: ParentNode = document): string {
  try {
    return window.hcaptcha?.getResponse(widgetId(root)) ?? ''
  } catch {
    return ''
  }
}

/** Reset the captcha widget inside `root` so the user can solve it again. */
export function resetCaptcha(root: ParentNode = document): void {
  try {
    window.hcaptcha?.reset(widgetId(root))
  } catch {
    /* no widget rendered — nothing to reset */
  }
}
