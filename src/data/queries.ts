import type { Config } from '../types'

// ---------------------------------------------------------------------------
// Shared projections
// ---------------------------------------------------------------------------

const IMAGE_PROJECTION = `{
  "image": image[]{ _key, value{ ..., asset-> } },
  "alt": alt[]{ _key, value }
}`

const SEO_PROJECTION = `{
  "metaTitle": metaTitle[]{ _key, value },
  "metaDescription": metaDescription[]{ _key, value },
  "shareTitle": shareTitle[]{ _key, value },
  "shareDescription": shareDescription[]{ _key, value },
  "keywords": keywords[]{ _key, value },
  "shareImage": shareImage ${IMAGE_PROJECTION}
}`

const CATEGORY_PROJECTION = `{
  _id,
  "title": title[]{ _key, value },
  "slug": slug.current
}`

const MANUFACTURER_PROJECTION = `{
  _id,
  "name": name[]{ _key, value }
}`

// ---------------------------------------------------------------------------
// Module projections — core module types
// ---------------------------------------------------------------------------

const CORE_MODULE_PROJECTIONS: Record<string, string> = {
  hero:            `{ _type, "heading": heading[]{ _key, value }, "subheading": subheading[]{ _key, value }, image ${IMAGE_PROJECTION} }`,
  multiColumns:    `{ _type, "columns": columns[]{ "title": title[]{ _key, value }, "text": text[]{ _key, value }, image ${IMAGE_PROJECTION} } }`,
  productSection:  `{ _type, "title": title[]{ _key, value }, "products": products[]->{ _id, "title": title[]{ _key, value } } }`,
  categorySection: `{ _type, "title": title[]{ _key, value }, "categories": categories[]->{ _id, "title": title[]{ _key, value } } }`,
  carousel:        `{ _type, images[]${IMAGE_PROJECTION} }`,
  youtube:         `{ _type, url }`,
}

function buildModulesProjection(docType: string, extensions?: Config['extensions']): string {
  const modules = {
    ...CORE_MODULE_PROJECTIONS,
    ...(extensions?.modules?.[docType] ?? {}),
  }

  const conditions = Object.entries(modules)
    .map(([type, projection]) => `_type == '${type}' => ${projection}`)
    .join(',\n    ')

  return `modules[]{\n    _type,\n    ${conditions}\n  }`
}

function extraFields(type: string, extensions?: Config['extensions']): string {
  const extra = extensions?.fields?.[type]
  return extra ? `,\n  ${extra}` : ''
}

// ---------------------------------------------------------------------------
// Document queries
// ---------------------------------------------------------------------------

export function buildProductQuery(extensions?: Config['extensions']): string {
  return `*[_type == 'product']{
  _id,
  kind,
  "title": title[]{ _key, value },
  price,
  compareAtPrice,
  "image": image ${IMAGE_PROJECTION},
  "seo": seo ${SEO_PROJECTION},
  "categories": categories[]->${CATEGORY_PROJECTION},
  "manufacturers": manufacturers[]->${MANUFACTURER_PROJECTION},
  "taxCategory": taxCategory->{ _id }${extraFields('product', extensions)}
}`
}

export function buildVariantQuery(extensions?: Config['extensions']): string {
  return `*[_type == 'productVariant']{
  _id,
  status,
  "title": title[]{ _key, value },
  sku,
  kind,
  featured,
  price,
  compareAtPrice,
  "image": image ${IMAGE_PROJECTION},
  "seo": seo ${SEO_PROJECTION},
  stock,
  "categories": categories[]->${CATEGORY_PROJECTION},
  "manufacturers": manufacturers[]->${MANUFACTURER_PROJECTION},
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
  "title": title[]{ _key, value },
  "description": description[]{ _key, value },
  sortOrder,
  "parent": parent->{ _id },
  "image": image ${IMAGE_PROJECTION},
  "seo": seo ${SEO_PROJECTION}${extraFields('category', extensions)}
}`
}

export function buildPageQuery(extensions?: Config['extensions']): string {
  return `*[_type == 'page']{
  _id,
  "title": title[]{ _key, value },
  "slug": slug.current,
  ${buildModulesProjection('page', extensions)},
  "seo": seo ${SEO_PROJECTION}${extraFields('page', extensions)}
}`
}

export function buildPostQuery(extensions?: Config['extensions']): string {
  return `*[_type == 'post']{
  _id,
  "title": title[]{ _key, value },
  "slug": slug.current,
  publishedAt,
  "author": author->{ _id, "name": name[]{ _key, value }, image ${IMAGE_PROJECTION} },
  ${buildModulesProjection('post', extensions)},
  "seo": seo ${SEO_PROJECTION}${extraFields('post', extensions)}
}`
}

export function buildMenuQuery(extensions?: Config['extensions']): string {
  const menuItemFields = extraFields('menuItem', extensions)

  // menuItem is recursive — we handle two levels deep
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
  "siteName": siteName[]{ _key, value },
  "siteDescription": siteDescription[]{ _key, value },
  "logo": logo ${IMAGE_PROJECTION},
  "favicon": favicon ${IMAGE_PROJECTION}
}`
}
