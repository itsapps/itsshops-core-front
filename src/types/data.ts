import type { SanityImageHotspot, SanityImageCrop } from './sanity'
import type { VinofactWine } from './vinofact'

/**
 * Resolved types — all localized fields are plain strings, ready for templates.
 * These are what the cms global data exposes to Nunjucks.
 */

export type ResolvedImage = {
  asset: {
    _ref: string
    dimensions?: { width: number; height: number; aspectRatio: number }
  }
  alt: string
  hotspot?: SanityImageHotspot
  crop?: SanityImageCrop
}

export type ResolvedCarousel = {
  autoplay: boolean
  autoplayDelay: number
  loop: boolean
  fade: boolean
  slides: ResolvedImage[]
}

export type ResolvedSeo = {
  metaTitle: string
  metaDescription: string
  shareTitle: string
  shareDescription: string
  shareImage: ResolvedImage | null
  keywords: string
}

export type ResolvedCategory = {
  _id: string
  _type: 'category'
  _updatedAt: string | null
  title: string
  description: string
  slug: string
  url: string
  locale: string
  sortOrder: number
  parentId: string | null
  seo: ResolvedSeo
  /** Filter group keys to show on the category page (resolved from Sanity filter config) */
  filters: ResolvedFilterKey[]
}

export type ResolvedManufacturer = {
  _id: string
  name: string
}

export type ResolvedOption = {
  _id: string
  name: string
}

export type ResolvedBundleItem = {
  quantity: number
  variant: {
    _id: string
    title: string
    label: string
    labels: string[]
    url: string | null
    kind: string
    volume: number | null
    vintage: string | null
    options: ResolvedOption[]
  }
}

export type ResolvedMenuItem = {
  _key: string
  title: string
  linkType: 'internal' | 'external' | 'submenu'
  url: string | null
  internal: { _id: string; _type: string; slug: string } | null
  children: ResolvedMenuItem[]
  // extended fields land here at runtime (e.g. images from Jurtschitsch)
  [key: string]: unknown
}

export type ResolvedMenu = {
  _id: string
  title: string
  items: ResolvedMenuItem[]
}

export type ResolvedAddress = {
  line1: string
  line2: string
  zip: string
  city: string
  country: string
}

export type ResolvedCompany = {
  name: string
  owner: string
  address: ResolvedAddress | null
  email: string | null
  phone: string | null
  vatId: string | null
  [key: string]: unknown
}

export type ResolvedSettings = {
  _id: string
  siteTitle: string
  siteShortDescription: string
  homePageId: string | null
  privacyPageId: string | null
  mainMenus: string[]
  footerMenus: string[]
  gtmId: string | null
  company: ResolvedCompany | null
  defaultShareImage: ResolvedImage | null
}

export type ResolvedShopSettings = {
  _id: string
  shopPageId: string | null
  defaultCountry: { _id: string; countryCode: string } | null
  freeShippingCalculation: 'beforeDiscount' | 'afterDiscount'
  stockThreshold: number | null
  defaultTaxCategory: { _id: string; title: string; code: string } | null
  orderNumberPrefix: string | null
  invoiceNumberPrefix: string | null
  billingAddress: ResolvedAddress | null
  bankAccount: { name: string; bic: string; iban: string } | null
  /** Global default filters applied when a module/category defines no local filters */
  filters: ResolvedFilterKey[]
}

/**
 * Resolved wine data: Sanity fields (volume, vintage) merged with Vinofact API data.
 * Vinofact fields are optional — only present when vinofact is enabled and the field
 * is included in VinofactConfig.fields.
 */
export type ResolvedWine = {
  volume: number | null
  vintage: string | null
} & Partial<VinofactWine>

export type FilterValue = {
  value: string   // URL-safe slug
  label: string   // display label
  count: number   // number of active variants with this value
}

export type FilterGroup = {
  key: string         // URL param key (e.g. 'vintage', 'groesse')
  label: string       // display label (e.g. 'Jahrgang', 'Größe')
  values: FilterValue[]
}

/** Resolved filter key — references either a wine field key or a slugified option group title */
export type ResolvedFilterKey = string

export type ResolvedVariant = {
  _id: string
  _type: 'productVariant'
  _updatedAt: string | null
  slug: string
  url: string
  locale: string
  status: 'active' | 'comingSoon' | 'soldOut' | 'archived'
  title: string
  label: string
  sku: string
  kind: 'wine' | 'physical' | 'digital' | 'bundle'
  featured: boolean
  price: number
  compareAtPrice: number | null
  image: ResolvedImage | null
  seo: ResolvedSeo
  categories: ResolvedCategory[]
  manufacturers: ResolvedManufacturer[]
  taxCategoryId: string | null
  stock: number | null
  wine: ResolvedWine | null
  options: ResolvedOption[]
  bundleItems: ResolvedBundleItem[]
  product: { _id: string; title: string }
  siblings: Array<{ _id: string; title: string; label: string; labels: string[]; url: string; status: string; kind: string }>
  /** URL-safe filter attributes for client-side filtering. Key = filter group key, value = slugified values. */
  filterAttributes: Record<string, string[]>
  // extended fields land here at runtime (e.g. isLimited from customer extensions)
  [key: string]: unknown
}

export type ResolvedPage = {
  _id: string
  _type: 'page'
  _updatedAt: string | null
  title: string
  slug: string
  url: string
  locale: string
  modules: unknown[]
  seo: ResolvedSeo
  [key: string]: unknown
}

export type ResolvedPost = {
  _id: string
  _type: 'post'
  _updatedAt: string | null
  title: string
  slug: string
  url: string
  locale: string
  publishedAt: string | null
  modules: unknown[]
  seo: ResolvedSeo
  [key: string]: unknown
}

/** The full cms global data object exposed to Eleventy templates */
export type CmsLocaleData = {
  products: ResolvedVariant[]
  categories: ResolvedCategory[]
  filterGroups: FilterGroup[]
  pages: ResolvedPage[]
  posts: ResolvedPost[]
  menus: ResolvedMenu[]
  settings: ResolvedSettings | null
  shopSettings: ResolvedShopSettings | null
  /** Sanity _id → resolved URL for the current locale. Used by portableTextToHTML for internal links. */
  urlMap: Record<string, string>
  /** Sanity _id → resolved document (variant, category, page, or post) for the current locale. */
  docMap: Record<string, ResolvedVariant | ResolvedCategory | ResolvedPage | ResolvedPost>
  /** URL of the home page for the current locale. */
  homeUrl: string
  /** URL of the shop page for the current locale. */
  shopUrl: string
  /** URL of the privacy page for the current locale. */
  privacyUrl: string
  /** URL of the checkout page for the current locale. */
  checkoutUrl: string
  [key: string]: unknown
}

export type SitemapEntry = {
  url: string
  lastmod: string | null
  alternates: { locale: string; url: string }[]
}

export type Sitemap = {
  permalink: string
  entries: SitemapEntry[]
}

/**
 * Top-level cms global data shape.
 * - cms[locale]   → per-locale data for layout/component templates
 * - cms.products  → flat array (all locales) for Eleventy pagination templates
 */
export type CmsData = {
  products:   (ResolvedVariant  & { locale: string })[]
  categories: (ResolvedCategory & { locale: string })[]
  pages:      (ResolvedPage     & { locale: string })[]
  posts:      (ResolvedPost     & { locale: string })[]
  sitemaps:   Sitemap[]
  [locale: string]: CmsLocaleData | unknown
}
