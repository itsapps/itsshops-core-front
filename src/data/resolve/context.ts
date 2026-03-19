import type { Locale, ResolveContext, TranslatorFunction, Extensions } from '../../types'
import { resolveString, resolveLocaleValue, resolveImage, resolveLocaleAltImage, resolveBaseImage, resolveSeo, resolveCarousel } from '../localizers'
import { resolvePortableText, renderPortableText } from '../portableText'

export function makeCtx(
  locale: Locale,
  defaultLocale: Locale,
  translate: TranslatorFunction,
  extensions: Extensions = {},
): ResolveContext {
  return {
    locale,
    defaultLocale,
    resolveString:         (arr) => resolveString(arr, locale, defaultLocale),
    resolveImage:          (raw) => resolveImage(raw, locale, defaultLocale),
    resolveLocaleAltImage: (raw) => resolveLocaleAltImage(raw, locale, defaultLocale),
    resolveBaseImage:      (raw) => resolveBaseImage(raw),
    resolveSeo:            (raw) => resolveSeo(raw, locale, defaultLocale),
    resolveCarousel:       (raw) => resolveCarousel(raw, locale, defaultLocale),
    resolvePortableText:   (raw) => resolvePortableText(raw, locale, defaultLocale),
    resolveLocaleValue:    (arr) => resolveLocaleValue(arr, locale, defaultLocale),
    translate:             (key, params) => translate(key, params, locale),
  }
}
