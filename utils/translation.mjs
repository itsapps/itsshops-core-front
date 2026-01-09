import common_de from '../translations/de_11ty.mjs';
import common_en from '../translations/en_11ty.mjs';
import shared_de from '../translations/de_shared.mjs';
import shared_en from '../translations/en_shared.mjs';
import i18next from 'i18next'

export function createTranslation({isDev, locales, defaultLocale}) {
  i18next.init({
    // debug: isDev,
    saveMissing: isDev,
    fallbackLng: defaultLocale,
    supportedLngs: locales,
    missingKeyHandler: function(lng, ns, key, fallbackValue, updateMissing, options) {
      throw new Error(`Missing translation key: ${key} (namespace: ${ns}, language: ${lng}, fallback value: ${fallbackValue})`);
    },
    ...isDev && { missingInterpolationHandler: function(text, value) {
      throw new Error(`Missing interpolation value: ${value} (text: ${text})`);
    }},
    ns: ['common', 'shared'],
    defaultNS: 'common',
    resources: {
      de: { common: common_de, shared: shared_de },
      en: { common: common_en, shared: shared_en },
    },
  })

  const translate = (key, params={}, locale) => {
    try {
      return i18next.t(key, { lng: locale, ...params })
    } catch (err) {
      // Improve error visibility in Eleventy
      const message = `❌ ${err.message}`;
      console.error(message);
      // Re-throw as a new Error so Eleventy shows the details
      throw new Error(message);
    }
  }

  return translate
}

