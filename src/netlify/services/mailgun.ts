// Thin wrapper around mailgun.js. Lazy-initialised so importing this module
// doesn't crash when MAILGUN_* env vars are missing — only the actual send
// path requires them. Defaults to the EU region; flip MAILGUN_USE_EU_REGION_URL
// to "false" for the US region.
import FormData from 'form-data'
import Mailgun from 'mailgun.js'
import type { MailgunMessageData, MessageAttachment, MessagesSendResult } from 'mailgun.js/definitions'

let _client: ReturnType<ReturnType<typeof getMailgun>['client']> | null = null
let _domain: string | null = null

function getMailgun() {
  return new Mailgun(FormData)
}

function getClient() {
  if (_client && _domain) return { client: _client, domain: _domain }

  const apiKey = process.env.MAILGUN_API_KEY
  const domain = process.env.MAILGUN_DOMAIN
  if (!apiKey || !domain) {
    throw new Error('MAILGUN_API_KEY and MAILGUN_DOMAIN must be set')
  }

  const useEU = process.env.MAILGUN_USE_EU_REGION_URL
    ? process.env.MAILGUN_USE_EU_REGION_URL === 'true'
    : true

  _client = getMailgun().client({
    username: 'api',
    key: apiKey,
    ...(useEU && { url: 'https://api.eu.mailgun.net' }),
  })
  _domain = domain

  return { client: _client, domain: _domain }
}

export type SendMailParams = {
  from: string
  to: string | string[]
  bcc?: string | string[]
  subject: string
  text: string
  html?: string
  attachment?: MessageAttachment
}

export async function sendMail(params: SendMailParams): Promise<MessagesSendResult> {
  const { client, domain } = getClient()
  const data: MailgunMessageData = {
    from: params.from,
    to: params.to,
    ...(params.bcc && { bcc: params.bcc }),
    subject: params.subject,
    text: params.text,
    ...(params.html && { html: params.html }),
    ...(params.attachment && { attachment: params.attachment }),
  }
  return client.messages.create(domain, data)
}
