import {
  formatDate,
  localizeMoney,
  localizeNumber,
  getLocalizedValue,
  getLocalizedObject,
  getLocalizedImage,
} from './localize.mjs';

export function localizer(supportedLocales, defaultLocale) {
  return {
    formatDate: (dateString, locale, dateStyle, timeStyle) => {
      return formatDate(dateString, locale, dateStyle, timeStyle);
    },
    localizeMoney: (number, locale) => {
      return localizeMoney(number, locale);
    },
    localizeNumber: (number, locale, options) => {
      return localizeNumber(number, locale, options);
    },
    getLocalizedValue: (obj, attribute, locale) => {
      return getLocalizedValue(obj, attribute, locale, defaultLocale, supportedLocales);
    },
    getLocalizedObject: (obj, locale) => {
      return getLocalizedObject(obj, locale, defaultLocale, supportedLocales);
    },
    getLocalizedImage: (image, locale) => {
      return getLocalizedImage(image, locale, defaultLocale, supportedLocales);
    }
  }
}