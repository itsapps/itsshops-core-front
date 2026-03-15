/**
 * Exported GROQ projection fragments — use in extensions.fields / extensions.modules.
 *
 * @example
 * import { projections } from '@itsapps/itsshops-core-front'
 *
 * extensions: {
 *   fields: {
 *     variant: `"cover": cover ${projections.localeAltImage}`,
 *   }
 * }
 */

/** localeImage: { image: i18nCropImage[], alt: i18nString[] } */
export const asset = `
  _id,
  url,
  "dimensions": metadata.dimensions {width, height, aspectRatio}
`

export const imageAssetField = `asset->{${asset}}`

export const cropHotspotImage = `
  _type,
  ${imageAssetField},
  crop,
  hotspot
`

export const i18nStringField = (fieldName: string) => `${fieldName}[]{ _key, value }`
export const i18nObjectField = (fieldName: string, subquery: string) => `${fieldName}[]{ _key, value {${subquery}} }`

export const i18nImage = `
  ${i18nObjectField('image', cropHotspotImage)},
  ${i18nStringField('alt')}
`
export const i18nImageField = (fieldName: string) => `${fieldName} {${i18nImage}}`

export const i18nAltImage = `
  ${cropHotspotImage},
  ${i18nStringField('alt')}
`
export const i18nAltImageField = (fieldName: string) => `${fieldName} {${i18nAltImage}}`

/** baseImage: Sanity base image with plain string alt */
export const baseImage = `{ asset->, crop, hotspot, alt }`

export const seo = `{
  ${i18nStringField('metaTitle')},
  ${i18nStringField('metaDescription')},
  ${i18nStringField('shareTitle')},
  ${i18nStringField('shareDescription')},
  ${i18nStringField('keywords')},
  ${i18nImageField('shareImage')}
}`

export const category = `{
  _id,
  ${i18nStringField('title')},
  "slug": slug.current
}`

export const manufacturer = `{
  _id,
  ${i18nStringField('name')},
}`

/**
 * i18nStandardContent / portable text array with mark definitions and internal link refs.
 * Usage: "text": text ${projections.portableText}
 */
export const portableText = `[]{
  _key,
  value[]{
    ...,
    markDefs[]{
      ...,
      _type == "internalLink" => {
        "reference": reference->{ _id, "slug": slug.current }
      }
    }
  }
}`

export const modules = `
  _type == 'hero' => {
    _key,${cropHotspotImage}
  }
`;