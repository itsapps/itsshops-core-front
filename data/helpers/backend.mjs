
/**
 * @typedef {Object.<string, string>} LocaleString
 */

/**
 * @typedef {Object.<string, string>} LocaleBlock
 */

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
const imageQuery = `
  _type,
  "alt": asset->altText,
  "asset": asset->{_id, url, "dimensions": metadata.dimensions {width, height, aspectRatio}},
  crop,
  hotspot
`;

/**
 * @typedef {Object} LocaleImage
 * @property {string} _type
 * @property {LocaleString} title
 * @property {LocaleString} alt
 * @property {Asset} asset
 * @property {Object} crop
 * @property {Object} hotspot
 */
const localeImageQuery = `
  _type,
  title,
  alt,
  "asset": asset->{url, _id, "dimensions": metadata.dimensions {width, height, aspectRatio}},
  crop,
  hotspot
`;

/**
 * @typedef {Object} CustomImage
 * @property {string} _type
 * @property {string} title
 * @property {string} alt
 * @property {Asset} asset
 * @property {Object} crop
 * @property {Object} hotspot
 */
const customImageQuery = `
  _type,
  title,
  "alt": coalesce(alt, asset->altText),
  "asset": asset->{url, _id, "dimensions": metadata.dimensions {width, height, aspectRatio}},
  crop,
  hotspot
`;


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

const localizedComplexPortableText = supportedLocales.map((locale) => {
  return `${locale}[]{${complexPortableText}}`;
}).join(',');

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
 * @typedef {Object} Product
 * @property {string} _id
 * @property {string} _type
 * @property {string} _updatedAt
 * @property {LocaleString} title
 * @property {LocaleBlock|null} description
 * @property {LocaleImage[]} images
 * @property {number} price
 * @property {number|null} compareAtPrice
 * @property {string|null} productNumber
 * @property {string|null} manufacturerId
 * @property {number|null} stock
 * @property {Object|null} seo
 * @property {string[]} categoryIds
 * @property {string[]} tagIds
 */

/**
 * Fetch products from Sanity
 * @returns {Promise<Product[]>}
 */
export const getProducts = async () => {
  const sharedProps = [
    "_id",
    "_type",
    "_updatedAt",
    "title",
    `description {${localizedComplexPortableText}}`,
    // "bio",
    `"images": images[defined(asset)] {${localeImageQuery}}`,
    "price",
    "compareAtPrice",
    "productNumber",
    '"manufacturerId": manufacturer->_id',
    "stock",
    `seo {${seo}}`,
    '"categoryIds": categories[]._ref',
    '"tagIds": tags[]._ref',
  ]
  const variantProps = [
    "featured",
    "active",
    ...sharedProps,
    '"options": options[]->_id',
    "coverImage",
  ]
  const productProps = [
    ...sharedProps,
  ]
  const query = `
    *[_type == "product"] | order(_updatedAt desc) {
      ${productProps.join(',')},"variants": variants[]->{${variantProps.join(',')}}
    }
  `
  return sanityClient.fetch(query);
}

const categories = `
  _id,
  title,
  description,
  sort_order,
  "parentId": parent._ref,
  "image": select(
    defined(image.asset) => image {${localeImageQuery}},
    null
  ),
  seo {${seo}}
`
export const getCategories = async () => {
  const query = `
    *[_type == "category"] | order(sort_order asc) {
      ${categories}
    }
  `
  return await sanityClient.fetch(query);
}

const manufacturers = `
  _id,
  title,
  description,
  link,
  "image": select(
    defined(image.asset) => image {${imageQuery}},
    null
  )
`
export const getManufacturers = async () => {
  const query = `
    *[_type == "manufacturer"]{
      ${manufacturers}
    }
  `
  return sanityClient.fetch(query);
}
export const getTags = async () => {
  const props = [
    "_id",
    "title"
  ]
  const query = `
    *[_type == "tag"]{
      ${props.join(',')}
    }
  `
  return sanityClient.fetch(query);
}

const variantOption = `
  _id,
  title,
  sort_order,
  "image": select(
    defined(image.asset) => image {${localeImageQuery}},
    null
  )
`
const variantOptionGroup = `
  _id,
  title,
  description,
  sort_order,
  "options": options[]->{${variantOption}} | order(sort_order asc)
`
export const getVariantOptionGroups = async () => {
  const query = `
    *[_type == "variantOptionGroup"] | order(sort_order asc) {
      ${variantOptionGroup}
    }
  `
  return sanityClient.fetch(query);
}

const page = `
  _id,
  _createdAt,
  _updatedAt,
  title,
  slug,
  modules[]{${modules}},
  seo {${seo}}
`

export const getPages = async () => {
  const query = `
    *[_type == "page"] {
      ${page}
    }
  `
  return sanityClient.fetch(query);
}

export const getSinglePage = async (pageId) => {
  const idFilter = pageId ? `&& _id == "${pageId}"` : '';

  const query = `
    *[_type == "page" ${idFilter}][0] {
      ${page}
    }
  `;
  return sanityClient.fetch(query, {}, {
    filterResponse: false,
    resultSourceMap: true,
    stega: {
      enabled: true,
      studioUrl
    }
  });
}

const blog = `
  _id,
  _createdAt,
  _updatedAt,
  title,
  description,
  seo {${seo}},
  postsPerPage
`

export const getBlog = async () => {
  const query = `
    *[_type == "blog"][0] {
      ${blog}
    }
  `
  return sanityClient.fetch(query);
}

const post = `
  _id,
  _createdAt,
  _updatedAt,
  title,
  preview,
  slug,
  "image": select(
    defined(image.asset) => image {${localeImageQuery}},
    null
  ),
  modules[]{${modules}},
  seo {${seo}}
`

export const getPosts = async () => {
  const query = `
    *[_type == "post"] {
      ${post}
    } | order(_updatedAt desc)
  `
  return sanityClient.fetch(query);
}

export const getSinglePost = async (postId) => {
  const idFilter = postId ? `&& _id == "${postId}"` : '';

  const query = `
    *[_type == "post" ${idFilter}][0] {
      ${post}
    }
  `;
  return sanityClient.fetch(query, {}, {
    filterResponse: false,
    resultSourceMap: true,
    stega: {
      enabled: true,
      studioUrl
    }
  });
}

const menu = `
  _id,
  title,
  items[]{
    ${menuLinks}
  }
`

export const getMenus = async () => {
  const query = `
    *[_type == "menu"] {
      ${menu}
    }
  `
  return sanityClient.fetch(query);
}

export const getSiteSettings = async () => {
  const query = `
    *[_type == "generalSettings"][0] {
      siteTitle,
      siteDescription,
      siteShortDescription,

      companyName,
      companyOwner,
      companyPhone,
      companyStreet,
      companyZip,
      companyCity,
      companyCountry,
      companyState,
      companyEmail,

      "homeId": home->_id,
      "privacyId": privacy->_id,
      "mainMenuIds": mainMenus[]._ref,
      "footerMenuIds": footerMenus[]._ref,
      
      gtmID,

    }
  `
  return sanityClient.fetch(query);
}

export const getShippingCountries = async () => {
  const query = `
    *[_type == "shippingCountry"] {
      _id,
      code,
      rates
    }
  `
  return sanityClient.fetch(query);
}
