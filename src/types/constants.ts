import type { ITSi18nDictValue, Locale } from './localization'

export type Language = {
  label: string,
  code: Locale,
  long: string,
  localeCode: string
}

export type Country = {
  title: ITSi18nDictValue
  code: string
  emoji: string
  continent: string
  currency: string[]
}

export type CountryOption = {
  title: string
  value: string
}

export type VolumeOption = {
  title: string
  value: number
}
