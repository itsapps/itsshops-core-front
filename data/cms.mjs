import _ from 'lodash';
import { buildCategoriesQuery } from '../sanity/queries/categories.mjs'
import { buildProductsQuery } from '../sanity/queries/products.mjs'
import { buildVariantOptionGroupsQuery } from '../sanity/queries/products.mjs'
import { buildPagesQuery } from '../sanity/queries/pages.mjs'
import { buildPostsQuery } from '../sanity/queries/posts.mjs'
import { buildBlogQuery } from '../sanity/queries/blog.mjs'
import { buildMenusQuery } from '../sanity/queries/menus.mjs'
import { buildSettingsQuery } from '../sanity/queries/settings.mjs'
import { buildShippingCountriesQuery } from '../sanity/queries/shippingCountries.mjs'
import { buildModulesQuery } from '../sanity/queries/modules.mjs'
import { createFragmentRegistry } from '../sanity/fragmentRegistry.mjs';
import { createModuleRegistry } from '../sanity/moduleRegistry.mjs';
import { createAggregator } from '../sanity/aggregate/index.mjs';
import { localeFieldQuery } from '../utils/queries.mjs';

import { slugify } from '../utils/utils.mjs'
import { getSupportedCountry, defaultCountry } from '../data/countries.mjs';
import { createSchemaOrg } from '../data/schema.mjs'

export default async function cms({
  locales,
  defaultLocale,
  build: {
    mode,
    baseUrl,
    languageMap,
    previewDocumentType,
    previewDocumentId,
    previewLocale,
    studioUrl,
    maxProducts,
  },
  localizedReferenceMaps,
  helpers,
  client,
  features = {},
  queryOptions = {},
  overrideFragments = {},
  overrideModules = {},
  aggregate = {},
} = {}) {
  const {
    localizers,
    media,
  } = helpers

  const defaultHomeId = '999999'
  const homeProductsCount = 50;
  const maxProductLoopItems = 4;
  const isPreview = mode === 'preview'

  const fragments = createFragmentRegistry({
    locales,
    overrides: overrideFragments
  });
  // const modules = createModuleRegistry({ fragments, overrides: overrideModules });

  const aggregator = createAggregator({ hooks: aggregate.hooks, ...helpers });
  const data = getDefaultData(locales, localizedReferenceMaps);
  const queries = {
    localeFieldQuery: (key) => localeFieldQuery(key, locales)
  }

  if (mode === 'normal') {
    data.schema = createSchemaOrg(localizedReferenceMaps, baseUrl, languageMap, media.imageSchema);
  }

  if (mode === 'normal') {
    const settingsQuery = buildSettingsQuery({fragments, options: {queryOptions: queryOptions.setting, locales, defaultLocale}})
    const settings = await client.fetch(settingsQuery);
    const settingsLocalized = Object.assign({}, ...locales.map(locale => {
      const country = getSupportedCountry(settings.companyCountry || defaultCountry.value);
      const setting = aggregator.buildSetting(
        settings,
        locale,
        fragments,
        queryOptions.setting?.remove,
        country,
      )
      return {[locale]: setting}
    }))

    data.settings = settings
    data.getSiteSettings = (locale) => {
      return settingsLocalized[locale];
    }
    locales.forEach(locale => {
      localizedReferenceMaps[locale].siteSettings = settingsLocalized[locale]
    });

    // shipping countries
    const shippingCountriesQuery = buildShippingCountriesQuery({fragments, options: {queryOptions: queryOptions.shippingCountries, locales, defaultLocale}})
    const shippingCountries = await client.fetch(shippingCountriesQuery);
    if (!shippingCountries || !shippingCountries.length) {
      throw new Error("Shipping countries not found");
    }
    const shippingCountriesLocalized = Object.assign({}, ...locales.map(locale => {
      return {[locale]: shippingCountries.map((s, index) => {
        const shippingCountry = aggregator.buildShippingCountries(
          s,
          locale,
          fragments,
          queryOptions.shippingCountries?.remove,
          getSupportedCountry,
        )
        return shippingCountry
      })
    }}))
    
    data.supportedShippingCountryCodes = shippingCountries.map(s => s.code).join(',');
    locales.forEach(locale => {
      localizedReferenceMaps[locale].shippingCountries = shippingCountriesLocalized[locale]
    });
  }

  if (features.products && mode === 'normal') {
    const variantOptionGroupsQuery = buildVariantOptionGroupsQuery({fragments})
    const variantOptionGroups = await client.fetch(variantOptionGroupsQuery);
    const productQuery = buildProductsQuery({fragments, queries, options: {product: queryOptions.product, variant: queryOptions.variant, locales, defaultLocale, maxProducts}})
    const products = await client.fetch(productQuery);
    const categoryQuery = buildCategoriesQuery({fragments, options: {queryOptions: queryOptions.category, locales, defaultLocale}})
    const categories = await client.fetch(categoryQuery);

    // prepare categories
    const categoriesMap = {}
    categories.forEach(c => {
      c.productIds = [];
      c.categoryIds = [];
      categoriesMap[c._id] = c
    })
    const categoryTree = getCategoryTree(categories);

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
        categoriesMap,
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
        const title = localizers.getLocalizedValue(g, "title", locale);
        const options = (g.options || [])
        const group = {
          ...g,
          title: title,
          slug: slugify(title),
          options: options.map(o => {
            const optionTitle = localizers.getLocalizedValue(o, "title", locale);
            const option = {
              ...o,
              groupId: g._id,
              title: optionTitle,
              slug: slugify(optionTitle),
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
    const slugSetLocalized = Object.assign({}, ...locales.map(x => ({[x]: new Set()})));
    const paginationProducts = locales.map(locale => {
      const slugSet = slugSetLocalized[locale];
      return expandedProducts.map((p, index) => {
        const product = aggregator.buildProduct(
          p,
          locale,
          index,
          fragments,
          queryOptions.product?.remove,
          slugSet,
          optionGroupMapLocalized,
          optionMapLocalized,
        )
        productMapLocalized[locale][product._id] = product;

        return product
      })
    }).flat()

    data.paginationProducts = paginationProducts;
    const productsByLocale = Object.assign({}, paginationProducts.reduce((acc, p) => {
      acc[p.locale] = acc[p.locale] || [];
      acc[p.locale].push(p);
      return acc
    }, {}));
    data.getProducts = (locale) => {
      return productsByLocale[locale];
    }
    data.getProduct = (id, locale) => {
      return productMapLocalized[locale][id]
    }
    data.getOptionGroup = (id, locale) => {
      return optionGroupMapLocalized[locale][id]
    }
    data.getOption = (id, locale) => {
      return optionMapLocalized[locale][id]
    }
    // data.paginationCategories = paginationCategories
    // data.categoryTree = categoryTree
    data.homeProductIds = _.shuffle(
      [...expandedProducts.filter(p => p.addToSearch)])
      .slice(0, homeProductsCount)
      .map(p => p._id)
    data.sitemaps.push({
      key: 'products',
      permalink: `/sitemap-products.xml`,
      data: Object.values(productMapLocalized[defaultLocale]),
    })
    locales.forEach(locale => {
      localizedReferenceMaps[locale].product = productMapLocalized[locale]
      localizedReferenceMaps[locale].productVariant = productMapLocalized[locale]
    });


    const categoryMapLocalized = Object.assign({}, ...locales.map(x => ({[x]: {}})));
    const categorySlugSetLocalized = Object.assign({}, ...locales.map(x => ({[x]: new Set()})));
    const paginationCategories = locales.map(locale => {
      const categorySlugSet = categorySlugSetLocalized[locale];
      return categories.map((c, index) => {
        const category = aggregator.buildCategory(
          c,
          locale,
          index,
          fragments,
          queryOptions.category?.remove,
          categorySlugSet,
        )
        categoryMapLocalized[locale][category._id] = category;

        return category
      })
    }).flat()

    data.categoryTree = categoryTree;
    data.paginationCategories = paginationCategories;
    const categoriesByLocale = Object.assign({}, paginationCategories.reduce((acc, c) => {
      acc[c.locale] = acc[c.locale] || [];
      acc[c.locale].push(c);
      return acc
    }, {}));
    data.getCategories = (locale) => {
      return categoryMapLocalized[locale];
    }
    data.getCategory = (id, locale) => {
      return categoryMapLocalized[locale][id]
    }
    data.sitemaps.push({
      key: 'categories',
      permalink: `/sitemap-categories.xml`,
      data: categoriesByLocale[defaultLocale],
    })
    locales.forEach(locale => {
      localizedReferenceMaps[locale].category = categoryMapLocalized[locale]
    });

    data.getSearchData = (locale) => {
        const products = productsByLocale[locale].filter(p => p.addToSearch);
        const stringified = JSON.stringify({
          products: products.map(p => {
            const img = helpers.media.replaceableImageUrl(p.images.length > 0 ? p.images[0] : null)
            return {
              id: p._id,
              title: p.title,
              url: p.permalink,
              img,
              categoryIds: p.categoryIds,
            }
          }),
          categories: categoriesByLocale[locale].map(c => {
            const img = helpers.media.replaceableImageUrl(c.image)
            return {
              id: c._id,
              title: c.title,
              url: c.permalink,
              img,
            }
          }),
        })
        return stringified
      },
      data.getSubCategoryIds = (id) => {
        if (id) {
          const category = categoriesMap[id];
          return category ? category.categoryIds : [];
        } else {
          return categoryTree.map(c => c._id);
        }
      }
  }

  const fetchOptions = {
    filterResponse: false,
    resultSourceMap: isPreview,
    stega: {
      enabled: isPreview,
      studioUrl
    }
  }
  const actualLocales = isPreview ? [previewLocale || defaultLocale] : locales
  if (mode === 'normal' || (isPreview && previewDocumentType === 'page')) {
    const pageQuery = buildPagesQuery({fragments, options: {queryOptions: queryOptions.page, locales, defaultLocale, filter: {...isPreview ? { _id: previewDocumentId, limit: 1 } : {}}}})
    const {result: pages, resultSourceMap} = await client.fetch(pageQuery, {}, fetchOptions);
    const pageMapLocalized = Object.assign({}, ...actualLocales.map(x => ({[x]: {}})));
    const slugSetLocalized = Object.assign({}, ...actualLocales.map(x => ({[x]: new Set()})));
    const paginationPages = actualLocales.map(locale => {
      const slugSet = slugSetLocalized[locale];
      return pages.map((p, index) => {
        const page = aggregator.buildPage(
          p,
          locale,
          index,
          fragments,
          queryOptions.page?.remove,
          slugSet,
          data.settings?.homeId,
          data.settings?.shopId,
        )
        if (resultSourceMap) {
          page.resultSourceMap = JSON.stringify(resultSourceMap);
        }
        pageMapLocalized[locale][page._id] = page;

        return page
      })
    }).flat()

    data.paginationPages = paginationPages;
    const pagesByLocale = Object.assign({}, paginationPages.reduce((acc, p) => {
      acc[p.locale] = acc[p.locale] || [];
      acc[p.locale].push(p);
      return acc
    }, {}));
    data.getPages = (locale) => {
      return pagesByLocale[locale];
    }
    data.getPage = (id, locale) => {
      return pageMapLocalized[locale][id]
    }
    if (!isPreview) {
      data.sitemaps.push({
        key: 'pages',
        permalink: `/sitemap-pages.xml`,
        data: pagesByLocale[defaultLocale],
      })
    }
    locales.forEach(locale => {
      localizedReferenceMaps[locale].page = pageMapLocalized[locale]
    });
  }

  // posts
  if (features.blog && (mode === 'normal' || (mode === 'preview' && previewDocumentType === 'post'))) {
    const postQuery = buildPostsQuery({fragments, options: {queryOptions: queryOptions.post, locales, defaultLocale, filter: {...isPreview ? { _id: previewDocumentId, limit: 1 } : {}}}})
    const {result: posts, resultSourceMap} = await client.fetch(postQuery, {}, fetchOptions);
    const postMapLocalized = Object.assign({}, ...actualLocales.map(x => ({[x]: {}})));
    const slugSetLocalized = Object.assign({}, ...actualLocales.map(x => ({[x]: new Set()})));
    const paginationPosts = actualLocales.map(locale => {
      const slugSet = slugSetLocalized[locale];
      return posts.map((p, index) => {
        const post = aggregator.buildPost(
          p,
          locale,
          index,
          fragments,
          queryOptions.post?.remove,
          slugSet,
          data.settings?.homeId,
        )
        if (resultSourceMap) {
          post.resultSourceMap = JSON.stringify(resultSourceMap);
        }
        postMapLocalized[locale][post._id] = post;

        return post
      })
    }).flat()

    data.posts = posts;
    data.paginationPosts = paginationPosts;
    const postsByLocale = Object.assign({}, paginationPosts.reduce((acc, p) => {
      acc[p.locale] = acc[p.locale] || [];
      acc[p.locale].push(p);
      return acc
    }, {}));
    data.getPosts = (locale) => {
      return postsByLocale[locale];
    }
    data.getPost = (id, locale) => {
      return postMapLocalized[locale][id]
    }

    if (!isPreview) {
      data.sitemaps.push({
        key: 'posts',
        permalink: `/sitemap-posts.xml`,
        data: Object.values(postMapLocalized[defaultLocale]),
      })
    }
    locales.forEach(locale => {
      localizedReferenceMaps[locale].post = postMapLocalized[locale]
    });
  }

  // blog
  if (features.blog && mode === 'normal') {
    const postIds = data.posts.map(p => p._id)
    const blogQuery = buildBlogQuery({fragments, options: {queryOptions: queryOptions.blog, locales, defaultLocale}})
    const blog = await client.fetch(blogQuery);
    const blogPostIdsPaginated = _.chunk(postIds, blog.postsPerPage ?? 10)
    const blogsLocalized = Object.assign({}, ...locales.map(x => ({[x]: []})));
    const paginationBlogs = locales.map(locale => {
        const localeBlog = aggregator.buildBlog(
          blog,
          locale,
          fragments,
          queryOptions.blog?.remove,
          blogPostIdsPaginated,
        )
        blogsLocalized[locale].push(localeBlog);
        return localeBlog
    }).flat()

    data.paginationBlogs = paginationBlogs;
    data.getBlog = (locale) => {
      return blogsLocalized[locale]?.[0];
    }
    data.getBlogs = (locale) => {
      return blogsLocalized[locale];
    }
    locales.forEach(locale => {
      localizedReferenceMaps[locale].blog = Object.assign({}, ...blogsLocalized[locale].map(b => ({[b._id]: b})))
    });
  }

  // menus
  if (mode === 'normal') {
    const menuQuery = buildMenusQuery({fragments, options: {queryOptions: queryOptions.menu, locales, defaultLocale}})
    const menus = await client.fetch(menuQuery);
    const menuMapLocalized = Object.assign({}, ...locales.map(x => ({[x]: {}})));
    locales.forEach(locale => {
      menus.forEach((m, index) => {
        menuMapLocalized[locale][m._id] = aggregator.buildMenu(
          m,
          locale,
          index,
          fragments,
          queryOptions.menu?.remove,
          localizedReferenceMaps
        )
      })
    })
    data.menus = menus;
    data.getMenu = (id, locale) => {
      return menuMapLocalized[locale][id]
    }
    locales.forEach(locale => {
      localizedReferenceMaps[locale].menu = menuMapLocalized[locale]
    });
  }
  
  

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
  return data
}

function getDefaultData(supportedLocales, referenceMaps) {
  const data = {
    supportedLocales,
    paginationProducts: [],
    paginationCategories: [],
    categoryTree: [],
    homeProductIds: [],
    supportedShippingCountryCodes: [],
    paginationPages: [],
    paginationBlogs: [],
    paginationPosts: [],
    sitemaps: [],
    schema: undefined,
    getReferenceMaps(locale) {return referenceMaps[locale]},
    getSiteSettings(locale) {return {}},
    getProducts(locale) {return []},
    getProduct(id, locale) {return undefined},
    getCategories(locale) {return []},
    getBlog(locale) {return undefined},
    getBlogs(locale) {return []},
    getCategory(id, locale) {return undefined},
    getManufacturers(locale) {return []},
    getManufacturer(id, locale) {return undefined},
    getOptionGroup(id, locale) {return undefined},
    getOption(id, locale) {return undefined},
    getTag(id, locale) {return undefined},
    getPages(locale) {return []},
    getPage(id, locale) {return undefined},
    getPosts(locale) {return []},
    getPost(id, locale) {return undefined},
    getMenu(id, locale) {return undefined},
    getSearchData(locale) {return ""},
    getSubCategoryIds(id, locale) {return []},
    getSocialLinks(locale) {return []},
  };
  return data;
} 

const getCategoryTree = (categories) => {
  const categoryMap = {};
  const categoryTree = [];

  // Create a map and initialize categoryIds arrays
  categories.forEach((category) => {
    category.categoryIds = []; // direct children
    categoryMap[category._id] = { _id: category._id, categories: [] };
  });

  // Build structure + fill categoryIds for direct children
  categories.forEach((category) => {
    if (category.parentId === null) {
      // top-level
      categoryTree.push(categoryMap[category._id]);
    } else {
      // direct child → add to parent categoryIds
      const parentCategory = categories.find(c => c._id === category.parentId);
      if (parentCategory) {
        parentCategory.categoryIds.push(category._id);
      }

      // original behavior: add to tree structure
      const parentInTree = categoryMap[category.parentId];
      if (parentInTree) {
        parentInTree.categories.push(categoryMap[category._id]);
      }
    }
  });

  return categoryTree;
};