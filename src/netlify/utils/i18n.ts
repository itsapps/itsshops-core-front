import de from '../../i18n/translations/de_server'
import en from '../../i18n/translations/en_server'

const translations: Record<string, typeof de> = { de, en }

/**
 * Get a nested translation value by dot-separated key.
 * Falls back to 'de' if the locale is not found.
 */
export function serverT(locale: string, key: string, fallback?: string): string {
  const t = translations[locale] ?? translations.de
  const value = key.split('.').reduce<unknown>((obj, k) => {
    if (obj && typeof obj === 'object') return (obj as Record<string, unknown>)[k]
    return undefined
  }, t)
  return typeof value === 'string' ? value : (fallback ?? key)
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
