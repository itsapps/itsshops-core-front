import i18next from 'i18next'
import _ from 'lodash'
import { CoreConfig } from '../../types/config';

export default function (config: CoreConfig, customerResources: Record<string, any> = {}) {
  const mergedResources: Record<string, any> = {};
  // Respect the locales array
  config.locales.forEach((lng) => {
    // Get the core defaults for this language (if they exist)
    const coreForLng = config.translations[lng] || { common: {}, shared: {} };
    
    // Get the customer overrides for this language
    const customerForLng = customerResources[lng] || {};

    // Deep merge both namespaces (common AND shared)
    mergedResources[lng] = _.merge({}, coreForLng, customerForLng);
  });


  i18next.init({
    // debug: isDev,
    saveMissing: config.dev.enabled, // Only enable missing key logging in dev mode
    fallbackLng: config.defaultLocale,
    supportedLngs: config.locales,
    // missingKeyHandler: function(lng, ns, key, fallbackValue, updateMissing, options) {
    // l, namespace, k, defaultForMissing, updateMissing, opt)
    missingKeyHandler: function(lngs: string, ns: string, key: string, fallbackValue: string, updateMissing: boolean, options: any) {
      throw new Error(`Missing translation key: ${key} (namespace: ${ns}, language: ${lngs}, fallback value: ${fallbackValue})`);
    },
    ...config.dev.enabled && { missingInterpolationHandler: function(text: string, value: string) {
      throw new Error(`Missing interpolation value: ${value} (text: ${text})`);
    }},
    ns: ['common', 'shared'],
    defaultNS: 'common',
    resources: mergedResources,
  })

  const translate = (key: string, params: Record<string, unknown> = {}, locale: string) => {
    try {
      return i18next.t(key, { lng: locale, ...params })
    } catch (err) {
      // Improve error visibility in Eleventy
      const message = `❌ ${(err as Error).message}`;
      console.error(message);
      // Re-throw as a new Error so Eleventy shows the details
      throw new Error(message);
    }
  }

  return translate
}

