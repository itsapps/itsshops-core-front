import { resolveFields } from './resolveFields.mjs';

const BASE_FIELDS = {
  _id: '_id',
  _type: '_type',
  _createdAt: '_createdAt',
  _updatedAt: '_updatedAt',
  title: 'title',
};
const OPTIONAL_FIELDS = { 
  
};

export function buildPagesQuery({fragments, options}) {
  const fields = resolveFields(
    BASE_FIELDS,
    OPTIONAL_FIELDS,
    options.page ?? {},
    { fragments }
  );
  
  return `
    *[_type == "page"] {
      ${fields.join(',')}
    }
  `;
}