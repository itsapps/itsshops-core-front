/**
 * Pure helpers for Supabase auth email URL building. Side-effect-free —
 * importing this file does not initialize any external clients, so it can be
 * used directly from tests.
 */
import { ErrorCode } from '../types/errors'

export type AuthMailType = 'userConfirmation' | 'userInvitation' | 'userReset'

export type SupabaseAuthEmailAction = 'signup' | 'recovery' | 'invite'

/** Per-locale URL paths used to build email callback URLs. */
export type AuthUserPaths = Record<string, { userConfirm: string; userReset: string }>

export const ACTION_TO_MAIL_TYPE: Record<SupabaseAuthEmailAction, AuthMailType> = {
  signup:   'userConfirmation',
  recovery: 'userReset',
  invite:   'userInvitation',
}

export class AuthNotifierError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'AuthNotifierError'
  }
}

/**
 * Build the URL the user lands on after clicking the email button. The page
 * at this URL extracts `token_hash` from the query and POSTs it to the
 * existing user-confirm / user-reset endpoint to complete the flow.
 */
export function buildAuthCallbackUrl(
  baseUrl: string,
  locale: string,
  emailActionType: SupabaseAuthEmailAction,
  tokenHash: string,
  userPaths: AuthUserPaths,
  defaultLocale: string,
): string {
  const localePaths = userPaths[locale] ?? userPaths[defaultLocale]
  if (!localePaths) {
    throw new AuthNotifierError(
      ErrorCode.INTERNAL_ERROR,
      `userPaths missing for locale "${locale}" (and no fallback for "${defaultLocale}")`,
    )
  }
  const path = emailActionType === 'signup' ? localePaths.userConfirm : localePaths.userReset
  const query = emailActionType === 'invite'
    ? `?token_hash=${encodeURIComponent(tokenHash)}&type=invite`
    : `?token_hash=${encodeURIComponent(tokenHash)}`
  return `${baseUrl}/${locale}/${path}/${query}`
}
