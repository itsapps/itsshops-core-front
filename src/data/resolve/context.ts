import type { Locale, ResolveContext, TranslatorFunction } from '../../types'
import { resolveString, resolveLocaleValue, resolveImage, resolveLocaleAltImage, resolveBaseImage, resolveSeo, resolveCarousel } from '../localizers'
import { resolvePortableText } from '../portableText'

export function makeCtx(
  locale: Locale,
  defaultLocale: Locale,
  translate: TranslatorFunction,
  units: { volume: string } = { volume: 'l' },
): ResolveContext {
  return {
    locale,
    defaultLocale,
    units,
    resolveString:         (arr) => resolveString(arr, locale, defaultLocale),
    resolveImage:          (raw) => resolveImage(raw, locale, defaultLocale),
    resolveLocaleAltImage: (raw) => resolveLocaleAltImage(raw, locale, defaultLocale),
    resolveBaseImage:      (raw) => resolveBaseImage(raw),
    resolveSeo:            (raw) => resolveSeo(raw, locale, defaultLocale),
    resolveCarousel:       (raw) => resolveCarousel(raw, locale, defaultLocale),
    resolvePortableText:   (raw) => resolvePortableText(raw, locale, defaultLocale),
    resolveActions:        (raw) => (raw ?? []).map((a: any) => ({
      title:       resolveString(a.internalLinkTitle, locale, defaultLocale),
      internal:    a.internal ?? null,
      displayType: a.internalLinkDisplayType ?? null,
    })),
    resolveLocaleValue:    (arr) => resolveLocaleValue(arr, locale, defaultLocale),
    translate:             (key, params) => translate(key, params, locale),
  }
}
