import { resolveFields } from './resolveFields.mjs';

const BASE_FIELDS = {
  _id: '_id',
  _type: '_type',
  _createdAt: '_createdAt',
  _updatedAt: '_updatedAt',
  title: 'title',
  description: 'description',
  seo: ({ fragments }) => `seo { ${fragments.get('seo')} }`,
  postsPerPage: 'postsPerPage',
};
const OPTIONAL_FIELDS = { 
  
};

export function buildBlogQuery({fragments, options}) {
  const fields = resolveFields(
    BASE_FIELDS,
    OPTIONAL_FIELDS,
    options.queryOptions ?? {},
    { fragments }
  );
  
  return `
    *[_type == "blog"][0] {
      ${fields.join(',')}
    }
  `;
}