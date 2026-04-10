import type { Context } from '@netlify/functions'
import type { User } from '@supabase/supabase-js'
import { supabase, getAccessToken, getRefreshToken, setSessionCookies, deleteSessionCookies } from '../services/supabase'
import { upsertCustomer } from '../services/sanity'
import { log } from './logger'
import { ErrorCode } from '../types/errors'
import { unauthorized } from './response'
import { serverT } from './i18n'

/**
 * Get the authenticated user from the access token cookie.
 * Attempts a token refresh if the access token is expired.
 * Returns the user or throws a 401 Response.
 */
export async function getUserWithRefresh(context: Context, locale: string): Promise<User> {
  const accessToken = getAccessToken(context)
  if (!accessToken) {
    deleteSessionCookies(context)
    throw unauthorized(ErrorCode.UNAUTHORIZED, serverT(locale, 'api.errors.auth.notAuthenticated'))
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken)
  if (userData?.user) return userData.user

  if (userError?.status === 403) {
    const refreshToken = getRefreshToken(context)
    if (refreshToken) {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      })
      if (refreshData?.session && refreshData?.user) {
        setSessionCookies(
          {
            accessToken: refreshData.session.access_token,
            refreshToken: refreshData.session.refresh_token,
          },
          context,
        )
        return refreshData.user
      }
      if (refreshError) {
        log.error('Token refresh failed', { error: refreshError.message })
      }
    }
  }

  deleteSessionCookies(context)
  throw unauthorized(ErrorCode.UNAUTHORIZED, serverT(locale, 'api.errors.auth.notAuthenticated'))
}

/**
 * Create or update the Sanity customer record from Supabase user data.
 * Called after OTP verification (confirm + reset flows).
 * Failures are logged but do not throw — the auth flow must not be blocked by a Sanity error.
 */
export async function storeCustomer(
  supabaseId: string,
  email: string,
  locale: string,
  meta: {
    prename?: string
    lastname?: string
    phone?: string
    newsletter?: boolean
  },
): Promise<void> {
  try {
    await upsertCustomer(supabaseId, {
      email,
      locale,
      status: 'active',
      receiveNewsletter: meta.newsletter ?? false,
      address: {
        ...meta.prename && { prename: meta.prename },
        ...meta.lastname && { lastname: meta.lastname },
        ...meta.phone && { phone: meta.phone },
      },
    })
  } catch (err) {
    log.error('storeCustomer failed', { supabaseId, error: (err as Error).message })
  }
}
