import de from '../../i18n/translations/de_server'
import en from '../../i18n/translations/en_server'

const translations: Record<string, typeof de> = { de, en }

/**
 * Get a nested translation value by dot-separated key.
 * Falls back to 'de' if the locale is not found.
 *
 * Supports `{{name}}` interpolation when `params` is provided.
 */
export function serverT(
  locale: string,
  key: string,
  paramsOrFallback?: Record<string, string | number> | string,
  fallback?: string,
): string {
  const params = typeof paramsOrFallback === 'object' ? paramsOrFallback : undefined
  const fb = typeof paramsOrFallback === 'string' ? paramsOrFallback : fallback

  const t = translations[locale] ?? translations.de
  const value = key.split('.').reduce<unknown>((obj, k) => {
    if (obj && typeof obj === 'object') return (obj as Record<string, unknown>)[k]
    return undefined
  }, t)
  let str = typeof value === 'string' ? value : (fb ?? key)
  if (params) {
    str = str.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) =>
      k in params ? String(params[k]) : `{{${k}}}`,
    )
  }
  return str
}

/**
 * Format an amount in cents as a localized currency string.
 */
export function formatPrice(cents: number, locale: string, currency: string = 'EUR'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100)
}

/**
 * Format an ISO 3166-1 alpha-2 country code to a localized country name.
 * Uses Intl.DisplayNames (same approach as the Eleventy countryName filter).
 */
export function countryName(locale: string, code: string): string {
  if (!code) return ''
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}
