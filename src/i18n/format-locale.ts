/**
 * Opt-in regional formatting (dates, numbers, prices) per locale.
 *
 * `SHOP_FORMAT_LOCALES`, e.g. `en:en-GB` or `de:de-AT,en:en-GB`. Unset = the bare locale (`de`,
 * `en`) — today's output. Set it on the Netlify site for **all scopes**, like `SHOP_FORMALITY`:
 * the build (website, browser via `data-format-locale`) and the functions (mails, PDFs) both read
 * it. Only formatting uses it — `lang`, `hreflang`, translations, the API locale stay bare.
 */
import type { Locale } from '../types/localization'

const LOCALES: readonly Locale[] = ['de', 'en']

const warned = new Set<string>()
const cache = new Map<string, Partial<Record<Locale, string>>>()

function warnOnce(key: string, message: string) {
  if (warned.has(key)) return
  warned.add(key)
  console.warn(message)
}

/** `SHOP_FORMAT_LOCALES` → `{ de?: 'de-AT', en?: 'en-GB' }`. Invalid entries (not a valid BCP 47
 *  tag, or a tag whose language ≠ the key) warn once and are skipped — never fail a build or a mail. */
export function readFormatLocales(value: string | undefined = process.env.SHOP_FORMAT_LOCALES): Partial<Record<Locale, string>> {
  const raw = (value ?? '').trim()
  if (!raw) return {}
  const cached = cache.get(raw)
  if (cached) return cached

  const map: Partial<Record<Locale, string>> = {}
  for (const entry of raw.split(',')) {
    if (!entry.trim()) continue
    const i = entry.indexOf(':')
    const key = (i < 0 ? entry : entry.slice(0, i)).trim()
    const tag = i < 0 ? '' : entry.slice(i + 1).trim()
    let canonical: string | undefined
    try {
      canonical = tag ? Intl.getCanonicalLocales(tag)[0] : undefined
    } catch {
      canonical = undefined
    }
    if (!LOCALES.includes(key as Locale) || !canonical || new Intl.Locale(canonical).language !== key) {
      warnOnce(`${raw}|${entry}`, `[itsshops] Invalid SHOP_FORMAT_LOCALES entry "${entry.trim()}" — expected e.g. "de:de-AT", skipped`)
      continue
    }
    map[key as Locale] = canonical
  }
  cache.set(raw, map)
  return map
}

/** The Intl tag for a locale: `formatLocales[locale] ?? locale`. */
export function intlLocale(locale: string, map: Partial<Record<string, string>> = readFormatLocales()): string {
  return map[locale] ?? locale
}
