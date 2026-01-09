import { slugifyString, getUniqueSlug } from "../../utils/slugify.mjs";
import { getSanitySeo } from "../../utils/utils.mjs";
import { homePermalink, pagePermalink } from "../../shared/urlPaths.mjs";

export function buildPage(
  p,
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
  buildPage
) {
  const {
    getLocalizedValue,
    getLocalizedObject,
    getLocalizedImage,
    localizeMoney,
  } = localeUtils;
  
  const title = getLocalizedValue(p, "title", locale)
  // const {modules, description} = createModules(p.modules, locale);
  const modules = []
  const description = "laksjd"

  const {
    metaTitle,
    metaDescription,
    shareTitle,
    shareDescription,
    shareImage,
  } = getSanitySeo(title, description, p.seo, locale, localeUtils);
  const images = shareImage ? [shareImage] : []
  const seoImage = shareImage ? imageSeo(shareImage, shareTitle) : {url: "", alt: ""}
  const pageSlug = getLocalizedValue(p, "slug", locale);
  const baseSlug = slugifyString(pageSlug ? pageSlug.current : title)
  const slug = getUniqueSlug(baseSlug, slugSet);

  const page = {
    _id: p._id,
    _type: "page",
    _createdAt: p._createdAt,
    _updatedAt: p._updatedAt,
    title,
    description,
    metaTitle,
    metaDescription,
    shareTitle,
    shareDescription,
    shareImage: seoImage.url,
    shareImageAlt: seoImage.alt,
    
    locale: locale,
    permalink: isHome ? homePermalink(locale) : pagePermalink(locale, slug),
    eleventyPaginationGroupNumber: index,
    isHome,
    isShop,
    modules,
  }
  // find image for preload and other
  page.preloadImage = p.modules?.[0]?.backgroundImage
  if (page.preloadImage) {
    images.push(page.preloadImage)
  }
  page.images = images

  return {
    ...page,
    ...buildPage && buildPage(p, { locale, localeUtils, translate })
  }
}