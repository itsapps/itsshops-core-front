import common_de from '../translations/de_11ty.mjs';
import common_en from '../translations/en_11ty.mjs';
import shared_de from '../translations/de_shared.mjs';
import shared_en from '../translations/en_shared.mjs';
import initTranslation from '../translations/t9n.mjs';

export function createTranslation({isDev, locales, defaultLocale, customerResources = {}}) {
  const coreResources = {
    de: { common: common_de, shared: shared_de },
    en: { common: common_en, shared: shared_en },
  };
  return initTranslation({isDev, locales, defaultLocale, coreResources, customerResources});
}

