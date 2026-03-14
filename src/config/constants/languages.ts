import { Language, Locale } from '../../types'

export const languages: Language[] = [
  {
      label: 'DE',
      code: 'de',
      long: 'Deutsch',
      localeCode: 'de_DE'
  },
  {
      label: 'EN',
      code: 'en',
      long: 'English',
      localeCode: 'en_EN'
  },
];
export const languageMap: Record<Locale, Language> = Object.assign({}, ...languages.map(x => ({[x.code]: x})));

export default {
  languages,
  languageMap,
}