import type { SanityClient } from '@sanity/client'
import { createImageBuilder } from '../core/clients/sanity'
import type { Locale } from '../types'
import type { ResolvedImage, ResolvedSeo } from './types'

type LocalizedStringArray = Array<{ _key: string; value?: string }> | undefined

let imageBuilder: ReturnType<typeof createImageBuilder> | null = null

export function initImageBuilder(client: SanityClient) {
  imageBuilder = createImageBuilder(client)
}

export function getImageBuilder() {
  return imageBuilder
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
