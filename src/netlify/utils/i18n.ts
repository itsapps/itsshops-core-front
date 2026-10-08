import de from '../../i18n/translations/de_server'
import en from '../../i18n/translations/en_server'
import deShared from '../../i18n/translations/de_shared'
import enShared from '../../i18n/translations/en_shared'
import deInformal from '../../i18n/translations/de_server.informal'
import deSharedInformal from '../../i18n/translations/de_shared.informal'
import { readFormality, type Formality } from '../../i18n/formality'
import { mergeTranslations } from '../../i18n/merge-translations'

const baseTranslations: Record<string, object> = {
  de: { ...de, ...deShared },
  en: { ...en, ...enShared },
}

const informalTranslations: Record<string, object> = {
  ...baseTranslations,
  de: mergeTranslations(baseTranslations.de, deInformal, deSharedInformal),
}

/** Translation table for the shop's form of address (`SHOP_FORMALITY`, read per call). */
function translationsFor(formality: Formality = readFormality()): Record<string, object> {
  return formality === 'informal' ? informalTranslations : baseTranslations
}

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

  const translations = translationsFor()
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

export const DEFAULT_SHOP_TIMEZONE = 'Europe/Vienna'
const warnedTimeZones = new Set<string>()

/**
 * The shop's IANA timezone for dates/times in mails (`SHOP_TIMEZONE`, default `Europe/Vienna`).
 * An invalid value logs a warning once and falls back to the default — never fails a mail.
 */
export function shopTimeZone(value: string | undefined = process.env.SHOP_TIMEZONE): string {
  if (!value) return DEFAULT_SHOP_TIMEZONE
  try {
    new Intl.DateTimeFormat('en', { timeZone: value })
    return value
  } catch {
    if (!warnedTimeZones.has(value)) {
      warnedTimeZones.add(value)
      console.warn(`[itsshops] Invalid SHOP_TIMEZONE "${value}", using "${DEFAULT_SHOP_TIMEZONE}"`)
    }
    return DEFAULT_SHOP_TIMEZONE
  }
}

/**
 * Format a date (and optionally the time) in the shop's timezone — the one helper for every
 * date shown in a mail or its attachments.
 */
export function formatShopDate(
  date: Date | string | number,
  locale: string,
  options: { dateStyle?: 'full' | 'long' | 'medium' | 'short'; withTime?: boolean } = {},
): string {
  const { dateStyle = 'long', withTime = false } = options
  return new Intl.DateTimeFormat(locale, {
    dateStyle,
    ...(withTime && { timeStyle: 'short' as const }),
    timeZone: shopTimeZone(),
  }).format(new Date(date))
}
