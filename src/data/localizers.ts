import type { Locale, LocalizedStringArray } from '../types'
import type { ResolvedCarousel, ResolvedImage, ResolvedSeo } from '../types/data'

/** Locale-bound localizer functions — pre-applied with (locale, defaultLocale). */
export type BoundLocalizers = {
  resolveString:         (arr: LocalizedStringArray) => string
  resolveLocaleValue:    (arr: any) => any
  resolveImage:          (raw: { image?: any[]; alt?: any[] } | null | undefined) => ResolvedImage | null
  resolveLocaleAltImage: (raw: any) => ResolvedImage | null
  resolveBaseImage:      (raw: any) => ResolvedImage | null
  resolveSeo:            (raw: any) => ResolvedSeo
  resolveCarousel:       (raw: any) => ResolvedCarousel | null
}

/**
 * Resolve a locale entry from an i18nObject array `[{ _key, value: T }]`.
 * Returns the value for the given locale, falling back to defaultLocale, then first entry.
 * Use when `value` is an object (e.g. i18nStandardContent) rather than a plain string.
 */
export function resolveLocaleValue(
  arr: Array<{ _key: string; value: unknown }> | null | undefined,
  locale: Locale,
  defaultLocale: Locale,
): unknown {
  return (
    (arr ?? []).find(e => e._key === locale)
    ?? (arr ?? []).find(e => e._key === defaultLocale)
    ?? (arr ?? [])[0]
  )?.value
}

export function resolveString(
  arr: LocalizedStringArray,
  locale: Locale,
  defaultLocale: Locale
): string {
  if (!arr?.length) return ''
  return (
    arr.find(e => e._key === locale)?.value ??
    arr.find(e => e._key === defaultLocale)?.value ??
    arr[0]?.value ??
    ''
  )
}

/** localeImage: { image: i18nCropImage[], alt: i18nString[] } */
export function resolveImage(
  raw: { image?: any[]; alt?: any[] } | null | undefined,
  locale: Locale,
  defaultLocale: Locale
): ResolvedImage | null {
  if (!raw?.image?.length) return null

  const entry =
    raw.image.find(e => e._key === locale) ??
    raw.image.find(e => e._key === defaultLocale) ??
    raw.image[0]

  const img = entry?.value
  if (!img?.asset) return null

  return {
    asset: { _ref: img.asset._ref ?? img.asset._id },
    alt: resolveString(raw.alt, locale, defaultLocale),
    hotspot: img.hotspot,
    crop: img.crop,
  }
}

/** localeAltImage: single Sanity image with localized alt text */
export function resolveLocaleAltImage(
  raw: any,
  locale: Locale,
  defaultLocale: Locale
): ResolvedImage | null {
  if (!raw?.asset) return null
  return {
    asset: { _ref: raw.asset._ref ?? raw.asset._id },
    alt: resolveString(raw.alt, locale, defaultLocale),
    hotspot: raw.hotspot,
    crop: raw.crop,
  }
}

/** baseImage: single Sanity image with plain string alt */
export function resolveBaseImage(raw: any): ResolvedImage | null {
  if (!raw?.asset) return null
  return {
    asset: { _ref: raw.asset._ref ?? raw.asset._id },
    alt: raw.alt ?? '',
    hotspot: raw.hotspot,
    crop: raw.crop,
  }
}

export function resolveCarousel(raw: any, locale: Locale, defaultLocale: Locale): ResolvedCarousel | null {
  if (!raw) return null
  return {
    autoplay:      raw.autoplay      ?? false,
    autoplayDelay: raw.autoplayDelay ?? 5,
    loop:          raw.loop          ?? false,
    fade:          raw.fade          ?? false,
    slides: (raw.slides ?? [])
      .map((s: any) => resolveLocaleAltImage(s, locale, defaultLocale))
      .filter((s: ResolvedImage | null): s is ResolvedImage => s !== null),
  }
}

export function resolveSeo(
  raw: {
    metaTitle?: LocalizedStringArray
    metaDescription?: LocalizedStringArray
    shareTitle?: LocalizedStringArray
    shareDescription?: LocalizedStringArray
    keywords?: LocalizedStringArray
    shareImage?: any
  } | null | undefined,
  locale: Locale,
  defaultLocale: Locale
): ResolvedSeo {
  if (!raw) {
    return { metaTitle: '', metaDescription: '', shareTitle: '', shareDescription: '', shareImage: null, keywords: '' }
  }
  return {
    metaTitle:        resolveString(raw.metaTitle, locale, defaultLocale),
    metaDescription:  resolveString(raw.metaDescription, locale, defaultLocale),
    shareTitle:       resolveString(raw.shareTitle, locale, defaultLocale),
    shareDescription: resolveString(raw.shareDescription, locale, defaultLocale),
    keywords:         resolveString(raw.keywords, locale, defaultLocale),
    shareImage:       resolveImage(raw.shareImage, locale, defaultLocale),
  }
}
