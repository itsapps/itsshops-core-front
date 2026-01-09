import { expandProduct, buildProduct } from './products.mjs';
import { buildPage } from './pages.mjs';
import { buildMenu } from './menus.mjs';

export function createAggregator({ hooks = {}, localeUtils, translate, imageUrls, imageSeo }) {
  return {
    expandProduct(product,
      ctx,
      optionToGroupMap,
      sortOrderMapGroups,
      sortOrderMapGroupOptions
    ) {
      const products = expandProduct(
        product,
        ctx,
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
      remove,
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
        localeUtils,
        translate,
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
      remove,
      slugSet,
      isHome,
      isShop,
    ) {
      const base = buildPage(
        item,
        locale,
        index,
        fragments,
        remove,
        slugSet,
        isHome,
        isShop,
        localeUtils,
        translate,
        imageUrls,
        imageSeo,
        hooks.buildPage
      );

      return base;
    },
    buildMenu(
      item,
      locale,
      index,
      fragments,
      remove,
      pageMapLocalized,
    ) {
      const base = buildMenu(
        item,
        locale,
        index,
        fragments,
        remove,
        pageMapLocalized,
        localeUtils,
        translate,
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