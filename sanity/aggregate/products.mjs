import { slugifyString, getUniqueSlug, uniqueFilteredArray, uniqueShuffeledStrings } from "../../utils/slugify.mjs";
import { getSanitySeo, getExcerpt } from "../../utils/utils.mjs";
import { productPermalink } from "../../shared/urlPaths.mjs";

const ProductTypes = {
  SANITY_PRODUCT: 1,
  SANITY_PRODUCT_VARIANT: 2
}

export function expandProduct(
  p,
  { remove, fragments },
  optionToGroupMap,
  sortOrderMapGroups,
  sortOrderMapGroupOptions,
  expand
) {
  // if variants are null, the product has no variants and is a standalone product
  const isSingleProduct = (p.variants === null || p.variants.length === 0);
  if (isSingleProduct) {
    var product = {
      // base fields
      _id: p._id,
      _type: p._type,
      type: ProductTypes.SANITY_PRODUCT,
      _updatedAt: p._updatedAt,
      title: p.title,
      parentId: null,
      price: p.price || 0,
      compareAtPrice: p.compareAtPrice,
      categoryIds: p.categoryIds || [],
      optionIds: [],
      otherVariantIds: [],
      optionGroupIds: [],
      allOptionGroups: [],
      addToSearch: true,

      // optional fields (handle not-removed fields)
      ...!('seo' in remove) && {seo: p.seo},
      ...!('productNumber' in remove) && {productNumber: p.productNumber},
      ...!('description' in remove) && {description: p.description},
      ...!('images' in remove) && {images: p.images},
      ...!('manufacturerId' in remove) && {manufacturerId: p.manufacturerId},
      ...!('stock' in remove) && {stock: Math.max(0, (p.stock != null ? p.stock : 0))},
      ...!('tagIds' in remove) && {tagIds: p.tagIds || []},

      // expand product callback
      ...(expand && expand(p, { fragments }))
    };

    // product.categoryIds.forEach(catId => {
    //   const category = categoriesMap[catId];
    //   category.productIds.push(product._id);
    //   if (category.parentId) {
    //     const parentCategory = categoriesMap[category.parentId];
    //     if (!parentCategory.productIds.includes(product._id)) {
    //       parentCategory.productIds.push(product._id);
    //     }
    //   }
    // })
    return [product];
  } else {
    const involvedOptionGroups = {};
    const variantProducts = p.variants.filter(v => v.active != false).map(v => {;
      const description = (v.description && v.description.length > 0) ? v.description : p.description;
      const productImages = p.images || [];
      const variantImages = v.images || [];
      
      function getImages() {
        if (variantImages.length > 0) {
          return variantImages;
        } else {
          if (v.coverImage && productImages.length > 0) {
            const firstImage = productImages.find(image => image.asset._id === v.coverImage);
            if (firstImage) {
              return [firstImage, ...productImages.filter(image => image.asset._id !== v.coverImage)];
            }
          }
          return productImages;
        }
      }
      
      var product = {
        _id: v._id,
        _type: v._type,
        type: ProductTypes.SANITY_PRODUCT_VARIANT,
        _updatedAt: v._updatedAt,
        parentId: p._id,
        title: v.title || p.title,
        price: v.price || p.price || 0,
        compareAtPrice: v.compareAtPrice || p.compareAtPrice,
        categoryIds: ((v.categoryIds || p.categoryIds) || []),
        optionIds: (v.options || []),
        otherVariantIds: [],
        optionGroupIds: [],
        allOptionGroups: [],
        addToSearch: v.featured,

        ...!('seo' in remove) && {seo: v.seo || p.seo},
        ...!('productNumber' in remove) && {productNumber: v.productNumber || p.productNumber},
        ...!('description' in remove) && {description: description},
        ...!('images' in remove) && {images: getImages()},
        ...!('manufacturerId' in remove) && {manufacturerId: (v.manufacturerId || p.manufacturerId)},
        ...!('stock' in remove) && {stock: Math.max(0, (v.stock != null ? v.stock : 0))},
        ...!('tagIds' in remove) && {tagIds: ((v.tagIds || p.tagIds) || [])},

        // expand product callback
        ...(expand && expand(v, { fragments }))
      };

      // find optionGroups for this variant
      const optionsByGroup = []
      v.options.forEach(o => {
        const optionGroupId = optionToGroupMap[o];
        if (!Object.keys(involvedOptionGroups).includes(optionGroupId)) {
          involvedOptionGroups[optionGroupId] = [];
        }
        if (!involvedOptionGroups[optionGroupId].includes(o)) {
          involvedOptionGroups[optionGroupId].push(o);
        }

        optionsByGroup.push({
          groupId: optionGroupId,
          optionId: o,
        })
      })
      //sort options by group
      const actualOptionGroups = optionsByGroup.sort((id1, id2) => {
        return sortOrderMapGroups[id1.groupId] - sortOrderMapGroups[id2.groupId]
      });
      product.optionIds = actualOptionGroups.map(o => o.optionId);
      return product;
    })
    if (variantProducts.length == 0) {
      return [];
    }
    
    // sort options groups and options and add to all variant products for a list of all involved optionGroups and their options
    const sortedGroups = [];
    Object.keys(involvedOptionGroups).forEach(g => {
      const sortOrderMap = sortOrderMapGroupOptions[g];
      const sorted = [...involvedOptionGroups[g]].sort((id1, id2) => sortOrderMap[id1] - sortOrderMap[id2]);
      sortedGroups.push({
        groupId: g,
        options: sorted
      })
    })
    const actualOptionGroups = [...sortedGroups].sort((id1, id2) => sortOrderMapGroups[id1.groupId] - sortOrderMapGroups[id2.groupId]);

    // cartesian product
    const maxVariants = actualOptionGroups.reduce((total, group) => total * group.options.length, 1);
    const hasMissingVariants = maxVariants > variantProducts.length;
    // add other variants of the same product to each variant
    for (var i = 0; i < variantProducts.length; i++) {
      const currentVariant = variantProducts[i];
      currentVariant.hasMissingVariants = hasMissingVariants
      const otherVariants = variantProducts.filter(v => v._id !== currentVariant._id);
      currentVariant.otherVariantIds = otherVariants.map(v => v._id);
      currentVariant.allVariantIds = variantProducts.map(v => v._id);
      // add all optionGroups to the variant
      currentVariant.optionGroupIds = involvedOptionGroups;
      // find variant for each option, set if it is the current variant option
      const currentVariantOptionGroups = JSON.parse(JSON.stringify(actualOptionGroups));
      // const currentVariantOptionGroups = [...actualOptionGroups];
      for (var g = 0; g < actualOptionGroups.length; g++) {
        const optionGroup = actualOptionGroups[g];
        const options = optionGroup.options;
        const selectedOptionToReplace = currentVariant.optionIds.find(o => options.includes(o));
        const otherSelectedOptions = currentVariant.optionIds.filter(o => o != selectedOptionToReplace);
        const foundOptionGroup = currentVariantOptionGroups[g];
        for (var o = 0; o < options.length; o++) {
          const option = options[o];
          const optionsToSearchFor = new Set(otherSelectedOptions);
          optionsToSearchFor.add(option);
          const foundVariant = otherVariants.find(v => {
            const result = v.optionIds.filter(vo => optionsToSearchFor.has(vo))
            return result.length == optionsToSearchFor.size
          });
          const isSelectedOption = (option === selectedOptionToReplace);
          foundOptionGroup.options[o] = {
            optionId: option,
            variantId: foundVariant ? foundVariant._id : (isSelectedOption ? currentVariant._id : undefined),
            selected: isSelectedOption,
          }
        }
      }
      // set allOptionGroups
      currentVariant.allOptionGroups = currentVariantOptionGroups;
    }

    // const mainVariant = variantProducts.find(v => v.addToSearch);
    // const actualMainVariant = mainVariant ?? variantProducts[0];
    // actualMainVariant.addToSearch = true;

    // actualMainVariant.categoryIds.forEach(catId => {
    //   const category = categoriesMap[catId];
    //   category.productIds.push(actualMainVariant._id);
    //   if (category.parentId) {
    //     const parentCategory = categoriesMap[category.parentId];
    //     if (!parentCategory.productIds.includes(actualMainVariant._id)) {
    //       parentCategory.productIds.push(actualMainVariant._id);
    //     }
    //   }
    // })
    return variantProducts;
  }
}

export function buildProduct(
  p,
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
  buildProduct
) {
  const {
    getLocalizedValue,
    getLocalizedImage,
    localizeMoney,
  } = localeUtils;
  
  const title = getLocalizedValue(p, "title", locale) || "No Title";
  const description = getLocalizedValue(p, "description", locale) || [];
  const localizedImages = (p.images || []).map(image => getLocalizedImage(image, locale));
  const optionsString = p.optionIds
    .map(optionId => optionMapLocalized[locale][optionId]?.title)
    .join(" / ");
  const titleWithOptions = `${title}${optionsString ? ` | ${optionsString}` : ""}`

  const {
    metaTitle,
    metaDescription,
    shareTitle,
    shareDescription,
    shareImage,
    keywords
  } = getSanitySeo(titleWithOptions, getExcerpt(description).text, p.seo, locale, localeUtils);
  const seoImage = (shareImage || localizedImages.length > 0) ? imageSeo(shareImage || localizedImages[0]) : {url: "", alt: ""}
  // const seoImage = {url: "", alt: ""}

  const baseSlug = slugifyString(`${title}${optionsString ? `-${optionsString}` : ""}`)
  const slug = getUniqueSlug(baseSlug, slugSet);

  const product = {
    ...p,
    permalink: productPermalink(locale, translate, slug),
    title,
    optionsString,
    titleWithOptions,
    description,
    metaTitle,
    metaDescription,
    shareTitle,
    shareDescription,
    shareImage: seoImage.url,
    shareImageAlt: seoImage.alt,
    images: localizedImages,
    slug,
    seoKeywords: keywords,
    // relatedProducts: uniqueShuffeledStrings(
    //   p.categoryIds.map(catId => categoriesMap[catId].productIds).flat(),
    //   p._id,
    //   maxProductLoopItems
    // ),
    // otherProducts: uniqueShuffeledStrings(
    //   _.shuffle([...categories]).splice(0, 4).map(cat => cat.productIds).flat(),
    //   p._id,
    //   maxProductLoopItems
    // ),
    locale,
    eleventyPaginationGroupNumber: index,
    priceString: localizeMoney(p.price/100 || 0, locale),
    ...p.compareAtPrice && {compareAtPriceString: localizeMoney(p.compareAtPrice/100, locale)},
    allOptionGroups: p.allOptionGroups.map(group => {
      return {
        ...group,
        title: optionGroupMapLocalized[locale][group.groupId].title,
        options: group.options.map(option => {
          return {
            ...option,
            title: optionMapLocalized[locale][option.optionId].title,
          }
        })
      }
    }),
  }
  return {
    ...product,
    ...buildProduct && buildProduct(p, { locale, localeUtils, translate})
  }
}