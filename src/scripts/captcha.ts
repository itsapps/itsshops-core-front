/**
 * Client-side hCaptcha helpers. Used by user-register and user-recover.
 *
 * The widget is rendered by hCaptcha's auto-render mode: the template
 * conditionally injects a `<script src="https://js.hcaptcha.com/1/api.js">`
 * tag and a `<div class="h-captcha" data-sitekey="...">` div when
 * `coreConfig.captchaSiteKey` is set.
 *
 * Form scripts call `getCaptchaToken()` before submit and `resetCaptcha()`
 * on server error so the user can retry.
 */

declare global {
  interface Window {
    hcaptcha?: {
      getResponse(widgetId?: string): string
      reset(widgetId?: string): void
    }
  }
}

/** True if a captcha widget exists on the page. */
export function hasCaptcha(root: ParentNode = document): boolean {
  return !!root.querySelector('.h-captcha')
}

/** Returns the solved captcha token, or empty string if not solved / not loaded. */
export function getCaptchaToken(): string {
  return window.hcaptcha?.getResponse() ?? ''
}

/** Reset the captcha widget so the user can solve it again (after a server error). */
export function resetCaptcha(): void {
  window.hcaptcha?.reset()
}
