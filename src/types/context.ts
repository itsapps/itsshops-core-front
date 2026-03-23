import type { BoundLocalizers } from '../data/localizers'
import type { Locale } from './localization'
import type { TranslatorParams } from './t9n'

/** Context passed to resolve hooks so customers can locale-resolve their extended fields */
export type ResolveContext = BoundLocalizers & {
  locale: Locale
  defaultLocale: Locale
  resolvePortableText: (raw: any) => any[]
  /** Translate a key in the current locale. Locale is pre-bound from the resolution context. */
  translate: (key: string, params?: TranslatorParams) => string
  units: { volume: string }
}
