import { getSanitySeo, getExcerpt } from "../../utils/utils.mjs";
import { blogPermalink } from "../../shared/urlPaths.mjs";

export function buildBlog(
  b,
  locale,
  fragments,
  remove,
  blogPostIdsPaginated,
  localizers,
  imageUrls,
  imageSeo,
  buildHook
) {
  const {
    getLocalizedValue,
  } = localizers;
  
  const title = getLocalizedValue(b, "title", locale) || localizers.translate('dynamicPages.blogPosts.title', {}, locale)
  const description = getLocalizedValue(b, "description", locale)
  const seo = b.seo || {}

  const {
    metaTitle,
    metaDescription,
    shareTitle,
    shareDescription,
    shareImage,
    keywords,
  } = getSanitySeo(title, getExcerpt(description).text, seo, locale, localizers);
  const seoImage = shareImage ? imageSeo(shareImage, shareTitle) : {url: "", alt: ""}
  
  return blogPostIdsPaginated.map((pIds, i) => {
    const pageIndex = i + 1
    const pageText = localizers.translate('dynamicPages.blogPosts.pagination.page', {page: pageIndex}, locale)
    const blog = {
      _id: b._id + (i ? `-page${pageIndex}` : ""),
      permalink: blogPermalink(locale, localizers.translate, i),
      eleventyPaginationGroupNumber: i,
      key: `blog-${pageIndex}`,
      locale: locale,
      title,
      metaTitle,
      metaDescription: metaDescription ? `${metaDescription} - ${pageText}` : pageText,
      shareTitle,
      shareDescription,
      shareImage,
      shareImage: seoImage.url,
      shareImageAlt: seoImage.alt,
      seoKeywords: keywords,
      postIds: pIds,
      pagination: {
        current: i,
        total: blogPostIdsPaginated.length+1,
        next: i < blogPostIdsPaginated.length-1 ? blogPermalink(locale, localizers.translate, i+1) : undefined,
        prev: i > 0 ? blogPermalink(locale, localizers.translate, i-1) : undefined
      }
    }

    return {
      ...blog,
      ...buildHook && buildHook(b, { locale, localizers })
    }
  })
}