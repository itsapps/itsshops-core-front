import { resolveFields } from './resolveFields.mjs';

const BASE_FIELDS = {
  _id: '_id',
  _type: '_type',
  title: 'title',
  items: ({fragments}) => {return `
    items[]{${fragments.get('menuLinks')}}
  `},
};
const OPTIONAL_FIELDS = { 
  
};

export function buildMenusQuery({fragments, options}) {
  const fields = resolveFields(
    BASE_FIELDS,
    OPTIONAL_FIELDS,
    options.menu ?? {},
    { fragments }
  );
  
  return `
    *[_type == "menu"] {
      ${fields.join(',')}
    }
  `;
}