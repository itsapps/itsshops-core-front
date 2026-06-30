// Thin wrapper around the Resend SDK. Lazy-initialised so importing this module
// doesn't crash when RESEND_API_KEY is missing — only the actual send path requires it.
import { Resend } from 'resend'
import type { SendMailParams } from './mailgun'

let _resend: Resend | null = null

function getResend(): Resend {
  if (_resend) return _resend
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY must be set')
  _resend = new Resend(apiKey)
  return _resend
}

export async function sendMail(params: SendMailParams): Promise<{ id?: string }> {
  const resend = getResend()
  const { data, error } = await resend.emails.send({
    from: params.from,
    to: params.to,
    bcc: params.bcc,
    subject: params.subject,
    text: params.text,
    html: params.html,
    headers: params.headers,
    attachments: params.attachment
      ? [{ filename: params.attachment.filename, content: params.attachment.data, contentType: params.attachment.contentType }]
      : undefined,
  })
  if (error) throw new Error(`Resend error: ${error.message}`)
  return { id: data?.id }
}
