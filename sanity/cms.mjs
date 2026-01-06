import { createSanityClient } from './client.mjs'
import { buildProductsQuery } from './queries/products.mjs'
import { buildVariantOptionGroupsQuery } from './queries/products.mjs'
import { buildPagesQuery } from './queries/pages.mjs'
import { buildMenusQuery } from './queries/menus.mjs'
import { buildModulesQuery } from './queries/modules.mjs'
import { createFragmentRegistry } from './fragmentRegistry.mjs';
import { createModuleRegistry } from './moduleRegistry.mjs';

export default async function cms({
  locales,
  defaultLocale,
  apiVersion,
  features = {},
  queryOptions = {},
  overrideFragments = {},
  overrideModules = {}
} = {}) {
  const client = createSanityClient(apiVersion);

  const fragments = createFragmentRegistry({
    locales,
    overrides: overrideFragments
  });
  // const modules = createModuleRegistry({ fragments, overrides: overrideModules });

  const variantOptionGroupsQuery = buildVariantOptionGroupsQuery({fragments})
  const variantOptionGroups = await client.fetch(variantOptionGroupsQuery);
  const productQuery = buildProductsQuery({fragments, options: {product: queryOptions.product, locales, defaultLocale}})
  const products = await client.fetch(productQuery);
  
  const pageQuery = buildPagesQuery({fragments, options: {page: queryOptions.page, locales, defaultLocale}})
  const pages = await client.fetch(pageQuery);
  
  const menuQuery = buildMenusQuery({fragments, options: {menu: queryOptions.menu, locales, defaultLocale}})
  const menus = await client.fetch(menuQuery);

  // const modulesQuery = buildModulesQuery({ fragments });

  //..., modules[]{${Object.keys(modules).map(name => modules.get(name)).join(",")}}
  // const pagesQuery = `
  //   *[_type == "page"] | order(_updatedAt desc) {
  //     _id,
  //     title,
  //     slug,
  //     modules[]{
  //       ${buildModulesQuery({ enabled: ["hero"], modules })}
  //     }
  //   }
  // `;
  // const pages = await client.fetch(pagesQuery);

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