import type { Locale, PermalinkTranslations } from '../types'

const defaults: Record<Locale, Required<PermalinkTranslations>> = {
  de: {
    product:  'produkte',
    category: 'kategorien',
    blog:     'blog',
    page:     'seiten',
  },
  en: {
    product:  'products',
    category: 'categories',
    blog:     'blog',
    page:     'pages',
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

export function getPermalink(
  locale: Locale,
  segment: keyof PermalinkTranslations,
  slug: string,
  translations: Record<Locale, Required<PermalinkTranslations>>
): string {
  return `/${locale}/${translations[locale][segment]}/${slug}/`
}
