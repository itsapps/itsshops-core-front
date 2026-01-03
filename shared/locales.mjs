export const languages = [
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
export const languageMap = Object.assign({}, ...languages.map(x => ({[x.code]: x})));

export default {
  languages,
  languageMap,
}