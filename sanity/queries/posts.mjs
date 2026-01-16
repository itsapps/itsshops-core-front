import { resolveFields } from './resolveFields.mjs';

const BASE_FIELDS = {
  _id: '_id',
  _type: '_type',
  _createdAt: '_createdAt',
  _updatedAt: '_updatedAt',
  title: 'title',
  preview: 'preview',
  slug: 'slug',
  image: ({fragments}) => {return `
    "image": select(
      defined(image.asset) => image {${fragments.get('localeImage')}},
      null
    )
  `},
  seo: ({ fragments }) => `seo { ${fragments.get('seo')} }`,
};
const OPTIONAL_FIELDS = { 
  //modules
};

export function buildPostsQuery({fragments, options}) {
  const fields = resolveFields(
    BASE_FIELDS,
    OPTIONAL_FIELDS,
    options.queryOptions ?? {},
    { fragments }
  );
  
  const filter = options.filter?._id ? `&& _id == "${options.filter._id}"` : '';
  const limit = options.filter?.limit ? `[0...${options.filter.limit}]` : '';
  return `
    *[_type == "post" ${filter}]${limit} {
      ${fields.join(',')}
    }
  `;
}