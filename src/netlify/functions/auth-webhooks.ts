/**
 * Supabase Auth email webhook.
 *
 * Receives Standard Webhooks-signed events from Supabase, renders the matching
 * auth email (signup confirm, password reset, invite) and sends it via Mailgun.
 *
 * Customer integration:
 *
 * ```ts
 * // netlify/functions/auth_webhooks.mts
 * import { createAuthWebhookHandler } from '@itsapps/itsshops-core-front/functions/auth-webhooks'
 *
 * export const config = { path: '/api/hooks/supabase' }
 * export default createAuthWebhookHandler({
 *   defaultLocale: 'de',
 *   userPaths: {
 *     de: { userConfirm: 'kundenkonto/bestaetigen', userReset: 'kundenkonto/passwort-zuruecksetzen' },
 *     en: { userConfirm: 'account/confirm',         userReset: 'account/reset-password' },
 *   },
 *   onUserInvited: async (user) => { /* persist as 'invited' in Sanity *\/ },
 * })
 * ```
 *
 * Required env: `SUPABASE_EMAIL_HOOKS_SECRET` (the `v1,whsec_…` secret from
 * Supabase's "Send Email Hook" config — the prefix is stripped automatically).
 */
import type { Context } from '@netlify/functions'
import type { ComponentType } from 'react'
import { Webhook } from 'standardwebhooks'

import {
  sendAuthNotification,
  type AuthUser,
  type AuthUserPaths,
  type SupabaseAuthEmailAction,
} from '../lib/auth-notifier'
import type { SimpleEmailProps } from '../templates/types'
import { type ServerConfig, resolveServerConfig } from '../types/config'
import { log } from '../utils/logger'

export { buildUserPaths } from '../../i18n/permalinks'
export type { UserPaths } from '../../types/localization'

const SUPPORTED_ACTIONS: ReadonlyArray<SupabaseAuthEmailAction> = ['signup', 'recovery', 'invite']

type SupabaseEmailEvent = {
  user: AuthUser
  email_data: {
    email_action_type: string
    token_hash: string
  }
}

export type AuthWebhookHandlerOptions = ServerConfig & {
  /** Replaces SimpleMailTemplate for all auth emails. */
  template?: ComponentType<SimpleEmailProps>
  /** Per-locale URL paths used to build the email callback URL. */
  userPaths: AuthUserPaths
  /**
   * Public base URL of the shop. Defaults to `process.env.PUBLIC_URL`,
   * falling back to `process.env.URL`. Use PUBLIC_URL during local dev
   * (ngrok tunnel) since Netlify Dev clobbers URL with localhost.
   */
  baseUrl?: string
  /**
   * Called once per `invite` event before the email is sent. Use this to
   * persist the invited user (e.g. `storeCustomer(..., { status: 'invited' })`).
   * Failures here do NOT abort the email — they are logged.
   */
  onUserInvited?: (user: AuthUser) => Promise<void>
}

export function createAuthWebhookHandler(options: AuthWebhookHandlerOptions) {
  const { defaultLocale } = resolveServerConfig(options)

  const secret = process.env.SUPABASE_EMAIL_HOOKS_SECRET
  if (!secret) {
    throw new Error('SUPABASE_EMAIL_HOOKS_SECRET must be set')
  }
  const wh = new Webhook(secret.replace(/^v1,whsec_/, ''))

  return async (request: Request, _context: Context): Promise<Response> => {
    if (request.method !== 'POST') return new Response(null, { status: 405 })

    let body: string
    try {
      body = await request.text()
    } catch {
      log.warn('Auth webhook: failed to read request body')
      return new Response(null, { status: 400 })
    }

    const headers: Record<string, string> = {}
    request.headers.forEach((value, key) => { headers[key] = value })

    let event: SupabaseEmailEvent
    try {
      event = wh.verify(body, headers) as SupabaseEmailEvent
    } catch (err) {
      log.warn('Auth webhook: signature invalid', {
        error: err instanceof Error ? err.message : String(err),
      })
      return new Response(null, { status: 401 })
    }

    const { user, email_data } = event ?? {}
    if (!user?.email || !email_data?.email_action_type || !email_data?.token_hash) {
      log.warn('Auth webhook: missing user/email_data fields')
      return new Response(null, { status: 400 })
    }

    const action = email_data.email_action_type as SupabaseAuthEmailAction
    if (!SUPPORTED_ACTIONS.includes(action)) {
      log.info('Auth webhook: skipping unsupported action', { action })
      return new Response(null, { status: 200 })
    }

    try {
      if (action === 'invite' && options.onUserInvited) {
        try {
          await options.onUserInvited(user)
        } catch (err) {
          log.error('onUserInvited hook failed', {
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }

      const result = await sendAuthNotification(
        {
          user,
          emailActionType: action,
          tokenHash: email_data.token_hash,
          defaultLocale,
        },
        {
          template: options.template,
          baseUrl: options.baseUrl,
          userPaths: options.userPaths,
        },
      )
      log.info('Auth notification sent', {
        authMailType: result.authMailType,
        to: result.to,
        messageId: result.messageId,
      })
    } catch (err) {
      log.error('Auth webhook: send failed', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      })
      return new Response(null, { status: 500 })
    }

    return Response.json({});
  }
}
