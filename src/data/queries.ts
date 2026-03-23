import type { Config } from '../types'
import * as proj from './projections'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export function extraFields(type: string, extensions?: Config['extensions']): string {
  const extra = extensions?.fields?.[type]
  return extra ? `,\n  ${extra}` : ''
}

export function buildModulesProjection(docType: string, extensions?: Config['extensions']): string {
  const modules = {
    ...CORE_MODULE_PROJECTIONS,
    ...(extensions?.modules?.[docType] ?? {}),
  }
  const conditions = Object.entries(modules)
    .map(([type, projection]) => `_type == '${type}' => ${projection}`)
    .join(',\n    ')
  return `modules[]{\n    _type,\n    ${conditions}\n  }`
}

// ---------------------------------------------------------------------------
// Core module projections
// ---------------------------------------------------------------------------

export const CORE_MODULE_PROJECTIONS: Record<string, string> = {
  productGrid: `{
    _type,
    ${proj.i18nStringField('title')},
    ${proj.refsField('products')}
  }`,
  categoryGrid: `{
    _type,
    ${proj.i18nStringField('title')},
    ${proj.refsField('categories')}
  }`,
  carousel: `{
    _type,
    autoplay,
    autoplayDelay,
    loop,
    fade,
    "slides": slides[]${proj.i18nAltImage}
  }`,
  youtube: `{ _type, url, showControls, autoload, autopause, start }`,
}

// ---------------------------------------------------------------------------
// Document queries
// ---------------------------------------------------------------------------

export function idFilter(id: string | undefined): string {
  return id ? ` && _id == "${id}"` : ''
}

export function buildProductQuery(extensions?: Config['extensions'], documentId?: string): string {
  return `*[_type == 'product'${idFilter(documentId)}]{
  _id,
  kind,
  ${proj.i18nStringField('title')},
  price,
  compareAtPrice,
  ${proj.i18nImageField('image')},
  seo ${proj.seo},
  "categories": categories[]->${proj.category},
  "manufacturers": manufacturers[]->${proj.manufacturer},
  "taxCategory": taxCategory->{ _id }${extraFields('product', extensions)}
}`
}

export function buildVariantQuery(extensions?: Config['extensions'], documentId?: string): string {
  return `*[_type == 'productVariant'${idFilter(documentId)}]{
  _id,
  _type,
  _updatedAt,
  status,
  ${proj.i18nStringField('title')},
  sku,
  kind,
  featured,
  price,
  compareAtPrice,
  ${proj.i18nImageField('image')},
  seo ${proj.seo},
  stock,
  "categories": categories[]->${proj.category},
  "manufacturers": manufacturers[]->${proj.manufacturer},
  "taxCategory": taxCategory->{ _id },
  wine,
  "options": options[]->{ _id, "name": title[]{ _key, value } },
  "bundleItems": bundleItems[]{ quantity, "variantId": product._ref },
  "productId": product._ref${extraFields('variant', extensions)}
}`
}

export function buildCategoryQuery(extensions?: Config['extensions'], documentId?: string): string {
  return `*[_type == 'category'${idFilter(documentId)}] | order(sortOrder asc){
  _id,
  _type,
  _updatedAt,
  ${proj.i18nStringField('title')},
  ${proj.i18nStringField('description')},
  sortOrder,
  "parent": parent->{ _id },
  ${proj.i18nImageField('image')},
  seo ${proj.seo}${extraFields('category', extensions)}
}`
}

export function buildPageQuery(extensions?: Config['extensions'], documentId?: string): string {
  return `*[_type == 'page'${idFilter(documentId)}]{
  _id,
  _type,
  _updatedAt,
  ${proj.i18nStringField('title')},
  "slug": slug.current,
  ${buildModulesProjection('page', extensions)},
  seo ${proj.seo}${extraFields('page', extensions)}
}`
}

export function buildPostQuery(extensions?: Config['extensions'], documentId?: string): string {
  return `*[_type == 'post'${idFilter(documentId)}]{
  _id,
  _type,
  _updatedAt,
  ${proj.i18nStringField('title')},
  "slug": slug.current,
  publishedAt,
  ${buildModulesProjection('post', extensions)},
  seo ${proj.seo}${extraFields('post', extensions)}
}`
}

function buildMenuItemProjection(depth: number, extraFields: string): string {
  const children = depth > 0
    ? `,\n    "children": children[]${buildMenuItemProjection(depth - 1, extraFields)}`
    : ''
  return `{
    _key,
    ${proj.i18nStringField('title')},
    linkType,
    "url": url[]{ _key, value },
    "internal": internalLinkReference->{ _id, _type, "slug": slug.current }${extraFields}${children}
  }`
}

export function buildMenuQuery(extensions?: Config['extensions'], maxDepth = 1): string {
  const itemProjection = buildMenuItemProjection(maxDepth, extraFields('menuItem', extensions))
  return `*[_type == 'menu']{
  _id,
  "title": title[]{ _key, value },
  "items": items[]${itemProjection}
}`
}

export function buildSettingsQuery(extensions: Record<string, string> = {}): string {
  const companyFields = extensions.company ? `,\n    ${extensions.company}` : ''
  return `*[_type == 'settings'][0]{
  _id,
  ${proj.i18nStringField('siteTitle')},
  ${proj.i18nStringField('siteShortDescription')},
  "defaultShareImage": defaultShareImage ${proj.baseImage},
  "homePage": homePage->{ _id },
  "privacyPage": privacyPage->{ _id },
  "mainMenus": mainMenus[]{ _ref },
  "footerMenus": footerMenus[]{ _ref },
  gtmId,
  "company": company {
    ${proj.i18nStringField('name')},
    owner,
    email,
    phone,
    vatId,
    "address": address { line1, line2, zip, ${proj.i18nStringField('city')}, country }${companyFields}
  }
}`
}

export function buildShopSettingsQuery(): string {
  return `*[_type == 'shopSettings'][0]{
  _id,
  "shopPage": shopPage->{ _id },
  "defaultCountry": defaultCountry->{ _id, countryCode },
  freeShippingCalculation,
  stockThreshold,
  "defaultTaxCategory": defaultTaxCategory->{ _id, ${proj.i18nStringField('title')}, "code": code.current },
  orderNumberPrefix,
  invoiceNumberPrefix,
  billingAddress { line1, line2, zip, ${proj.i18nStringField('city')}, country },
  bankAccount { name, bic, iban }
}`
}
