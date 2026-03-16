/**
 * GROQ projection fragments for use in extensions.fields / extensions.modules
 * and as building blocks inside queries.ts.
 *
 * Naming convention:
 *   - Raw string (embeddable fragment):  camelCase noun  e.g. `seo`, `i18nAltImage`
 *   - Field helper (includes field name): camelCase + Field  e.g. `i18nStringField('title')`
 */

// ---------------------------------------------------------------------------
// Asset
// ---------------------------------------------------------------------------

export const asset = `_id, url, "dimensions": metadata.dimensions { width, height, aspectRatio }`

export const imageAssetField = `asset->{ ${asset} }`

// ---------------------------------------------------------------------------
// Image variants
// ---------------------------------------------------------------------------

/** cropHotspotImage — plain Sanity image with crop + hotspot */
export const cropHotspotImage = `{ _type, ${imageAssetField}, crop, hotspot }`

/**
 * localeImage — { image: i18nCropImage[], alt: i18nString[] }
 * Used on product/category images where both image and alt text are localized.
 */
export const i18nImage = `{
  "image": image[]{ _key, value { _type, ${imageAssetField}, crop, hotspot } },
  "alt": alt[]{ _key, value }
}`

export const i18nImageField = (fieldName: string) => `${fieldName} ${i18nImage}`

/**
 * localeAltImage — Sanity image with hotspot + i18nString alt.
 * Used in carousels and wherever a single image has per-locale alt text.
 */
export const i18nAltImage = `{ ${imageAssetField}, crop, hotspot, "alt": alt[]{ _key, value } }`

export const i18nAltImageField = (fieldName: string) => `${fieldName} ${i18nAltImage}`

/** baseImage — plain Sanity image with plain string alt */
export const baseImage = `{ ${imageAssetField}, crop, hotspot, alt }`

export const baseImageField = (fieldName: string) => `${fieldName} ${baseImage}`

// ---------------------------------------------------------------------------
// Localized fields
// ---------------------------------------------------------------------------

export const i18nStringField = (fieldName: string) => `${fieldName}[]{ _key, value }`

export const i18nObjectField = (fieldName: string, subquery: string) =>
  `${fieldName}[]{ _key, value { ${subquery} } }`

// ---------------------------------------------------------------------------
// Portable text
// ---------------------------------------------------------------------------

/**
 * The internalLink annotation mark — resolves internalLinkReference to id/type/slug.
 * Embedded inside markDefs projections.
 */
const internalLinkMark = `_type == "internalLink" => {
    "reference": internalLinkReference->{ _id, _type, "slug": slug.current },
    "displayType": internalLinkDisplayType
  }`

/**
 * portableTextBlocks — plain portableText[] array.
 * Use for non-localized rich text fields.
 */
export const portableTextBlocks = `[]{
  ...,
  markDefs[]{
    ...,
    ${internalLinkMark}
  }
}`

export const portableTextField = (fieldName: string) => `${fieldName} ${portableTextBlocks}`

/**
 * i18nPortableText — localized rich text stored as i18nText (array of { _key: locale, value: blocks[] }).
 * Use for fields of type i18nText / i18nStandardContent.
 */
export const i18nPortableText = `[]{
  _key,
  value[]{
    ...,
    markDefs[]{
      ...,
      ${internalLinkMark}
    }
  }
}`

export const i18nTextField = (fieldName: string) => `${fieldName} ${i18nPortableText}`

/**
 * i18nStandardContent — localized rich text stored as i18nStandardContent
 * (value is a standardContent object wrapping a content[] array).
 * Flattens to [{ _key, value: blocks[] }] so resolvePortableText handles it directly.
 */
export const i18nStandardContentField = (fieldName: string) =>
  `${fieldName}[]{ _key, "value": value.content ${portableTextBlocks} }`

// ---------------------------------------------------------------------------
// SEO
// ---------------------------------------------------------------------------

export const seo = `{
  ${i18nStringField('metaTitle')},
  ${i18nStringField('metaDescription')},
  ${i18nStringField('shareTitle')},
  ${i18nStringField('shareDescription')},
  ${i18nStringField('keywords')},
  ${i18nImageField('shareImage')}
}`

// ---------------------------------------------------------------------------
// Actions (hero CTAs, internalLinkFields with title + displayType)
// ---------------------------------------------------------------------------

/**
 * action — single CTA action object built with builders.internalLinkFields({ includeTitle, includeDisplayType }).
 * Fields: internalLinkTitle (i18n), internalLinkReference (ref), internalLinkDisplayType (string).
 */
export const action = `{
  ${i18nStringField('internalLinkTitle')},
  "reference": internalLinkReference->{ _id, _type, "slug": slug.current },
  "displayType": internalLinkDisplayType
}`

export const actionsField = (fieldName = 'actions') => `"${fieldName}": ${fieldName}[] ${action}`

// ---------------------------------------------------------------------------
// Shared document fragments
// ---------------------------------------------------------------------------

export const category = `{
  _id,
  ${i18nStringField('title')},
  "slug": slug.current
}`

export const manufacturer = `{
  _id,
  ${i18nStringField('name')}
}`
