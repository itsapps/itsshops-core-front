
export default function seo({image}) {
  return `
    metaTitle,
    metaDescription,
    shareTitle,
    shareDescription,
    "shareImage": shareImage[defined(asset)] {${image}}
  `;
}
