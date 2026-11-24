import i18next from 'i18next'
import _ from 'lodash'
import { CoreConfig } from '../../types/config';
import { TranslatorFunction } from '../../types/t9n';

export function createTranslator(config: CoreConfig, baseTranslations: Record<string, any> = {}) {
  const mergedResources: Record<string, any> = {};

  config.locales.forEach((lng) => {
    const base     = baseTranslations[lng]        || { common: {}, shared: {} }
    const overrides = config.translations[lng]    || {}

    // Deep merge: base (core files) first, project overrides win
    mergedResources[lng] = _.merge({}, base, overrides);
  });


  i18next.init({
    // debug: isDev,
    saveMissing: config.debug.enabled, // Only enable missing key logging in dev mode
    fallbackLng: config.defaultLocale,
    supportedLngs: config.locales,
    // missingKeyHandler: function(lng, ns, key, fallbackValue, updateMissing, options) {
    // l, namespace, k, defaultForMissing, updateMissing, opt)
    missingKeyHandler: function(lngs: readonly string[], ns: string, key: string, fallbackValue: string, _updateMissing: boolean, _options: any) {
      throw new Error(`Missing translation key: ${key} (namespace: ${ns}, language: ${lngs}, fallback value: ${fallbackValue})`);
    },
    ...config.debug.enabled && { missingInterpolationHandler: function(text: string, value: string) {
      throw new Error(`Missing interpolation value: ${value} (text: ${text})`);
    }},
    ns: ['common', 'shared'],
    defaultNS: 'common',
    resources: mergedResources,
  })

  const translate: TranslatorFunction = (key, params = {}, locale) => {
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

  return {
    i18next,
    translate,
  }
}

