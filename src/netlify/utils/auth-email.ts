/**
 * Direct-send helpers for confirmation / recovery emails.
 *
 * Bypasses Supabase's email path (`auth.resend`, `resetPasswordForEmail`)
 * which counts against the per-project email rate limit on free tier.
 * Instead generates the action link via `admin.generateLink` (no email sent
 * by Supabase) and dispatches through our own Mailgun pipeline.
 */
import type { ComponentType } from 'react'
import { supabase } from '../services/supabase'
import { sendAuthNotification, type AuthUserPaths } from '../lib/auth-notifier'
import type { SimpleEmailProps } from '../templates/email/types'
import { log } from './logger'

export type DirectAuthEmailConfig = {
  /** Per-locale userPaths used to build the email callback URL. Defaults to the core segments. */
  userPaths?: AuthUserPaths
  /** Replaces SimpleEmail for all auth emails. */
  template?: ComponentType<SimpleEmailProps>
  /** Public base URL of the shop (defaults to process.env.PUBLIC_URL ?? URL). */
  baseUrl?: string
}

export type DirectSignupResult =
  | { ok: true }
  | { ok: false; emailExists: true }
  | { ok: false; emailExists: false; error: string }

/**
 * Create a user via `admin.generateLink({ type: 'signup' })` (one Supabase
 * call replaces createUser + resend) and dispatch the confirmation email
 * through Mailgun. Caller decides what to do on `emailExists` (typically:
 * fall through to recovery for enumeration safety).
 *
 * `SKIP_AUTH_EMAILS=true` suppresses the email send (user is still created).
 */
export async function sendDirectSignupEmail(
  args: { email: string; password: string; userMetadata?: Record<string, unknown> },
  defaultLocale: string,
  config: DirectAuthEmailConfig,
): Promise<DirectSignupResult> {
  try {
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email: args.email,
      password: args.password,
      ...(args.userMetadata && { options: { data: args.userMetadata } }),
    })
    if (error?.code === 'email_exists') return { ok: false, emailExists: true }
    if (error || !data?.user?.email || !data?.properties?.hashed_token) {
      log.error('sendDirectSignupEmail: generateLink failed', { error: error?.message })
      return { ok: false, emailExists: false, error: error?.message ?? 'no link returned' }
    }
    if (process.env.SKIP_AUTH_EMAILS !== 'true') {
      try {
        await sendAuthNotification(
          {
            user: { id: data.user.id, email: data.user.email, user_metadata: data.user.user_metadata },
            emailActionType: 'signup',
            tokenHash: data.properties.hashed_token,
            defaultLocale,
          },
          config,
        )
      } catch (err) {
        // User was created — log but treat as ok so we don't leak failure.
        // The user can request password recovery to get a fresh link.
        log.error('sendDirectSignupEmail: sendAuthNotification failed', {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
    return { ok: true }
  } catch (err) {
    log.error('sendDirectSignupEmail: unexpected', {
      error: err instanceof Error ? err.message : String(err),
    })
    return { ok: false, emailExists: false, error: 'unexpected error' }
  }
}

/**
 * Generate a recovery link for `email` and send it via Mailgun.
 * Errors are logged, never thrown — caller's email-enumeration guard is
 * preserved.
 */
export async function sendDirectRecoveryEmail(
  email: string,
  defaultLocale: string,
  config: DirectAuthEmailConfig,
): Promise<void> {
  if (process.env.SKIP_AUTH_EMAILS === 'true') return
  try {
    const { data, error } = await supabase.auth.admin.generateLink({ type: 'recovery', email })
    const tokenHash = data?.properties?.hashed_token
    const user = data?.user
    if (error || !tokenHash || !user?.email) {
      log.warn('sendDirectRecoveryEmail: generateLink failed', { error: error?.message })
      return
    }
    await sendAuthNotification(
      {
        user: { id: user.id, email: user.email, user_metadata: user.user_metadata },
        emailActionType: 'recovery',
        tokenHash,
        defaultLocale,
      },
      config,
    )
  } catch (err) {
    log.error('sendDirectRecoveryEmail: failed', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
