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
  hero: `{
    _type,
    ${proj.i18nStringField('title')},
    ${proj.i18nImageField('bgImage')}
  }`,
  multiColumns: `{
    _type,
    "columns": columns[]{
      ${proj.i18nStringField('title')},
      ${proj.i18nStringField('text')},
      ${proj.i18nImageField('image')}
    }
  }`,
  productSection: `{
    _type,
    ${proj.i18nStringField('title')},
    "products": products[]->{ _id }
  }`,
  categorySection: `{
    _type,
    ${proj.i18nStringField('title')},
    "categories": categories[]->{ _id }
  }`,
  carousel: `{
    _type,
    autoplay,
    autoplayDelay,
    loop,
    fade,
    "slides": slides[]{${proj.i18nAltImage}}
  }`,
  youtube: `{ _type, url }`,
}

// ---------------------------------------------------------------------------
// Document queries
// ---------------------------------------------------------------------------

export function buildProductQuery(extensions?: Config['extensions']): string {
  return `*[_type == 'product']{
  _id,
  kind,
  title[]{ _key, value },
  price,
  compareAtPrice,
  ${proj.i18nImageField('image')},
  seo ${proj.seo},
  "categories": categories[]->${proj.category},
  "manufacturers": manufacturers[]->${proj.manufacturer},
  "taxCategory": taxCategory->{ _id }${extraFields('product', extensions)}
}`
}

export function buildVariantQuery(extensions?: Config['extensions']): string {
  return `*[_type == 'productVariant']{
  _id,
  status,
  title[]{ _key, value },
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
  "options": options[]->{ _id, "name": name[]{ _key, value } },
  "bundleItems": bundleItems[]{ quantity, "variant": product->{ _id, "title": title[]{ _key, value } } },
  "productId": product._ref${extraFields('variant', extensions)}
}`
}

export function buildCategoryQuery(extensions?: Config['extensions']): string {
  return `*[_type == 'category'] | order(sortOrder asc){
  _id,
  title[]{ _key, value },
  description[]{ _key, value },
  sortOrder,
  "parent": parent->{ _id },
  ${proj.i18nImageField('image')},
  seo ${proj.seo}${extraFields('category', extensions)}
}`
}

export function buildPageQuery(extensions?: Config['extensions']): string {
  return `*[_type == 'page']{
  _id,
  title[]{ _key, value },
  "slug": slug.current,
  ${buildModulesProjection('page', extensions)},
  seo ${proj.seo}${extraFields('page', extensions)}
}`
}

export function buildPostQuery(extensions?: Config['extensions']): string {
  return `*[_type == 'post']{
  _id,
  title[]{ _key, value },
  "slug": slug.current,
  publishedAt,
  author->{ _id, "name": name[]{ _key, value }, "image": image ${proj.i18nAltImage} },
  ${buildModulesProjection('post', extensions)},
  seo ${proj.seo}${extraFields('post', extensions)}
}`
}

export function buildMenuQuery(extensions?: Config['extensions']): string {
  const menuItemFields = extraFields('menuItem', extensions)
  const menuItemProjection = `{
    _key,
    "title": title[]{ _key, value },
    linkType,
    "url": url[]{ _key, value },
    "internal": internal->{ _id, _type, "slug": slug.current }${menuItemFields},
    "children": children[]{
      _key,
      "title": title[]{ _key, value },
      linkType,
      "url": url[]{ _key, value },
      "internal": internal->{ _id, _type, "slug": slug.current }${menuItemFields}
    }
  }`
  return `*[_type == 'menu']{
  _id,
  "title": title[]{ _key, value },
  "items": items[]${menuItemProjection}
}`
}

export function buildSettingsQuery(): string {
  return `*[_type == 'generalSettings'][0]{
  _id,
  "siteTitle": siteTitle[]{ _key, value },
  "siteShortDescription": siteShortDescription[]{ _key, value },
  ${proj.i18nImageField('logo')},
  ${proj.i18nImageField('favicon')},
  "homePage": homePage->{ _id },
  "privacyPage": privacyPage->{ _id },
  "mainMenus": mainMenus[]{ _ref },
  "footerMenus": footerMenus[]{ _ref },
  gtmId
}`
}
