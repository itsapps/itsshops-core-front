/**
 * Pure helpers for newsletter email URL building. Side-effect-free — importing
 * this file initializes no external clients, so it is safe to use from tests.
 */

/** Per-locale URL path segments for the newsletter landing pages. */
export type NewsletterPaths = Record<
  string,
  { newsletterConfirm: string; newsletterUnsubscribe: string }
>

function resolvePaths(
  paths: NewsletterPaths,
  locale: string,
  defaultLocale: string,
): { newsletterConfirm: string; newsletterUnsubscribe: string } {
  const resolved = paths[locale] ?? paths[defaultLocale]
  if (!resolved) {
    throw new Error(
      `newsletterPaths missing for locale "${locale}" (and no fallback for "${defaultLocale}")`,
    )
  }
  return resolved
}

/**
 * URL the subscriber lands on from the confirmation email. The page reads
 * `token` from the query and POSTs it to `/api/newsletter/confirm` on an
 * explicit click — never auto-firing, so email-client link prefetching can't
 * confirm on the user's behalf (double-opt-in integrity).
 */
export function buildNewsletterConfirmUrl(
  baseUrl: string,
  locale: string,
  token: string,
  paths: NewsletterPaths,
  defaultLocale: string,
): string {
  const path = resolvePaths(paths, locale, defaultLocale).newsletterConfirm
  return `${baseUrl}/${locale}/${path}/?token=${encodeURIComponent(token)}`
}

/** URL for the unsubscribe landing page (used in every newsletter footer). */
export function buildNewsletterUnsubscribeUrl(
  baseUrl: string,
  locale: string,
  token: string,
  paths: NewsletterPaths,
  defaultLocale: string,
): string {
  const path = resolvePaths(paths, locale, defaultLocale).newsletterUnsubscribe
  return `${baseUrl}/${locale}/${path}/?token=${encodeURIComponent(token)}`
}
