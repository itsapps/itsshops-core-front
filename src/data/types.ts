import type { SanityImageHotspot, SanityImageCrop, Wine } from '../types/sanity'

/**
 * Resolved types — all localized fields are plain strings, ready for templates.
 * These are what the cms global data exposes to Nunjucks.
 */

export type ResolvedImage = {
  asset: { _ref: string }
  alt: string
  hotspot?: SanityImageHotspot
  crop?: SanityImageCrop
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

export type ResolvedSettings = {
  _id: string
  siteTitle: string
  siteShortDescription: string
  homePage: string | null
  privacyPage: string | null
  mainMenus: string[]
  footerMenus: string[]
  gtmId: string | null
}

export type ResolvedVariant = {
  _id: string
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
  wine: Wine | null
  options: ResolvedOption[]
  bundleItems: ResolvedBundleItem[]
  product: { _id: string; title: string }
  siblings: Array<{ _id: string; title: string; url: string; status: string }>
  // extended fields land here at runtime (e.g. isLimited from customer extensions)
  [key: string]: unknown
}

export type ResolvedPage = {
  _id: string
  title: string
  slug: string
  url: string
  modules: unknown[]
  seo: ResolvedSeo
  [key: string]: unknown
}

export type ResolvedPost = {
  _id: string
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
  [key: string]: unknown
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
  [locale: string]: CmsLocaleData | unknown
}
