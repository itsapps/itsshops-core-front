import { resolveFields } from './resolveFields.mjs';

const BASE_FIELDS = {
  _id: '_id',
  _type: '_type',
  title: 'title',
  description: 'description',
  sort_order: 'sort_order',
  parentId: '"parentId": parent._ref',
  seo: ({ fragments }) => `seo { ${fragments.get('seo')} }`,
  _createdAt: '_createdAt',
  _updatedAt: '_updatedAt',
};
const OPTIONAL_FIELDS = {
  image: ({fragments}) => {return `
    "image": select(
      defined(image.asset) => image {${fragments.get('localeImage')}},
      null
    )
  `},
};

export function buildCategoriesQuery({fragments, options}) {
  const fields = resolveFields(
    BASE_FIELDS,
    OPTIONAL_FIELDS,
    options.queryOptions ?? {},
    { fragments }
  );
  
  return `
    *[_type == "category"] | order(sort_order asc) {
      ${fields.join(',')}
    }
  `;
}