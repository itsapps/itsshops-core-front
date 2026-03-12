import type { SanityClient } from '@sanity/client'
import { createImageBuilder } from '../core/clients/sanity'
import type { Locale } from '../types'
import type { ResolvedImage, ResolvedSeo } from './types'

type LocalizedStringArray = Array<{ _key: string; value?: string }> | undefined

type RawLocaleImage = {
  image?: Array<{
    _key: string
    value?: {
      asset?: { _id: string; _ref: string }
      hotspot?: { x: number; y: number; height: number; width: number }
      crop?: { top: number; bottom: number; left: number; right: number }
    }
  }>
  alt?: Array<{ _key: string; value?: string }>
} | null | undefined

let imageBuilder: ReturnType<typeof createImageBuilder> | null = null

export function initImageBuilder(client: SanityClient) {
  imageBuilder = createImageBuilder(client)
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

export function resolveImage(
  raw: RawLocaleImage,
  locale: Locale,
  defaultLocale: Locale
): ResolvedImage | null {
  if (!raw?.image?.length || !imageBuilder) return null

  const entry =
    raw.image.find(e => e._key === locale) ??
    raw.image.find(e => e._key === defaultLocale) ??
    raw.image[0]

  const cropImage = entry?.value
  if (!cropImage?.asset) return null

  const url = imageBuilder.image(cropImage as any).url()
  const alt = resolveString(raw.alt, locale, defaultLocale)

  return {
    url,
    alt,
    hotspot: cropImage.hotspot as any,
    crop: cropImage.crop as any,
  }
}

export function resolveSeo(
  raw: {
    metaTitle?: LocalizedStringArray
    metaDescription?: LocalizedStringArray
    shareTitle?: LocalizedStringArray
    shareDescription?: LocalizedStringArray
    keywords?: LocalizedStringArray
    shareImage?: RawLocaleImage
  } | null | undefined,
  locale: Locale,
  defaultLocale: Locale
): ResolvedSeo {
  if (!raw) {
    return {
      metaTitle: '',
      metaDescription: '',
      shareTitle: '',
      shareDescription: '',
      shareImage: null,
      keywords: '',
    }
  }
  return {
    metaTitle:       resolveString(raw.metaTitle, locale, defaultLocale),
    metaDescription: resolveString(raw.metaDescription, locale, defaultLocale),
    shareTitle:      resolveString(raw.shareTitle, locale, defaultLocale),
    shareDescription:resolveString(raw.shareDescription, locale, defaultLocale),
    keywords:        resolveString(raw.keywords, locale, defaultLocale),
    shareImage:      resolveImage(raw.shareImage, locale, defaultLocale),
  }
}
