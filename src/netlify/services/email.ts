/**
 * Provider-agnostic email facade.
 *
 * Reads EMAIL_PROVIDER from env vars and delegates to the matching service.
 * Supported values: 'mailgun' (default), 'resend'.
 *
 * All other email code should import sendMail from here, not from the
 * individual provider files.
 */
import type { SendMailParams, EmailAttachment } from './mailgun'
export type { SendMailParams, EmailAttachment }

export type SendMailResult = { id?: string }

export async function sendMail(params: SendMailParams): Promise<SendMailResult> {
  const provider = process.env.EMAIL_PROVIDER ?? 'mailgun'

  switch (provider) {
    case 'resend': {
      const { sendMail: send } = await import('./resend')
      return send(params)
    }
    case 'mailgun': {
      const { sendMail: send } = await import('./mailgun')
      const result = await send(params)
      return { id: result.id }
    }
    default:
      throw new Error(`Unknown EMAIL_PROVIDER "${provider}". Supported: "mailgun", "resend"`)
  }
}
