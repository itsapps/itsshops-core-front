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
  sortOrder: number
  parentId: string | null
  image: ResolvedImage | null
  seo: ResolvedSeo
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
  homePageUrl: string | null
  homePageId: string | null
  privacyPage: string | null
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

export type ResolvedVariant = {
  _id: string
  _type: 'productVariant'
  _updatedAt: string | null
  slug: string
  url: string
  status: 'active' | 'comingSoon' | 'soldOut' | 'archived'
  title: string
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
  siblings: Array<{ _id: string; title: string; url: string; status: string }>
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
  publishedAt: string | null
  modules: unknown[]
  seo: ResolvedSeo
  [key: string]: unknown
}

/** The full cms global data object exposed to Eleventy templates */
export type CmsLocaleData = {
  products: ResolvedVariant[]
  categories: ResolvedCategory[]
  pages: ResolvedPage[]
  posts: ResolvedPost[]
  menus: ResolvedMenu[]
  settings: ResolvedSettings | null
  shopSettings: ResolvedShopSettings | null
  /** Sanity _id → resolved URL for the current locale. Used by portableTextToHTML for internal links. */
  urlMap: Record<string, string>
  /** Sanity _id → resolved document (variant, category, page, or post) for the current locale. */
  docMap: Record<string, ResolvedVariant | ResolvedCategory | ResolvedPage | ResolvedPost>
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
