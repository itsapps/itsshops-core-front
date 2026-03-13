import type { ClientConfig } from '@sanity/client'
import type { resolveString, resolveImage, resolveLocaleAltImage, resolveBaseImage } from '../data/locale'
import type { resolvePortableText } from '../data/portableText'

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

/** Context passed to resolve hooks so customers can locale-resolve their extended fields */
export type ResolveContext = {
  locale: Locale
  defaultLocale: Locale
  resolveString: typeof resolveString
  resolveImage: typeof resolveImage
  resolveLocaleAltImage: typeof resolveLocaleAltImage
  resolveBaseImage: typeof resolveBaseImage
  resolvePortableText: (raw: any) => string
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
    /** Extra GROQ projection fields on core document/object types */
    fields?: Record<string, string>
    /**
     * Resolve hooks for extended fields — called per locale with the raw Sanity item.
     * Return an object of resolved fields to merge into the final output.
     *
     * @example
     * resolve: {
     *   variant(raw, { resolveString }) {
     *     return { isLimited: raw.isLimited ?? false, label: resolveString(raw.label) }
     *   }
     * }
     */
    resolve?: {
      variant?:  (raw: any, ctx: ResolveContext) => Record<string, unknown>
      product?:  (raw: any, ctx: ResolveContext) => Record<string, unknown>
      category?: (raw: any, ctx: ResolveContext) => Record<string, unknown>
      page?:     (raw: any, ctx: ResolveContext) => Record<string, unknown>
      post?:     (raw: any, ctx: ResolveContext) => Record<string, unknown>
      menuItem?: (raw: any, ctx: ResolveContext) => Record<string, unknown>
      /** Called for every module after core resolution. Return fields to merge in. */
      module?:   (module: any, ctx: ResolveContext) => Record<string, unknown>
    }
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
