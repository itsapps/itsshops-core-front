import type { ClientConfig } from '@sanity/client'
import type { Locale, PermalinkTranslations } from './localization'
import type { ResolveContext } from './context'
import type { EleventyConfig } from '11ty.ts'
import type { TranslatorFunction } from './t9n'
import { type ImageUrlBuilder } from '@sanity/image-url'
import type { VinofactField } from './vinofact'
import type { PortableTextHtmlComponents } from '@portabletext/to-html'
import type { CmsData, SearchEntry } from './data'
import type { PictureSize, PictureOptions } from '../image'
import type { ResolvedImage, ResolvedVariant } from './data'

export type PortableTextExtensionContext = {
  imageBuilder: ImageUrlBuilder
  imageSizes: Record<string, PictureSize>
  image: (img: ResolvedImage | null | undefined, size: PictureSize, options?: PictureOptions) => string
  imageUrl: (image: ResolvedImage | null | undefined, width?: number, height?: number, format?: 'webp' | 'jpg') => string
  escapeHTML: (str: string) => string
  stegaClean: <T>(value: T) => T
}

// ─── Env vars ─────────────────────────────────────────────────────────────────

export type EnvVars = {
  // Sanity
  SANITY_PROJECT_ID:  string | undefined
  SANITY_DATASET:     string | undefined
  SANITY_TOKEN:       string | undefined
  SANITY_STUDIO_URL:  string | undefined

  // Deployment
  URL: string | undefined  // Netlify: production URL

  // Build flags
  MAINTENANCE:    string | undefined  // 'true' | 'false'
  DO_INDEX_PAGES: string | undefined  // 'true' | 'false'
  MAX_PRODUCTS:   string | undefined
  MINIFY:         string | undefined  // 'true' | 'false'
  MINIFY_HTML:    string | undefined  // 'true' | 'false'
  INLINE_CSS:     string | undefined  // 'true' | 'false'

  // Local serve
  SERVE_LIVE_RELOAD:  string | undefined  // 'true' | 'false'
  SERVE_PORT:         string | undefined
  SERVE_REFETCH_DATA: string | undefined  // 'true' | 'false'

  // Preview
  IS_PREVIEW:          string | undefined  // 'true' | 'false'
  PREVIEW_PERSPECTIVE: string | undefined  // 'drafts' | 'published'
  PREVIEW_TYPE:        string | undefined  // document type, e.g. 'page' | 'post'
  PREVIEW_ID:          string | undefined
  PREVIEW_LOCALE:      string | undefined

  // Developer / site meta
  PUBLIC_DEVELOPER_NAME:    string | undefined
  PUBLIC_DEVELOPER_WEBSITE: string | undefined
  DEVELOPER_EMAIL:          string | undefined
  SHOP_ADMIN_EMAIL:         string | undefined
  SUPPORT_EMAIL:            string | undefined

  // Email — Mailgun
  MAILGUN_API_KEY:          string | undefined
  MAILGUN_DOMAIN:           string | undefined
  MAILGUN_USE_EU_REGION_URL: string | undefined  // 'true' | 'false'
  SEND_BUILD_EMAIL:         string | undefined   // 'true' | 'false'
  SEND_LOW_STOCK_EMAIL:     string | undefined   // 'true' | 'false'

  // Vinofact
  VINOFACT_API_URL:      string | undefined
  VINOFACT_API_TOKEN:    string | undefined
  VINOFACT_PROFILE_SLUG: string | undefined

  // Stripe
  STRIPE_PUBLISHABLE_API_KEY: string | undefined
  STRIPE_SECRET_API_KEY:      string | undefined  // server-side only
  STRIPE_ENDPOINT_SECRET:     string | undefined  // webhook secret, server-side only

  // Captcha
  CAPTCHA_SITE_KEY:   string | undefined
  CAPTCHA_SECRET_KEY: string | undefined  // server-side only

  // Supabase (users feature)
  SUPABASE_URL:                string | undefined
  SUPABASE_SECRET_KEY:         string | undefined  // server-side only
  SUPABASE_EMAIL_HOOKS_SECRET: string | undefined  // server-side only

  // Netlify functions
  SERVER_FUNCTIONS_ALLOWED_ORIGINS: string | undefined
  SERVER_FUNCTIONS_SECRET:          string | undefined  // server-side only
  SERVER_JWT_SECRET:                string | undefined  // server-side only

  // Testing
  TEST_USER_EMAIL:    string | undefined  // dev only
  TEST_USER_PASSWORD: string | undefined  // dev only
}

export type EnvVarName = keyof EnvVars

declare global {
  namespace NodeJS {
    interface ProcessEnv extends EnvVars {}
  }
}

// ─── Vinofact ────────────────────────────────────────────────────────────────

export type VinofactConfig = {
  enabled: boolean
  /**
   * Additional fields to request from the Vinofact wines query.
   * Base fields (id, slug, title) are always fetched.
   *
   * @example
   * fields: ['color', 'alcohol', 'year', 'varietals', 'awards']
   */
  fields?: VinofactField[]
  integration?: {
    endpoint: string
    accessToken: string
    profileSlug: string
  }
}

// ─── Features ────────────────────────────────────────────────────────────────

import type { UserRegistrationField } from './user'

/** Fully resolved internal feature config — all fields guaranteed present. */
export type Features = {
  shop: {
    enabled: boolean
    checkout: boolean    // frontend-only: Stripe checkout flow
    manufacturer: boolean
    stock: boolean
    category: boolean
    vinofact: VinofactConfig
  }
  blog: boolean
  users: {
    enabled: boolean
    registrationFields: UserRegistrationField[]
  }
}

/** Customer-facing input — omitting shop = shop disabled, omitting sub-flags = default off */
export type ItsshopsFeatures = {
  shop?: {
    checkout?: boolean
    manufacturer?: boolean
    stock?: boolean
    category?: boolean
    vinofact?: VinofactConfig
  }
  blog?: boolean
  users?: boolean | {
    registrationFields?: UserRegistrationField[]
  }
}

// ─── Sanity ───────────────────────────────────────────────────────────────────

export type SanityClientConfig = Omit<ClientConfig, 'apiVersion'> & { studioUrl?: string }

// ─── Headers / CSP ────────────────────────────────────────────────────────────

export type CspDirectives = Partial<{
  'script-src':  string[]
  'connect-src': string[]
  'frame-src':   string[]
  'img-src':     string[]
  'style-src':   string[]
}>

/** All directives present — used in CoreConfig after normalization */
export type ResolvedCspDirectives = {
  'script-src':  string[]
  'connect-src': string[]
  'frame-src':   string[]
  'img-src':     string[]
  'style-src':   string[]
}

export type HeadersConfig = {
  /** Extra CSP sources added to every route */
  extra?:  CspDirectives
  /** Additional custom routes with their own extra CSP sources */
  routes?: Array<{ path: string; extra: CspDirectives }>
}

// ─── CSS / JS ─────────────────────────────────────────────────────────────────

export type Css = {
  cssPath?: string
  minify?: boolean
  inline?: boolean
  viewport?: { min: number; max: number }
  screens?: Record<string, string>
  colors?: any[]
  fontFamilies?: any[]
  textSizes?: any[]
  spacings?: any[]
}

export type Js = {
  minify?: boolean
}

// ─── Search ───────────────────────────────────────────────────────────────────

export type SearchImageData = {
  src: string
  srcset: string
  sizes: string
  width: number
  height: number | undefined
}

export type SearchBuildContext = {
  /** Build a Sanity CDN URL for a resolved image. Returns empty string when image is absent. */
  imageUrl: (image: ResolvedImage | null | undefined, width?: number) => string
  /**
   * Build srcset/src data for a responsive image using a named size from the customer's imageSizes config.
   * Returns null when image is absent or the size name is not found.
   * Store the result in the search entry and use it in the JS renderer to build an <img> tag.
   */
  imageSrcset: (image: ResolvedImage | null | undefined, sizeName: string) => SearchImageData | null
  /** The customer's configured image sizes — use to check what's available. */
  imageSizes: Record<string, PictureSize>
  /** Format a volume in ml using the configured unit (ml, cl, l). */
  formatVolume: (ml: number, locale: string) => string
}

export type SearchConfig = {
  /**
   * Fields MiniSearch will index for full-text search.
   * Default: ['title']
   */
  searchFields?: string[]
  /**
   * Build one search entry per variant. Return null to exclude the variant.
   * Mutually exclusive with buildProductEntry.
   */
  buildEntry?: (variant: ResolvedVariant, locale: string, ctx: SearchBuildContext) => SearchEntry | null
  /**
   * Build one search entry per product (all variants grouped).
   * Return null to exclude the product.
   * Mutually exclusive with buildEntry.
   */
  buildProductEntry?: (variants: ResolvedVariant[], locale: string, ctx: SearchBuildContext) => SearchEntry | null
}

// ─── Extensions ───────────────────────────────────────────────────────────────

export type Extensions = {
  /** Search index configuration. When set, generates a per-locale search-{locale}.json file. */
  search?: SearchConfig
  /** Custom document type queries — results merged into cms global data */
  queries?: Record<string, string>
  /** Extra GROQ projection fields on core document/object types */
  fields?: Record<string, string>
  /** Custom module type projections per document type (page, post, ...) */
  modules?: Record<string, Record<string, string>>
  /** Named portable text extension sets. Use 'default' for the unnamed filter call.
   *  Usage in templates: {{ content | portableText | safe }}  or  {{ content | portableText('rich') | safe }} */
  portableTexts?: Record<string, (ctx: PortableTextExtensionContext) => Partial<PortableTextHtmlComponents>>
  /**
   * Resolve hooks — called per locale after core resolution.
   * Return fields to merge into the final output.
   *
   * @example
   * resolve: {
   *   variant(raw, { resolveString }) {
   *     return { isLimited: raw.isLimited ?? false, label: resolveString(raw.label) }
   *   }
   * }
   */
  /** Resolved hooks type — use this when typing the resolve extension object. */
  /**
   * Per-locale resolution of raw extension query results.
   * Called once per locale with the raw Sanity data from `queries`.
   * Return resolved data to merge into cms[locale] — same keys as queries.
   */
  resolveData?: (rawData: Record<string, any[]>, ctx: ResolveContext) => Record<string, unknown>
  /**
   * Called once after all raw Sanity data has been fetched, before per-locale resolution.
   * Use for debugging — set a breakpoint here to inspect raw query results.
   */
  onRawDataFetched?: (raw: Record<string, any>) => void
  /**
   * Called once after all CMS data has been built and resolved.
   * Use for debugging — set a breakpoint here to inspect the full cms object.
   *
   * @example
   * onCmsBuilt(cms) { console.log(cms) }
   */
  onCmsBuilt?: (cms: CmsData) => void
  resolve?: {
    variant?:  (raw: any, ctx: ResolveContext) => Record<string, unknown>
    product?:  (raw: any, ctx: ResolveContext) => Record<string, unknown>
    category?: (raw: any, ctx: ResolveContext) => Record<string, unknown>
    page?:     (raw: any, ctx: ResolveContext) => Record<string, unknown>
    post?:     (raw: any, ctx: ResolveContext) => Record<string, unknown>
    menuItem?: (raw: any, ctx: ResolveContext) => Record<string, unknown>
    /** Called for every module after core resolution. Return fields to merge in. */
    module?:   (module: any, ctx: ResolveContext) => Record<string, unknown>
    /** Called after core company resolution. Return fields to merge into company. */
    company?:  (raw: any, ctx: ResolveContext) => Record<string, unknown>
  }
}

export type ResolveHooks = NonNullable<Extensions['resolve']>

// ─── Customer config ──────────────────────────────────────────────────────────
//
// What customers pass to the plugin. Fields that have standard env var equivalents
// are optional here — the core reads the env var and the customer value wins if set.
//
// Standard env vars read by core (customer override field):
//   URL                        → baseUrl
//   MAINTENANCE                → buildMode = 'maintenance'
//   IS_PREVIEW                 → buildMode = 'preview'
//   DO_INDEX_PAGES             → doIndexPages
//   MAX_PRODUCTS               → maxProducts
//   MINIFY                     → css.minify / js.minify  (default: true)
//   INLINE_CSS                 → css.inline
//   ITSSHOPS_DEBUG             → debug.enabled
//   SERVE_PORT                 → serve.port
//   SERVE_LIVE_RELOAD          → serve.liveReload
//   SERVE_REFETCH_DATA         → serve.refetchData
//   PREVIEW_TYPE               → preview.documentType
//   PREVIEW_ID                 → preview.documentId
//   PREVIEW_LOCALE             → preview.locale
//   SANITY_PROJECT_ID          → sanity.projectId
//   SANITY_DATASET             → sanity.dataset
//   SANITY_TOKEN               → sanity.token
//   SANITY_STUDIO_URL          → sanity.studioUrl (from ClientConfig)
//   STRIPE_PUBLISHABLE_API_KEY → stripe.publishableApiKey
//   CAPTCHA_SITE_KEY           → captchaSiteKey
//   SUPPORT_EMAIL              → supportEmail

export type Config = {
  // required — project-specific, no env var equivalent
  locales?: Locale[]
  defaultLocale?: Locale

  // sanity — projectId/dataset/token can come from env vars
  sanity?: SanityClientConfig

  // features — project-specific
  features?: ItsshopsFeatures

  // i18n
  permalinks?: Partial<Record<Locale, PermalinkTranslations>>
  translations?: Record<string, any>

  // headers / CSP
  headers?: HeadersConfig

  // data extensions
  extensions?: Extensions

  menu?: {
    /** Maximum nesting depth for menu items. Defaults to 1 (one level of children). */
    maxDepth?: number
  }

  units?: {
    /** Unit appended to wine volume in variant labels and wine details. Defaults to 'ml'. */
    volume?: string
    price?: {
      /** ISO 4217 currency code. Defaults to 'EUR'. */
      currency?: string
      /**
       * Custom label appended after the number instead of the Intl currency symbol.
       * E.g. 'Eur' → "50,50 Eur". When omitted, uses Intl.NumberFormat currency formatting.
       */
      currencyLabel?: string
    }
  }

  // override env vars if needed
  baseUrl?: string
  doIndexPages?: boolean
  maxProducts?: number
  debug?: {
    enabled?: boolean
  }
  serve?: {
    port?: number
    liveReload?: boolean
    /** Re-fetch CMS data from Sanity on every rebuild. Defaults to true. */
    refetchData?: boolean
  }
  preview?: {
    documentType?: string
    documentId?: string
    locale?: Locale
  }
  css?: Css
  js?: Js

  // project-specific, no env var equivalent
  /**
   * Additional image size presets merged with core defaults.
   * Customer-defined presets extend (and can override) the built-in ones.
   *
   * @example
   * imageSizes: {
   *   splitModule: { sizes: [[800, 1200], [400, 600]], widths: '(min-width: 50rem) 50vw, 100vw' }
   * }
   */
  imageSizes?: Record<string, PictureSize>
  imagePlaceholders?: Record<string, string>
  manifest?: {
    themeBgColor?: string
    themeColor?: string
  }
  developer?: {
    name?: string
    website?: string
  }

  // override env vars if needed
  stripe?: {
    publishableApiKey?: string
  }
  captchaSiteKey?: string
  supportEmail?: string
}

// ─── Core config ──────────────────────────────────────────────────────────────
//
// Fully resolved internal config — built by reading env vars and merging customer
// config on top. All fields are guaranteed present after resolution.

export type CoreConfig = {
  buildMode: 'preview' | 'maintenance' | 'normal'
  sanity: SanityClientConfig & { projectId: string; dataset: string; studioUrl: string | undefined }
  locales: Locale[]
  defaultLocale: Locale
  features: Features
  permalinks: Partial<Record<Locale, PermalinkTranslations>>
  resolvedPermalinks: Record<Locale, Required<PermalinkTranslations>>
  userPaths: Record<Locale, import('./localization').UserPaths>
  translations: Record<string, any>
  headers: {
    extra:  ResolvedCspDirectives
    routes: Array<{ path: string; extra: ResolvedCspDirectives }>
  }
  extensions: Extensions
  menu: { maxDepth: number }
  units: { volume: string; price: { currency: string; currencyLabel?: string } }
  baseUrl: string
  hostname: string
  doIndexPages: boolean
  maxProducts: number
  debug: {
    enabled: boolean
  }
  serve: {
    port: number
    liveReload: boolean
    refetchData: boolean
  }
  preview: {
    enabled: boolean
    documentType: string | undefined
    documentId: string | undefined
    locale: Locale | undefined
  }
  css: Css
  js: Js
  imagePlaceholders: Record<string, string>
  manifest: {
    themeBgColor: string
    themeColor: string
  }
  developer: {
    name: string | undefined
    website: string | undefined
  }
  stripe: {
    publishableApiKey: string | undefined
  }
  captchaSiteKey: string | undefined
  supportEmail: string | undefined
}

export type CoreContext = {
  eleventyConfig: EleventyConfig
  config: CoreConfig
  translate: TranslatorFunction
  imageBuilder: ImageUrlBuilder
  imageSizes: Record<string, PictureSize>
}