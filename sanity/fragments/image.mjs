/**
 * @typedef {Object} Asset
 * @property {string} _id
 * @property {string} url
 * @property {width: number, height: number, aspectRatio: number} dimensions
 */

/**
 * @typedef {Object} Image
 * @property {string} _type
 * @property {string} alt
 * @property {Asset} asset
 * @property {Object} crop
 * @property {Object} hotspot
 */
export function image() {
  return `
    _type,
    "alt": asset->altText,
    "asset": asset->{_id, url, "dimensions": metadata.dimensions {width, height, aspectRatio}},
    crop,
    hotspot
  `;
}

/**
 * @typedef {Object} LocaleImage
 * @property {string} _type
 * @property {LocaleString} title
 * @property {LocaleString} alt
 * @property {Asset} asset
 * @property {Object} crop
 * @property {Object} hotspot
 */
export function localeImage() {
  return `
    _type,
    title,
    alt,
    "asset": asset->{url, _id, "dimensions": metadata.dimensions {width, height, aspectRatio}},
    crop,
    hotspot
  `;
}

/**
 * @typedef {Object} CustomImage
 * @property {string} _type
 * @property {string} title
 * @property {string} alt
 * @property {Asset} asset
 * @property {Object} crop
 * @property {Object} hotspot
 */
export function customImage() {
  return `
    _type,
    title,
    "alt": coalesce(alt, asset->altText),
    "asset": asset->{url, _id, "dimensions": metadata.dimensions {width, height, aspectRatio}},
    crop,
    hotspot
  `;
}