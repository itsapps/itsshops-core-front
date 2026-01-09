import { buildProductsQuery } from './queries/products.mjs'
import { buildVariantOptionGroupsQuery } from './queries/products.mjs'
import { buildPagesQuery } from './queries/pages.mjs'
import { buildMenusQuery } from './queries/menus.mjs'
import { buildModulesQuery } from './queries/modules.mjs'
import { createFragmentRegistry } from './fragmentRegistry.mjs';
import { createModuleRegistry } from './moduleRegistry.mjs';
import { createAggregator } from './aggregate/index.mjs';

import { localizer } from '../utils/localizer.mjs';
import { slugifyString } from '../utils/slugify.mjs'

export default async function cms({
  locales,
  defaultLocale,
  helpers = {
    translate,
    imageUrls,
    imageSeo,
  },
  client,
  features = {},
  queryOptions = {},
  overrideFragments = {},
  overrideModules = {},
  aggregate = {},
} = {}) {
  const localeUtils = localizer(locales, defaultLocale);

  const fragments = createFragmentRegistry({
    locales,
    overrides: overrideFragments
  });
  // const modules = createModuleRegistry({ fragments, overrides: overrideModules });

  const aggregator = createAggregator({ hooks: aggregate.hooks, localeUtils, ...helpers });

  const variantOptionGroupsQuery = buildVariantOptionGroupsQuery({fragments})
  const variantOptionGroups = await client.fetch(variantOptionGroupsQuery);
  const productQuery = buildProductsQuery({fragments, options: {product: queryOptions.product, locales, defaultLocale}})
  const products = await client.fetch(productQuery);
  
  const pageQuery = buildPagesQuery({fragments, options: {page: queryOptions.page, locales, defaultLocale}})
  const pages = await client.fetch(pageQuery);
  
  const menuQuery = buildMenusQuery({fragments, options: {menu: queryOptions.menu, locales, defaultLocale}})
  const menus = await client.fetch(menuQuery);


  // variant sort stuff
  // sort order maps for optionGroups and options
  const sortOrderMapGroups = Object.fromEntries(variantOptionGroups.map(item => [item._id, item.sort_order]));
  const sortOrderMapGroupOptions = {};
  const optionToGroupMap = {};
  variantOptionGroups.forEach(g => {
    g.options.forEach(o => {
      optionToGroupMap[o._id] = g._id;
    })

    sortOrderMapGroupOptions[g._id] = Object.fromEntries(g.options.map(item => [item._id, item.sort_order]));
  })
  // expand products
  const expandedProducts = products.map(p =>
    aggregator.expandProduct(
      p, {
        remove: queryOptions.product?.remove,
        fragments,
      },
      optionToGroupMap,
      sortOrderMapGroups,
      sortOrderMapGroupOptions
    )
  ).flat()

  // build optionGroup and option maps
  const optionGroupMapLocalized = Object.assign({}, ...locales.map(x => ({[x]: {}})));
  const optionMapLocalized = Object.assign({}, ...locales.map(x => ({[x]: {}})));
  locales.forEach(locale => {
    variantOptionGroups.forEach((g, i) => {
      const title = localeUtils.getLocalizedValue(g, "title", locale);
      const options = (g.options || [])
      const group = {
        ...g,
        title: title,
        slug: slugifyString(title),
        options: options.map(o => {
          const optionTitle = localeUtils.getLocalizedValue(o, "title", locale);
          const option = {
            ...o,
            groupId: g._id,
            title: optionTitle,
            slug: slugifyString(optionTitle),
            locale: locale,
          }
          optionMapLocalized[locale][o._id] = option;
          return option
        }),
        locale: locale,
        eleventyPaginationGroupNumber: i
      }
      optionGroupMapLocalized[locale][g._id] = group;
    })
  })

  const productMapLocalized = Object.assign({}, ...locales.map(x => ({[x]: {}})));
  const productSlugSetLocalized = Object.assign({}, ...locales.map(x => ({[x]: new Set()})));
  const paginationProducts = locales.map(locale => {
    const productSlugSet = productSlugSetLocalized[locale];
    return expandedProducts.map((p, index) => {
      const product = aggregator.buildProduct(
        p,
        locale,
        index,
        fragments,
        queryOptions.product?.remove,
        productSlugSet,
        optionGroupMapLocalized,
        optionMapLocalized,
      )
      productMapLocalized[locale][product._id] = product;

      return product
    })
  }).flat()


  const pageMapLocalized = Object.assign({}, ...locales.map(x => ({[x]: {}})));
  const pageSlugSetLocalized = Object.assign({}, ...locales.map(x => ({[x]: new Set()})));
  const paginationPages = locales.map(locale => {
    const pageSlugSet = pageSlugSetLocalized[locale];
    return pages.map((p, index) => {
      const page = aggregator.buildPage(
        p,
        locale,
        index,
        fragments,
        queryOptions.page?.remove,
        pageSlugSet,
        false,
        true,
      )
      pageMapLocalized[locale][page._id] = page;

      return page
    })
  }).flat()

  const menuMapLocalized = Object.assign({}, ...locales.map(x => ({[x]: {}})));
  locales.forEach(locale => {
    menus.forEach((m, index) => {
      menuMapLocalized[locale][m._id] = aggregator.buildMenu(
        m,
        locale,
        index,
        fragments,
        queryOptions.menu?.remove,
        pageMapLocalized
      )
    })
  })
  

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
    paginationProducts,
    paginationPages,
  }
}