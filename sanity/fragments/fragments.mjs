/**
 * Build a localized GROQ fragment from a block.
 * @param {string[]} locales - array of locales, e.g. ['de','en']
 * @param {string} blockFragment - GROQ block, e.g. complexPortableText
 * @returns {string} localized fragment
 */
export const makeLocalizedFragment = (locales, blockFragment) => {
  return locales.map(l => `${l}[]{${blockFragment}}`).join(',');
};
/**
 * @typedef {Object.<string, string>} LocaleString
 */

/**
 * @typedef {Object.<string, string>} LocaleBlock
 */




const seo = `
  metaTitle,
  metaDescription,
  shareTitle,
  shareDescription,
  "shareImage": shareImage[defined(asset)] {${imageQuery}},
  keywords
`

export const blocks = `
  _type == 'freeform' => {
    _type,
    _key,
    content,
    textAlign,
    maxWidth
  }
`

const internalLink = `
  _key,
  _type,
  reference->{_id, _type, title},
  displayType
`

const youtube = `
  _type,
  url,
  start,
  showControls,
  autopause,
  autoload
`;

const complexPortableText = `
  _type == "complexPortableText" => {
    ...,
    markDefs[]{
      ...,
      _type == "internalLink" => {
        ${internalLink}
      }
    }
  },
  _type == "customImage" => {${customImageQuery}},
  _type == "youtube" => {${youtube}}
`;

const localizedComplexPortableText = makeLocalizedFragment(supportedLocales, complexPortableText);

const action = `
  _type,
  _key,
  title,
  internalLink{${internalLink}}
`;

const productSection = `
  _type,
  headline,
  "categoryIds": categories[]._ref,
  totalProducts
`;
const categorySection = `
  _type,
  headline,
  "categoryId": category->_id
`;

const hero = `
  _type,
  headline,
  "image": select(
    defined(image.asset) => image {${localeImageQuery}},
    null
  ),
  "backgroundImage": select(
    defined(backgroundImage.asset) => backgroundImage {${localeImageQuery}},
    null
  ),
  actions[]{
    ${action}
  }
`;

const columns = `
  _type == 'localeComplexPortable' => {
    _type,_key,${localizedComplexPortableText}
  },
  _type == 'youtube' => {
    _type,_key,${youtube}
  },
`;

const multiColumns = `
  _type,
  headline,
  "backgroundImage": select(
    defined(backgroundImage.asset) => backgroundImage {${localeImageQuery}},
    null
  ),
  columns[]{_key,${columns}}
`;

const slides = `
  _type == "localeImage" => {${localeImageQuery}}
`;
const carousel = `
  _type,
  slides[] {${slides}},
  autoplay,
  autoplayDelay,
  loop,
  fade
`;

const modules = `
  _type == 'hero' => {
    _key,${hero}
  },
  _type == 'multiColumns' => {
    _key,${multiColumns}
  },
  _type == 'youtube' => {
    _key,${youtube}
  },
  _type == 'productSection' => {
    _key,${productSection}
  },
  _type == 'carousel' => {
    _key,${carousel}
  },
  _type == 'categorySection' => {
    _key,${categorySection}
  }
`;

const navPage = `
  _type,
  title,
  "pageId": page->_id
`

const navLink = `
  _type,
  title,
  url
`

const subMenuLinks = `
  _type == 'navPage' => {
    ${navPage}
  },
  _type == 'navLink' => {
    ${navLink}
  }
`
const menuLinks = `
  ${subMenuLinks},
`

/**
 * Default block for complexPortableText
 * Can be overridden in customer project
 */
export const defaultComplexPortableText = ({ internalLink, customImage, youtube }) => `
  _type == "complexPortableText" => {
    ...,
    markDefs[]{
      ...,
      _type == "internalLink" => { ${internalLink} }
    }
  },
  _type == "customImage" => { ${customImage} },
  _type == "youtube" => { ${youtube} }
`;
