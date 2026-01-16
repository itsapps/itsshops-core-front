import common_de from '../translations/de_server.mjs';
import common_en from '../translations/en_server.mjs';
import shared_de from '../translations/de_shared.mjs';
import shared_en from '../translations/en_shared.mjs';
import initTranslation from '../translations/t9n.mjs';

export function createTranslation(
	{isDev, locales, defaultLocale, customerResources}:
	{isDev: boolean, locales: string[], defaultLocale: string, customerResources: Record<string, any>}
) {
  const coreResources = {
    de: { common: common_de, shared: shared_de },
    en: { common: common_en, shared: shared_en },
  };
  return initTranslation({isDev, locales, defaultLocale, coreResources, customerResources});
}


const localeFromRequest = (request: Request, supportedLocales: string[], defaultLocale: string) => {
	const acceptLanguage = request.headers.get("Accept-Language");
	if (acceptLanguage) {
	  const firstLang = acceptLanguage.split(',')[0].trim(); // "de-DE"
	  const langCode = firstLang.split('-')[0]; // "de"
	  return supportedLocales.includes(langCode) ? langCode : defaultLocale;
	}
  
	return defaultLocale;
}

export const createTranslationFromLocale = (locale: string, isDev: boolean, locales: string[], defaultLocale: string, customerResources: Record<string, any>) => {
	const translate = createTranslation({isDev, locales, defaultLocale, customerResources});
	const t = (key: string, params={}) => {
	  return translate(key, params, locale)
	}
	return t
}

export const createTranslationFromRequest = (request: Request, isDev: boolean, locales: string[], defaultLocale: string, customerResources: Record<string, any>) => {
	const locale = localeFromRequest(request, locales, defaultLocale)
	return createTranslationFromLocale(locale, isDev, locales, defaultLocale, customerResources)
}