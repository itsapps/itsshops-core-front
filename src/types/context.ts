import type { BoundLocalizers } from '../data/localizers'
import type { Locale } from './localization'
import type { TranslatorParams } from './t9n'

export type ResolvedAction = {
  title: string
  internal: { _id: string; _type: string } | null
  displayType: string | null
}

/** Context passed to resolve hooks so customers can locale-resolve their extended fields */
export type ResolveContext = BoundLocalizers & {
  locale: Locale
  defaultLocale: Locale
  resolvePortableText: (raw: any) => any[]
  resolveActions: (raw: any) => ResolvedAction[]
  /** Translate a key in the current locale. Locale is pre-bound from the resolution context. */
  translate: (key: string, params?: TranslatorParams) => string
  units: { volume: string }
}
