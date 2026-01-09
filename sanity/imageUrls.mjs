// sanity/imageUrls.mjs
export const createSanityImageUrls = ({ imageBuilder }) => {
  const imageMIMETypes = {
    webp: "image/webp",
    jpg: "image/jpeg",
    png: "image/png"
  }

  return function sanityImageUrls(
    image,
    {
      sizes = [[100, 100]],
      formats = ["webp", "jpg"]
    } = {}
  ) {
    if (!image?.asset?.dimensions) return [];

    const metadata = [];
    formats.forEach(format => metadata.push( 
      sizes.map((size) => {
        const width = size[0];
        const height = (size[1] === null) ? Math.floor(width/image.asset.dimensions.aspectRatio) : Math.floor(size[1]);
        let builder = imageBuilder.image(image)
          .format(format)
          .width(width)
          .height(height)
        // if (!isNearSquare(image.asset.dimensions.aspectRatio)) {
        //   builder = builder.ignoreImageParams()
        //     .fit("fill")
        //     .bg("fff");
        // }
        const url = builder.url();
        return {
          format: format,
          width: width,
          height: height,
          url: url,
          sourceType: imageMIMETypes[format],
          srcset: `${url} ${width}w`,
        }
      })
    ))

    return metadata;
  };
};

export const createSanityImageSeo = ({ sanityImageUrls }) => {
  return function sanityImageSeo(image, alt) {
    const metadata = sanityImageUrls(image, {sizes: [[1200, 630]], formats: ["jpg"]});
    if (!metadata) {
      return {url: "", alt: ""};
    }
    const url = metadata[0][0].url;
    const imageAlt = image.alt ?? image.title;
    return {url: url, alt: alt || imageAlt || ""};
  };
}