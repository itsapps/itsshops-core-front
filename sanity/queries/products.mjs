import { resolveFields } from './resolveFields.mjs';

const SHARED_BASE_FIELDS = {
  _id: '_id',
  _type: '_type',
  _updatedAt: '_updatedAt',
  title: 'title',
  price: 'price',
  compareAtPrice: 'compareAtPrice',
  categoryIds: '"categoryIds": categories[]._ref',
  seo: ({ fragments }) => `seo { ${fragments.get('seo')} }`,
  stock: "stock",
  productNumber: "productNumber",
};
const SHARED_OPTIONAL_FIELDS = { 
  images: ({ fragments }) => `"images": images[defined(asset)] { ${fragments.get('localeImage')} }`,
  description: ({ fragments }) => `description { ${fragments.localize('portableText')} }`,
  manufacturerId: () => '"manufacturerId": manufacturer->_id',
  tagIds: () => '"tagIds": tags[]._ref',
};

const VARIANT_BASE_FIELDS = {
  featured: "featured",
  active :"active",
  options :'"options": options[]->_id',
}
const VARIANT_OPTIONAL_FIELDS = {
  coverImage: "coverImage",
}

export function buildProductsQuery({fragments, queries, options}) {
  const sharedFields = resolveFields(
    SHARED_BASE_FIELDS,
    SHARED_OPTIONAL_FIELDS,
    options.product ?? {},
    { fragments, queries }
  );
  const variantFields = resolveFields(
    VARIANT_BASE_FIELDS,
    VARIANT_OPTIONAL_FIELDS,
    options.variant ?? {},
    { fragments, queries }
  );

  const limit = options.maxProducts == -1 ? '' : `[0...${options.maxProducts}]`;
  return `
    *[_type == "product"] | order(_updatedAt desc) ${limit} {
      ${sharedFields.join(',')},
      "variants": variants[]->{
        ${[...sharedFields, ...variantFields].join(',')}
      }
    }
  `;
}

const variantOption = (fragments) => `
  _id,
  title,
  sort_order,
  "image": select(
    defined(image.asset) => image {${fragments.get('localeImage')}},
    null
  )
`
const variantOptionGroup = (fragments) => `
  _id,
  title,
  description,
  sort_order,
  "options": options[]->{${variantOption(fragments)}} | order(sort_order asc)
`

export function buildVariantOptionGroupsQuery({fragments}) {
  return `
    *[_type == "variantOptionGroup"] | order(sort_order asc) {
      ${variantOptionGroup(fragments)}
    }
  `
}