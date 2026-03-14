export type Locale = 'de' | 'en'

export interface ITSi18nDictValue<T = string> {
  [key: string]: T | undefined
}

export type PermalinkTranslations = {
  product?: string
  category?: string
  blog?: string
  page?: string
}