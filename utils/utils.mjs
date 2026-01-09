export const getSanitySeo = (title, description, seo, locale, localeUtils) => {
  const metaTitle = seo ? (seo.metaTitle ? localeUtils.getLocalizedValue(seo, "metaTitle", locale) : title) : title;
  const shareTitle = seo ? (seo.shareTitle ? localeUtils.getLocalizedValue(seo, "shareTitle", locale) : metaTitle) : metaTitle;
  const metaDescription = (seo ? (seo.metaDescription ? localeUtils.getLocalizedValue(seo, "metaDescription", locale) : description) : description);
  const shareDescription = (seo ? (seo.shareDescription ? localeUtils.getLocalizedValue(seo, "shareDescription", locale) : metaDescription) : metaDescription);
  const shareImage = seo?.shareImage;
  
  return {
    metaTitle: (metaTitle || "").replace(/[\r\n\t]+/g, ' '),
    shareTitle: (shareTitle || "").replace(/[\r\n\t]+/g, ' '),
    metaDescription: metaDescription ? metaDescription.slice(0, 160).replace(/[\r\n\t]+/g, ' ') : "",
    shareDescription: shareDescription ? shareDescription.slice(0, 160).replace(/[\r\n\t]+/g, ' ') : "",
    shareImage,
    keywords: localeUtils.getLocalizedValue(seo, "keywords", locale) || "",
  }
}

export const getExcerpt = (portableText) => {
  if (!portableText) return {text: '', images: []};
  let texts = [];
  const images = [];

  for (const block of portableText) {
    if (block.children) {
      for (const child of block.children) {
        if (child.text) {
          // replace newlines/tabs with spaces
          const clean = child.text.replace(/[\r\n\t]+/g, ' ').trim();
          if (clean) {
            texts.push(clean);
          }
        }
      }
    } else if (block._type === 'customImage') {
      images.push(block);
    }
  }

  return {text: texts.join(' ').slice(0, 200).trim(), images};
};
