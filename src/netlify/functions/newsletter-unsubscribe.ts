import type { Context } from '@netlify/functions'
import { success, methodNotAllowed, badRequest, errorResponse } from '../utils/response'
import { ErrorCode } from '../types/errors'
import { serverT } from '../utils/i18n'
import { unsubscribeByToken } from '../utils/newsletter-helper'
import { log } from '../utils/logger'
import type { NewsletterUnsubscribeInput, NewsletterUnsubscribeResult } from '../../shared/newsletter-api'

export type NewsletterUnsubscribeConfig = {
  /** Locale fallback. Defaults to 'de'. */
  defaultLocale?: string
}

export function createNewsletterUnsubscribeHandler(config: NewsletterUnsubscribeConfig = {}) {
  const { defaultLocale = 'de' } = config

  return async (request: Request, _context: Context): Promise<Response> => {
    if (request.method !== 'POST') return methodNotAllowed()

    const locale = request.headers.get('x-locale') ?? defaultLocale
    const t = (key: string) => serverT(locale, key)

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return badRequest('Invalid JSON body')
    }

    const { token } = body as NewsletterUnsubscribeInput
    if (!token) return badRequest('token is required')

    try {
      const ok = await unsubscribeByToken(token)
      if (!ok) {
        return errorResponse(ErrorCode.INVALID_INPUT, t('api.errors.newsletter.invalidToken'), undefined, 400)
      }
    } catch (error) {
      log.error('newsletter-unsubscribe failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      return errorResponse(ErrorCode.INTERNAL_ERROR, t('api.errors.service'))
    }

    return success<NewsletterUnsubscribeResult>({
      ok: true,
      redirectUrl: `/${locale}/${t('urlPaths.newsletterUnsubscribeSuccess')}/`,
    })
  }
}
