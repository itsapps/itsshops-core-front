import { resolveFields } from './resolveFields.mjs';

const SHARED_BASE_FIELDS = {
  _id: '_id',
  _type: '_type',
  _updatedAt: '_updatedAt',
  title: 'title',
  price: 'price',
  compareAtPrice: 'compareAtPrice',
  categoryIds: '"categoryIds": categories[]._ref',
};
const SHARED_OPTIONAL_FIELDS = { 
  productNumber: () => "productNumber",
  images: ({ fragments }) => `"images": images[defined(asset)] { ${fragments.get('localeImage')} }`,
  description: ({ fragments }) => `description { ${fragments.localize('portableText')} }`,
  manufacturerId: () => '"manufacturerId": manufacturer->_id',
  stock: () => "stock",
  tagIds: () => '"tagIds": tags[]._ref',
  seo: ({ fragments }) => `seo { ${fragments.get('seo')} }`,
};

const VARIANT_BASE_FIELDS = {
  featured: "featured",
  active :"active",
  options :'"options": options[]->_id',
}
const VARIANT_OPTIONAL_FIELDS = {
  coverImage: "coverImage",
}

export function buildProductsQuery({fragments, options}) {
  const sharedFields = resolveFields(
    SHARED_BASE_FIELDS,
    SHARED_OPTIONAL_FIELDS,
    options.product ?? {},
    { fragments }
  );
  const variantFields = resolveFields(
    VARIANT_BASE_FIELDS,
    VARIANT_OPTIONAL_FIELDS,
    options.variant ?? {},
    { fragments }
  );

  return `
    *[_type == "product"] | order(_updatedAt desc) {
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
    defined(image.asset) => image {${fragments.localeImage}},
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