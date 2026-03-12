/**
 * Core Sanity schema types for itsshops-core-front.
 * Copied from itsshops-core-back and trimmed to frontend-relevant types only.
 * Backend-only types (orders, customers, shipping, payments) are excluded.
 *
 * Re-generate from: itsshops-core-back/src/types/sanity.types.ts
 */

// ---------------------------------------------------------------------------
// Internalization
// ---------------------------------------------------------------------------

export type InternationalizedArrayStringValue = {
  _type: 'internationalizedArrayStringValue'
  value?: string
}

export type InternationalizedArrayString = Array<
  { _key: string } & InternationalizedArrayStringValue
>

export type InternationalizedArrayTextValue = {
  _type: 'internationalizedArrayTextValue'
  value?: string
}

export type InternationalizedArrayText = Array<
  { _key: string } & InternationalizedArrayTextValue
>

export type InternationalizedArrayUrlValue = {
  _type: 'internationalizedArrayUrlValue'
  value?: string
}

export type InternationalizedArrayUrl = Array<
  { _key: string } & InternationalizedArrayUrlValue
>

export type InternationalizedArraySlugValue = {
  _type: 'internationalizedArraySlugValue'
  value?: Slug
}

export type InternationalizedArraySlug = Array<
  { _key: string } & InternationalizedArraySlugValue
>

export type InternationalizedArrayCropImageValue = {
  _type: 'internationalizedArrayCropImageValue'
  value?: CropImage
}

export type InternationalizedArrayCropImage = Array<
  { _key: string } & InternationalizedArrayCropImageValue
>

export type InternationalizedArrayBaseImageValue = {
  _type: 'internationalizedArrayBaseImageValue'
  value?: BaseImage
}

export type InternationalizedArrayBaseImage = Array<
  { _key: string } & InternationalizedArrayBaseImageValue
>

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

export type SanityImageCrop = {
  _type: 'sanity.imageCrop'
  top?: number
  bottom?: number
  left?: number
  right?: number
}

export type SanityImageHotspot = {
  _type: 'sanity.imageHotspot'
  x?: number
  y?: number
  height?: number
  width?: number
}

export type SanityImageAssetReference = {
  _ref: string
  _type: 'reference'
  _weak?: boolean
  [internalGroqTypeReferenceTo]?: 'sanity.imageAsset'
}

export type SanityImagePaletteSwatch = {
  _type: 'sanity.imagePaletteSwatch'
  background?: string
  foreground?: string
  population?: number
  title?: string
}

export type SanityImagePalette = {
  _type: 'sanity.imagePalette'
  darkMuted?: SanityImagePaletteSwatch
  lightVibrant?: SanityImagePaletteSwatch
  darkVibrant?: SanityImagePaletteSwatch
  vibrant?: SanityImagePaletteSwatch
  dominant?: SanityImagePaletteSwatch
  lightMuted?: SanityImagePaletteSwatch
  muted?: SanityImagePaletteSwatch
}

export type SanityImageDimensions = {
  _type: 'sanity.imageDimensions'
  height?: number
  width?: number
  aspectRatio?: number
}

export type SanityImageMetadata = {
  _type: 'sanity.imageMetadata'
  location?: Geopoint
  dimensions?: SanityImageDimensions
  palette?: SanityImagePalette
  lqip?: string
  blurHash?: string
  thumbHash?: string
  hasAlpha?: boolean
  isOpaque?: boolean
}

export type SanityImageAsset = {
  _id: string
  _type: 'sanity.imageAsset'
  _createdAt: string
  _updatedAt: string
  _rev: string
  originalFilename?: string
  label?: string
  title?: string
  description?: string
  altText?: string
  sha1hash?: string
  extension?: string
  mimeType?: string
  size?: number
  assetId?: string
  uploadId?: string
  path?: string
  url?: string
  metadata?: SanityImageMetadata
  source?: SanityAssetSourceData
}

export type SanityAssetSourceData = {
  _type: 'sanity.assetSourceData'
  name?: string
  id?: string
  url?: string
}

export type SanityFileAsset = {
  _id: string
  _type: 'sanity.fileAsset'
  _createdAt: string
  _updatedAt: string
  _rev: string
  originalFilename?: string
  label?: string
  title?: string
  description?: string
  altText?: string
  sha1hash?: string
  extension?: string
  mimeType?: string
  size?: number
  assetId?: string
  uploadId?: string
  path?: string
  url?: string
  source?: SanityAssetSourceData
}

export type CropImage = {
  _type: 'cropImage'
  asset?: SanityImageAssetReference
  media?: unknown
  hotspot?: SanityImageHotspot
  crop?: SanityImageCrop
}

export type BaseImage = {
  _type: 'baseImage'
  asset?: SanityImageAssetReference
  media?: unknown
  hotspot?: SanityImageHotspot
  crop?: SanityImageCrop
  alt?: string
}

export type LocaleImage = {
  _type: 'localeImage'
  image?: InternationalizedArrayCropImage
  alt?: InternationalizedArrayString
}

export type LocaleAltImage = {
  _type: 'localeAltImage'
  asset?: SanityImageAssetReference
  media?: unknown
  hotspot?: SanityImageHotspot
  crop?: SanityImageCrop
  alt?: InternationalizedArrayString
}

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export type Slug = {
  _type: 'slug'
  current?: string
  source?: string
}

export type Geopoint = {
  _type: 'geopoint'
  lat?: number
  lng?: number
  alt?: number
}

export type MediaTag = {
  _id: string
  _type: 'media.tag'
  _createdAt: string
  _updatedAt: string
  _rev: string
  name?: Slug
}

// ---------------------------------------------------------------------------
// References
// ---------------------------------------------------------------------------

export type ProductReference = {
  _ref: string
  _type: 'reference'
  _weak?: boolean
  [internalGroqTypeReferenceTo]?: 'product'
}

export type ProductVariantReference = {
  _ref: string
  _type: 'reference'
  _weak?: boolean
  [internalGroqTypeReferenceTo]?: 'productVariant'
}

export type CategoryReference = {
  _ref: string
  _type: 'reference'
  _weak?: boolean
  [internalGroqTypeReferenceTo]?: 'category'
}

export type ManufacturerReference = {
  _ref: string
  _type: 'reference'
  _weak?: boolean
  [internalGroqTypeReferenceTo]?: 'manufacturer'
}

export type TaxCategoryReference = {
  _ref: string
  _type: 'reference'
  _weak?: boolean
  [internalGroqTypeReferenceTo]?: 'taxCategory'
}

export type VariantOptionReference = {
  _ref: string
  _type: 'reference'
  _weak?: boolean
  [internalGroqTypeReferenceTo]?: 'variantOption'
}

export type VariantOptionGroupReference = {
  _ref: string
  _type: 'reference'
  _weak?: boolean
  [internalGroqTypeReferenceTo]?: 'variantOptionGroup'
}

export type PageReference = {
  _ref: string
  _type: 'reference'
  _weak?: boolean
  [internalGroqTypeReferenceTo]?: 'page'
}

export type PostReference = {
  _ref: string
  _type: 'reference'
  _weak?: boolean
  [internalGroqTypeReferenceTo]?: 'post'
}

export type BlogReference = {
  _ref: string
  _type: 'reference'
  _weak?: boolean
  [internalGroqTypeReferenceTo]?: 'blog'
}

export type MenuReference = {
  _ref: string
  _type: 'reference'
  _weak?: boolean
  [internalGroqTypeReferenceTo]?: 'menu'
}

// ---------------------------------------------------------------------------
// SEO
// ---------------------------------------------------------------------------

export type Seo = {
  _type: 'seo'
  metaTitle?: InternationalizedArrayString
  metaDescription?: InternationalizedArrayString
  shareTitle?: InternationalizedArrayString
  shareDescription?: InternationalizedArrayString
  shareImage?: LocaleImage
  keywords?: InternationalizedArrayString
}

// ---------------------------------------------------------------------------
// Portable text / rich text
// ---------------------------------------------------------------------------

export type PortableText = Array<
  | {
      children?: Array<{
        marks?: Array<string>
        text?: string
        _type: 'span'
        _key: string
      }>
      style?: 'normal' | 'h2' | 'h3'
      listItem?: 'bullet' | 'number'
      markDefs?: Array<{
        internalLinkReference?:
          | ProductVariantReference
          | PageReference
          | PostReference
          | CategoryReference
          | BlogReference
        internalLinkDisplayType?: 'link' | 'button' | 'ghost'
        _type: 'internalLink'
        _key: string
      }>
      level?: number
      _type: 'block'
      _key: string
    }
  | {
      asset?: SanityImageAssetReference
      media?: unknown
      hotspot?: SanityImageHotspot
      crop?: SanityImageCrop
      _type: 'image'
      _key: string
    }
>

export type TextBlock = {
  _type: 'textBlock'
  content?: PortableText
}

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

export type Hero = {
  _type: 'hero'
  title?: InternationalizedArrayString
  bgImage?: LocaleImage
  actions?: Array<{
    internalLinkTitle?: InternationalizedArrayString
    internalLinkReference?:
      | ProductVariantReference
      | PageReference
      | PostReference
      | CategoryReference
      | BlogReference
    internalLinkDisplayType?: 'link' | 'button' | 'ghost'
    _type: 'action'
    _key: string
  }>
}

export type Carousel = {
  _type: 'carousel'
  slides?: Array<{ _key: string } & LocaleAltImage>
  autoplay?: boolean
  autoplayDelay?: number
  loop?: boolean
  fade?: boolean
}

export type Youtube = {
  _type: 'youtube'
  url?: string
  showControls?: boolean
  autoload?: boolean
  autopause?: boolean
  start?: string
}

// ---------------------------------------------------------------------------
// Product-specific
// ---------------------------------------------------------------------------

export type Wine = {
  _type: 'wine'
  vinofactWineId?: string
  volume?:
    | 100 | 187 | 200 | 250 | 375 | 500 | 750
    | 1000 | 1500 | 2250 | 3000 | 4500 | 5000
    | 6000 | 9000 | 12000 | 15000
  vintage?: string
}

export type BundleItem = {
  _type: 'bundleItem'
  quantity?: number
  product?: ProductVariantReference
}

export type VariantOption = {
  _id: string
  _type: 'variantOption'
  _createdAt: string
  _updatedAt: string
  _rev: string
  title?: InternationalizedArrayString
  group?: VariantOptionGroupReference
  sortOrder?: number
}

export type VariantOptionGroup = {
  _id: string
  _type: 'variantOptionGroup'
  _createdAt: string
  _updatedAt: string
  _rev: string
  title?: InternationalizedArrayString
  sortOrder?: number
}

export type TaxCategory = {
  _id: string
  _type: 'taxCategory'
  _createdAt: string
  _updatedAt: string
  _rev: string
  title?: InternationalizedArrayString
  code?: Slug
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export type Product = {
  _id: string
  _type: 'product'
  _createdAt: string
  _updatedAt: string
  _rev: string
  title?: InternationalizedArrayString
  kind?: 'wine' | 'physical' | 'digital' | 'bundle'
  weight?: number
  categories?: Array<{ _key: string } & CategoryReference>
  manufacturers?: Array<{ _key: string } & ManufacturerReference>
  taxCategory?: TaxCategoryReference
  price?: number
  compareAtPrice?: number
  image?: LocaleImage
  seo?: Seo
}

export type ProductVariant = {
  _id: string
  _type: 'productVariant'
  _createdAt: string
  _updatedAt: string
  _rev: string
  status?: 'active' | 'comingSoon' | 'soldOut' | 'archived'
  title?: InternationalizedArrayString
  product?: ProductReference
  sku?: string
  kind?: 'wine' | 'physical' | 'digital' | 'bundle'
  featured?: boolean
  categories?: Array<{ _key: string } & CategoryReference>
  manufacturers?: Array<{ _key: string } & ManufacturerReference>
  taxCategory?: TaxCategoryReference
  price?: number
  compareAtPrice?: number
  image?: LocaleImage
  seo?: Seo
  stock?: number
  stockThreshold?: number
  wine?: Wine
  options?: Array<{ _key: string } & VariantOptionReference>
  weight?: number
  bundleItems?: Array<{ _key: string } & BundleItem>
}

export type Manufacturer = {
  _id: string
  _type: 'manufacturer'
  _createdAt: string
  _updatedAt: string
  _rev: string
  title?: InternationalizedArrayString
  description?: InternationalizedArrayText
  link?: string
  image?: LocaleImage
}

export type Category = {
  _id: string
  _type: 'category'
  _createdAt: string
  _updatedAt: string
  _rev: string
  title?: InternationalizedArrayString
  description?: InternationalizedArrayString
  level?: number
  sortOrder?: number
  parent?: CategoryReference
  image?: LocaleImage
  seo?: Seo
}

export type Page = {
  _id: string
  _type: 'page'
  _createdAt: string
  _updatedAt: string
  _rev: string
  title?: InternationalizedArrayString
  slug?: InternationalizedArraySlug
  seo?: Seo
}

export type Post = {
  _id: string
  _type: 'post'
  _createdAt: string
  _updatedAt: string
  _rev: string
  title?: InternationalizedArrayString
}

export type Blog = {
  _id: string
  _type: 'blog'
  _createdAt: string
  _updatedAt: string
  _rev: string
  title?: InternationalizedArrayString
  description?: InternationalizedArrayString
  seo?: Seo
  postsPerPage?: number
}

export type MenuItem = {
  _type: 'menuItem'
  title?: InternationalizedArrayString
  linkType?: 'internal' | 'external' | 'submenu'
  internalLinkReference?:
    | ProductVariantReference
    | PageReference
    | PostReference
    | CategoryReference
    | BlogReference
  url?: InternationalizedArrayUrl
  children?: Array<{ _key: string } & MenuItem>
}

export type Menu = {
  _id: string
  _type: 'menu'
  _createdAt: string
  _updatedAt: string
  _rev: string
  title?: InternationalizedArrayString
  items?: Array<{ _key: string } & MenuItem>
}

export type Address = {
  _type: 'address'
  prename?: string
  lastname?: string
  phone?: string
  line1?: string
  line2?: string
  zip?: string
  city?: InternationalizedArrayString
  country?: string
  state?: string
}

export type Company = {
  _type: 'company'
  name?: InternationalizedArrayString
  owner?: string
  address?: Address
}

export type Settings = {
  _id: string
  _type: 'settings'
  _createdAt: string
  _updatedAt: string
  _rev: string
  siteTitle?: InternationalizedArrayString
  siteShortDescription?: InternationalizedArrayString
  siteDescription?: InternationalizedArrayText
  homePage?: PageReference
  privacyPage?: PageReference
  mainMenus?: Array<{ _key: string } & MenuReference>
  footerMenus?: Array<{ _key: string } & MenuReference>
  gtmId?: string
  company?: Company
}

export declare const internalGroqTypeReferenceTo: unique symbol
