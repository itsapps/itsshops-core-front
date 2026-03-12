import type { ClientConfig } from '@sanity/client'

export type Locale = 'de' | 'en'

export type Features = {
  shop?: boolean
  blog?: boolean
  users?: boolean
}

export type SanityClientConfig = Omit<ClientConfig, 'apiVersion'>

export type PermalinkTranslations = {
  product?: string
  category?: string
  blog?: string
  page?: string
}

export type Config = {
  sanity: SanityClientConfig
  locales: Locale[]
  defaultLocale: Locale
  features?: Features
  permalinks?: Partial<Record<Locale, PermalinkTranslations>>
  extensions?: {
    /** Custom document type queries — results merged into cms global data */
    queries?: Record<string, string>
    /** Extra GROQ projection fields on core document/object types (variant, menuItem, ...) */
    fields?: Record<string, string>
    /** Custom module type projections per document type (page, post, category, ...) */
    modules?: Record<string, Record<string, string>>
  }
  tailwind?: {
    cssPath?: string
  }
  preview?: {
    enabled?: boolean
  }
}
