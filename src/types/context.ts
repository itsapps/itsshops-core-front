import type { resolveString, resolveImage, resolveLocaleAltImage, resolveBaseImage } from '../data/locale'
import { type Locale } from './localization'

/** Context passed to resolve hooks so customers can locale-resolve their extended fields */
export type ResolveContext = {
  locale: Locale
  defaultLocale: Locale
  resolveString: typeof resolveString
  resolveImage: typeof resolveImage
  resolveLocaleAltImage: typeof resolveLocaleAltImage
  resolveBaseImage: typeof resolveBaseImage
  resolvePortableText: (raw: any) => string
}
