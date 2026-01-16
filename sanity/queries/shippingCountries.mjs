import { resolveFields } from './resolveFields.mjs';

const BASE_FIELDS = {
  _id: '_id',
  code: 'code',
  rates: 'rates',
};
const OPTIONAL_FIELDS = {

};

export function buildShippingCountriesQuery({fragments, options}) {
  const fields = resolveFields(
    BASE_FIELDS,
    OPTIONAL_FIELDS,
    options.queryOptions ?? {},
    { fragments }
  );
  
  return `
    *[_type == "shippingCountry"] {
      ${fields.join(',')}
    }
  `;
}