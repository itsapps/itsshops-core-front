import type { Locale, ResolveContext, TranslatorFunction } from '../../types'
import { resolveString, resolveImage, resolveLocaleAltImage, resolveBaseImage, resolveSeo } from '../localizers'
import { resolvePortableText } from '../portableText'

export function makeCtx(locale: Locale, defaultLocale: Locale, translate: TranslatorFunction): ResolveContext {
  return {
    locale,
    defaultLocale,
    resolveString:         (arr) => resolveString(arr, locale, defaultLocale),
    resolveImage:          (raw) => resolveImage(raw, locale, defaultLocale),
    resolveLocaleAltImage: (raw) => resolveLocaleAltImage(raw, locale, defaultLocale),
    resolveBaseImage:      (raw) => resolveBaseImage(raw),
    resolveSeo:            (raw) => resolveSeo(raw, locale, defaultLocale),
    resolvePortableText:   (raw) => resolvePortableText(raw, locale, defaultLocale),
    translate:             (key, params) => translate(key, params, locale),
  }
}
