import { slugify, getUniqueSlug, getSanitySeo } from "../../utils/utils.mjs";
import { homePermalink, blogPostPermalink } from "../../shared/urlPaths.mjs";

export function buildPost(
  p,
  locale,
  index,
  fragments,
  remove,
  slugSet,
  homeId,
  localizers,
  imageUrls,
  imageSeo,
  buildHook
) {
  const {
    getLocalizedValue,
    getLocalizedImage,
    translate,
  } = localizers;
  const isHome = p._id == homeId;

  const title = getLocalizedValue(p, "title", locale)
  const preview = getLocalizedValue(p, "preview", locale)
  // const {modules, description} = createModules(p.modules, locale);
  const modules = []
  const description = "laksjd"
  const image = p.image ? getLocalizedImage(p.image, locale) : null

  const {
    metaTitle,
    metaDescription,
    shareTitle,
    shareDescription,
    shareImage,
    keywords,
  } = getSanitySeo(title, description, p.seo, locale, localizers);
  const seoImage = shareImage ? imageSeo(shareImage, shareTitle) : {url: "", alt: ""}
  const postSlug = getLocalizedValue(p, "slug", locale);
  const baseSlug = slugify(postSlug ? postSlug.current : title)
  const slug = getUniqueSlug(baseSlug, slugSet);

  const post = {
    _id: p._id,
    _type: p._type,
    _createdAt: p._createdAt,
    _updatedAt: p._updatedAt,
    title,
    preview: preview || shareDescription || metaDescription || description,
    image,
    metaTitle,
    metaDescription,
    shareTitle,
    shareDescription,
    shareImage: seoImage.url,
    shareImageAlt: seoImage.alt,
    seoKeywords: keywords,
    
    locale: locale,
    permalink: isHome ? homePermalink(locale) : blogPostPermalink(locale, translate, slug),
    eleventyPaginationGroupNumber: index,
    isHome,
    modules,
  }
  // find image for preload and other
  // post.preloadImage = moduleInfo.preloadImage

  return {
    ...post,
    ...buildHook && buildHook(p, { locale, localizers, translate })
  }
}