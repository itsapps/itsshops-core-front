import { expandProduct, buildProduct } from './products.mjs';
import { buildPage } from './pages.mjs';
import { buildMenu } from './menus.mjs';
import { buildCategory } from './categories.mjs';
import { buildSetting } from './settings.mjs';
import { buildShippingCountries } from './shippingCountries.mjs';
import { buildBlog } from './blog.mjs';
import { buildPost } from './posts.mjs';
// import { buildModule } from './modules.mjs';

export function createAggregator({ hooks = {}, localizers, media: { imageUrls, imageSeo }}) {
  return {
    expandProduct(product,
      ctx,
      categoriesMap,
      optionToGroupMap,
      sortOrderMapGroups,
      sortOrderMapGroupOptions
    ) {
      const products = expandProduct(
        product,
        ctx,
        categoriesMap,
        optionToGroupMap,
        sortOrderMapGroups,
        sortOrderMapGroupOptions,
        hooks.expandProduct
      );
      return products;
    },
    buildProduct(
      product,
      locale,
      index,
      fragments,
      remove = [],
      slugSet,
      optionGroupMapLocalized,
      optionMapLocalized,
    ) {
      const base = buildProduct(
        product,
        locale,
        index,
        fragments,
        remove,
        slugSet,
        optionGroupMapLocalized,
        optionMapLocalized,
        localizers,
        imageUrls,
        imageSeo,
        hooks.buildProduct
      );

      return base;
    },
    buildPage(
      item,
      locale,
      index,
      fragments,
      remove = [],
      slugSet,
      homeId,
      shopId,
    ) {
      const base = buildPage(
        item,
        locale,
        index,
        fragments,
        remove,
        slugSet,
        homeId,
        shopId,
        localizers,
        imageUrls,
        imageSeo,
        hooks.buildPage
      );

      return base;
    },
    buildPost(
      item,
      locale,
      index,
      fragments,
      remove = [],
      slugSet,
      homeId,
    ) {
      const base = buildPost(
        item,
        locale,
        index,
        fragments,
        remove,
        slugSet,
        homeId,
        localizers,
        imageUrls,
        imageSeo,
        hooks.buildPost
      );

      return base;
    },
    buildBlog(
      item,
      locale,
      fragments,
      remove = [],
      blogPostIdsPaginated,
    ) {
      const base = buildBlog(
        item,
        locale,
        fragments,
        remove,
        blogPostIdsPaginated,
        localizers,
        imageUrls,
        imageSeo,
        hooks.buildBlog
      );

      return base;
    },
    buildCategory(
      item,
      locale,
      index,
      fragments,
      remove = [],
      slugSet,
    ) {
      const base = buildCategory(
        item,
        locale,
        index,
        fragments,
        remove,
        slugSet,
        localizers,
        imageUrls,
        imageSeo,
        hooks.buildCategory
      );

      return base;
    },
    buildSetting(
      item,
      locale,
      fragments,
      remove = [],
      country,
    ) {
      const base = buildSetting(
        item,
        locale,
        fragments,
        remove,
        country,
        localizers,
        imageUrls,
        imageSeo,
        hooks.buildSetting
      );

      return base;
    },
    buildShippingCountries(
      item,
      locale,
      fragments,
      remove = [],
      getSupportedCountry,
    ) {
      const base = buildShippingCountries(
        item,
        locale,
        fragments,
        remove,
        getSupportedCountry,
        localizers,
        imageUrls,
        imageSeo,
        hooks.buildShippingCountries
      );

      return base;
    },
    buildMenu(
      item,
      locale,
      index,
      fragments,
      remove = [],
      localizedReferenceMaps,
    ) {
      const base = buildMenu(
        item,
        locale,
        index,
        fragments,
        remove,
        localizedReferenceMaps,
        localizers,
        imageUrls,
        imageSeo,
        hooks.buildMenu,
        hooks.buildFragment,
      );

      return base;
    },

    portableText(blocks, ctx) {
      return blocks.map(b =>
        hooks.block ? hooks.block(b, ctx) : b
      );
    },
  };
}