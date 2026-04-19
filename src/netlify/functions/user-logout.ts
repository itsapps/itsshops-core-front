import type { Context } from '@netlify/functions'
import { supabase, deleteSessionCookies, getAccessToken } from '../services/supabase'
import { log } from '../utils/logger'
import { success, methodNotAllowed } from '../utils/response'
import type { LogoutResult } from '../../shared/user-api'

export function createUserLogoutHandler() {
  return async (request: Request, context: Context): Promise<Response> => {
    if (request.method !== 'POST' && request.method !== 'GET') return methodNotAllowed()

    const accessToken = getAccessToken(context)
    deleteSessionCookies(context)

    if (accessToken) {
      const { error } = await supabase.auth.admin.signOut(accessToken)
      if (error) {
        log.warn('user-logout: signOut failed', { error: error.message })
      }
    }

    return success<LogoutResult>({})
  }
}
