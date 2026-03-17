export type Locale = 'de' | 'en'

export interface ITSi18nDictValue<T = string> {
  [key: string]: T | undefined
}

// export interface ITSi18nEntry<T = string> {
//   _key: string
//   value?: T
// }

// export type ITSi18nArray<T = string> = ITSi18nEntry<T>[]
export type LocalizedStringArray = Array<{ _key: string; value?: string }> | undefined

export type PermalinkTranslations = {
  product?:  string
  category?: string
  blog?:     string
  checkout?: string
  account?:  string
  register?: string
  recover?:  string
  login?:    string
}