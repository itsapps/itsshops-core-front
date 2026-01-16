import i18next from 'i18next'
import _ from 'lodash'

export default function ({isDev, locales, defaultLocale, coreResources = {}, customerResources = {}}) {
  const mergedResources = {};
  // Respect the locales array
  locales.forEach((lng) => {
    // Get the core defaults for this language (if they exist)
    const coreForLng = coreResources[lng] || { common: {}, shared: {} };
    
    // Get the customer overrides for this language
    const customerForLng = customerResources[lng] || {};

    // Deep merge both namespaces (common AND shared)
    mergedResources[lng] = _.merge({}, coreForLng, customerForLng);
  });


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
    resources: mergedResources,
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

