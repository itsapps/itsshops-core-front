import { createSanityClient } from './client.mjs'
import { buildProductsQuery } from './queries/products.mjs'
import { createFragmentRegistry } from './fragmentRegistry.mjs';

export default async function cms({ locales, defaultLocale, apiVersion, features = {}, queryOptions = {}, overrideFragments = {} } = {}) {
  const client = createSanityClient(apiVersion);

  const fragments = createFragmentRegistry({
    locales,
    overrides: overrideFragments
  });

  const query = buildProductsQuery({fragments, options: {product: queryOptions.product, locales, defaultLocale}})
  const products = await client.fetch(query);

  // just some dummy data for now
  return {
    paginationProducts: [
      {
        permalink: '/products/1/',
        _id: 1,
        title: 'Product 1',
        locale: 'en',
      },
      {
        permalink: '/products/2/',
        _id: 2,
        title: 'Product 2',
        locale: 'en',
      },
    ]
  }
}