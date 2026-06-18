import type { Context } from '@netlify/functions'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

export type ExposedUser = {
  id: string
  email: string | undefined
  lastSignIn: string | undefined
}

let client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (client) return client
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY must be set')
  client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  return client
}

/**
 * Lazily-initialized Supabase client. Construction is deferred to first use via
 * a proxy so importing this module — e.g. transitively through the test-utils
 * barrel — doesn't throw in projects that don't configure Supabase.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const c = getClient()
    const value = Reflect.get(c, prop, c)
    return typeof value === 'function' ? value.bind(c) : value
  },
}) as SupabaseClient

export function exposedUserData(user: User): ExposedUser {
  return {
    id: user.id,
    email: user.email,
    lastSignIn: user.last_sign_in_at,
  }
}

export function setSessionCookies(
  { accessToken, refreshToken }: { accessToken: string; refreshToken: string },
  context: Context,
) {
  const base = { httpOnly: true, secure: true, sameSite: 'Strict' as const, path: '/' }
  context.cookies.set({ name: 'sb_access_token', value: accessToken, ...base })
  context.cookies.set({ name: 'sb_refresh_token', value: refreshToken, ...base })
}

export function deleteSessionCookies(context: Context) {
  context.cookies.delete('sb_access_token')
  context.cookies.delete('sb_refresh_token')
}

export function getAccessToken(context: Context): string | undefined {
  return context.cookies.get('sb_access_token') || undefined
}

export function getRefreshToken(context: Context): string | undefined {
  return context.cookies.get('sb_refresh_token') || undefined
}
