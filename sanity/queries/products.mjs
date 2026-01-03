import { resolveFields } from './resolveFields.mjs';

const SHARED_BASE_FIELDS = [
  '_id',
  '_type',
  '_updatedAt',
  'title',
  'price',
  'compareAtPrice',
  '"categoryIds": categories[]._ref',
  // `seo {${seo}}`,
];
const SHARED_OPTIONAL_FIELDS = { 
  productNumber: () => "productNumber",
  images: ({ fragments }) => `"images": images[defined(asset)] { ${fragments.get('localeImage')} }`,
  description: ({ fragments }) => `description { ${fragments.localize('portableText')} }`,
  manufacturerId: () => '"manufacturerId": manufacturer->_id',
  stock: () => "stock",
  tagIds: () => '"tagIds": tags[]._ref',
};

const VARIANT_BASE_FIELDS = [
  "featured",
  "active",
  '"options": options[]->_id',
]
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