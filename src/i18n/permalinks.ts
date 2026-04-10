import type { Locale, PermalinkTranslations, UserPaths } from '../types'
import deShared from './translations/de_shared'
import enShared from './translations/en_shared'

const defaults: Record<Locale, Required<PermalinkTranslations>> = {
  de: {
    product:     'produkte',
    category:    'kategorien',
    blog:        'blog',
    checkout:    'warenkorb',
    orderThanks: 'danke',
    account:     'konto',
    register:    'registrierung',
    recover:     'passwort-vergessen',
    login:       'anmelden',
  },
  en: {
    product:     'products',
    category:    'categories',
    blog:        'blog',
    checkout:    'checkout',
    orderThanks: 'thank-you',
    account:     'account',
    register:    'register',
    recover:     'recover-password',
    login:       'login',
  },
}

export function buildPermalinkTranslations(
  overrides?: Partial<Record<Locale, PermalinkTranslations>>
): Record<Locale, Required<PermalinkTranslations>> {
  if (!overrides) return defaults

  return (Object.keys(defaults) as Locale[]).reduce((acc, locale) => {
    acc[locale] = { ...defaults[locale], ...overrides[locale] }
    return acc
  }, {} as Record<Locale, Required<PermalinkTranslations>>)
}

const sharedTranslations: Record<string, { urlPaths: UserPaths }> = {
  de: deShared as { urlPaths: UserPaths },
  en: enShared as { urlPaths: UserPaths },
}

export function buildUserPaths(): Record<Locale, UserPaths> {
  return (Object.keys(sharedTranslations) as Locale[]).reduce((acc, locale) => {
    acc[locale] = sharedTranslations[locale].urlPaths
    return acc
  }, {} as Record<Locale, UserPaths>)
}

export function getPermalink(
  locale: Locale,
  segment: keyof PermalinkTranslations,
  slug: string,
  translations: Record<Locale, Required<PermalinkTranslations>>
): string {
  return `/${locale}/${translations[locale][segment]}/${slug}/`
}
