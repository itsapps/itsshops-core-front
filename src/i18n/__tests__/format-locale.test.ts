import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFormatLocales, intlLocale } from '../format-locale'
import { formatPrice, formatShopDate } from '../../netlify/utils/i18n'

// Intl output uses (narrow) no-break spaces in some locales — normalise for comparison.
const norm = (s: string) => s.replace(/[  ]/g, ' ')

describe('readFormatLocales', () => {
  afterEach(() => vi.restoreAllMocks())

  it('is empty when unset', () => {
    expect(readFormatLocales(undefined)).toEqual({})
    expect(readFormatLocales('  ')).toEqual({})
  })

  it('parses and canonicalises entries', () => {
    expect(readFormatLocales('de:de-at, en : en-GB')).toEqual({ de: 'de-AT', en: 'en-GB' })
  })

  it('skips invalid entries with one warning each', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(readFormatLocales('en:de-AT,fr:fr-FR,de:not a tag,de:de-CH')).toEqual({ de: 'de-CH' })
    expect(warn).toHaveBeenCalledTimes(3)
    // same raw value again: memoised, no new warnings
    readFormatLocales('en:de-AT,fr:fr-FR,de:not a tag,de:de-CH')
    expect(warn).toHaveBeenCalledTimes(3)
  })
})

describe('intlLocale', () => {
  it('maps a locale to its tag, else returns the locale', () => {
    expect(intlLocale('en', { en: 'en-GB' })).toBe('en-GB')
    expect(intlLocale('de', { en: 'en-GB' })).toBe('de')
  })
})

describe('netlify formatters with SHOP_FORMAT_LOCALES', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('formatPrice is unchanged when unset', () => {
    vi.stubEnv('SHOP_FORMAT_LOCALES', '')
    expect(norm(formatPrice(123450, 'de'))).toBe('1.234,50 €')
  })

  it('formatPrice uses the regional tag', () => {
    vi.stubEnv('SHOP_FORMAT_LOCALES', 'de:de-AT')
    expect(norm(formatPrice(123450, 'de'))).toBe('€ 1.234,50')
  })

  it('formatShopDate uses the regional tag', () => {
    vi.stubEnv('SHOP_FORMAT_LOCALES', 'de:de-AT,en:en-GB')
    expect(formatShopDate('2027-01-05T12:00:00Z', 'de')).toBe('5. Jänner 2027')
    expect(formatShopDate('2027-01-05T12:00:00Z', 'en')).toBe('5 January 2027')
  })
})
