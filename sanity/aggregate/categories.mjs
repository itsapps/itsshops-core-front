import { slugify, getUniqueSlug, getSanitySeo } from "../../utils/utils.mjs";
import { categoryPermalink } from "../../shared/urlPaths.mjs";

export function buildCategory(
  c,
  locale,
  index,
  fragments,
  remove,
  slugSet,
  localizers,
  imageUrls,
  imageSeo,
  buildHook
) {
  const {
    getLocalizedValue,
    getLocalizedImage,
  } = localizers;
  
  const title = getLocalizedValue(c, "title", locale)
  const description = getLocalizedValue(c, "description", locale)
  const image = c.image ? getLocalizedImage(c.image, locale) : null

  const {
    metaTitle,
    metaDescription,
    shareTitle,
    shareDescription,
    shareImage,
    keywords,
  } = getSanitySeo(title, description, c.seo, locale, localizers);
  const seoImage = shareImage ? imageSeo(shareImage, shareTitle) : (image ? imageSeo(image, shareTitle) : {url: "", alt: ""})

  const baseSlug = slugify(title)
  const slug = getUniqueSlug(baseSlug, slugSet);

  const category = {
    _id: c._id,
    _type: c._type,
    slug,
    _createdAt: c._createdAt,
    _updatedAt: c._updatedAt,
    title,
    description,
    image,
    metaTitle,
    metaDescription,
    shareTitle,
    shareDescription,
    shareImage: seoImage.url,
    shareImageAlt: seoImage.alt,
    seoKeywords: keywords,
    categoryIds: c.categoryIds,
    productIds: c.productIds,
    
    locale: locale,
    permalink: categoryPermalink(locale, localizers.translate, slug),
    eleventyPaginationGroupNumber: index,
  }
  // find image for preload and other
  return {
    ...category,
    ...buildHook && buildHook(c, { locale, localizers })
  }
}