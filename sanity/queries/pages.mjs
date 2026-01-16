import { resolveFields } from './resolveFields.mjs';

const BASE_FIELDS = {
  _id: '_id',
  _type: '_type',
  _createdAt: '_createdAt',
  _updatedAt: '_updatedAt',
  title: 'title',
  slug: 'slug',
  //modules
  seo: ({ fragments }) => `seo { ${fragments.get('seo')} }`,
};
const OPTIONAL_FIELDS = { 
  
};

export function buildPagesQuery({fragments, options}) {
  const fields = resolveFields(
    BASE_FIELDS,
    OPTIONAL_FIELDS,
    options.queryOptions ?? {},
    { fragments }
  );
  
  const filter = options.filter?._id ? `&& _id == "${options.filter._id}"` : '';
  const limit = options.filter?.limit ? `[0...${options.filter.limit}]` : '';
  return `
    *[_type == "page" ${filter}]${limit} {
      ${fields.join(',')}
    }
  `;
}