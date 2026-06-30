/**
 * Request/response contracts for the standalone newsletter endpoints.
 * Shared between the browser scripts and the Netlify function handlers.
 */

export type NewsletterSubscribeInput = {
  email: string
  captchaToken?: string
}

/**
 * Always `{ ok: true }` on a well-formed request — the endpoint never reveals
 * whether the address was new, already pending, or already confirmed (prevents
 * subscriber enumeration). The UI shows a generic "check your inbox" message.
 */
export type NewsletterSubscribeResult = { ok: true }

export type NewsletterConfirmInput = { token: string }
export type NewsletterConfirmResult = { ok: boolean; redirectUrl?: string }

export type NewsletterUnsubscribeInput = { token: string }
export type NewsletterUnsubscribeResult = { ok: boolean; redirectUrl?: string }
