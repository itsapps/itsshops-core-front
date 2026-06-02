/**
 * Keeps the Supabase free-tier project alive by pinging a storage URL.
 * Supabase pauses free projects after 7 days of inactivity; storage CDN hits count as activity.
 *
 * Usage in customer project (netlify/functions/supabase-keep-alive.mts):
 *
 *   import type { Config } from '@netlify/functions'
 *   import { createKeepAliveHandler } from '@itsapps/itsshops-core-front/functions/supabase-keep-alive'
 *   export const config: Config = { schedule: '0 9 * * 1,4' }
 *   export default createKeepAliveHandler()
 *
 * Setup:
 *   1. Upload any small file to Supabase Storage and make it public.
 *   2. Set SUPABASE_KEEP_ALIVE_URL to its public URL in Netlify environment variables.
 *      If the env var is not set, the function exits silently.
 */
import { log } from '../utils/logger'

export function createKeepAliveHandler() {
  return async () => {
    const url = process.env.SUPABASE_KEEP_ALIVE_URL
    if (!url) return { statusCode: 200 }

    try {
      await fetch(url)
      log.info('Supabase keep-alive ping sent', { url })
    } catch (err) {
      log.error('Supabase keep-alive ping failed', { url, error: err instanceof Error ? err.message : String(err) })
    }
    return new Response(null, { status: 200 })
  }
}
