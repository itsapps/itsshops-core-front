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
export const localeImage = `{
  "image": image[]{ _key, value{ ..., asset-> } },
  "alt": alt[]{ _key, value }
}`

/** localeAltImage: Sanity base image with localized alt text */
export const localeAltImage = `{ ..., asset->, "alt": alt[]{ _key, value } }`

/** baseImage: Sanity base image with plain string alt */
export const baseImage = `{ asset->, crop, hotspot, alt }`

export const seo = `{
  "metaTitle": metaTitle[]{ _key, value },
  "metaDescription": metaDescription[]{ _key, value },
  "shareTitle": shareTitle[]{ _key, value },
  "shareDescription": shareDescription[]{ _key, value },
  "keywords": keywords[]{ _key, value },
  "shareImage": shareImage ${localeImage}
}`

export const category = `{
  _id,
  "title": title[]{ _key, value },
  "slug": slug.current
}`

export const manufacturer = `{
  _id,
  "name": name[]{ _key, value }
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
