import Image from '@11ty/eleventy-img';
import path from 'path';

const imageMIMETypes = {
  webp: "image/webp",
  jpg: "image/jpeg",
  png: "image/png"
}

export function createMediaTools(imageBuilder, isPreview) {
  const imageUrls = (image, options) => {
    return sanityImageUrls(imageBuilder, image, options);
  }
  const imageSchema = (image) => sanityImageSchema(imageUrls, image);
  
  return {
    imageUrls,
    // imageUrls: (image, options) => imageUrls(image, options),
    imageSeo: (image, alt) => sanityImageSeo(imageUrls, image, alt),
    imageSchema,
    imagePreload: (image, pictureSize) => sanityImagePreload(imageUrls, image, pictureSize),
    replaceableImageUrl: (image, placeholder) => sanityReplaceableImageUrl(imageUrls, image, placeholder),
    createDataAttribute: (id, type, path) => createDataSanity(!isPreview, id, type, path),
    stega: (text) => stega(!isPreview, text),
  }
}

export function sanityImageUrls(
  imageBuilder,
  image,
  {
    sizes = [[100, 100]],
    formats = ["webp", "jpg"]
  } = {}
) {
  if (!image) {
    return [];
  }

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
}

export function sanityImageSeo(imageUrls, image, alt) {
  const metadata = imageUrls(image, {sizes: [[1200, 630]], formats: ["jpg"]});
  if (metadata.length === 0) {
    return {url: "", alt: ""};
  }
  const url = metadata[0][0].url;
  const imageAlt = image.alt ?? image.title;
  return {url: url, alt: alt || imageAlt || ""};
}

export function sanityImageSchema(imageUrls, image) {
  const ratios = [[1,1], [4,3], [16,9]];
  const width = 1200;
  const sizes = ratios.map(ratio => [width, (width*ratio[1])/ratio[0]])
  const metadata = imageUrls(image, {sizes: sizes, formats: ["jpg"]});
  if (metadata.length === 0) {
    return "";
  }
  const images = metadata[0].map(entry => entry.url);
  return images;
}

export const sanityReplaceableImageUrl = (imageUrls, image, placeholder) => {
  const size = placeholder?.placeholderSize || [100, 100];
  const metadata = imageUrls(image, {sizes: [size], formats: ["jpg"]});
  if (metadata.length === 0) {
    return "";
  }
  const url = metadata[0][0].url
    .replace(`w=${size[0]}`, 'w={width}')
    .replace(`h=${size[1]}`, 'h={height}')
    .replace('fm=jpg', 'fm={format}')
    // .replace(`${size[0]}w`, '{width}w');

  return url;
  // return JSON.stringify([preload]);
}

export const sanityImagePreload = (imageUrls, image, pictureSize) => {
  const metadata = imageUrls(image, {sizes: pictureSize.sizes});
  if (!metadata) {
    return "";
  }
  const preload = {
    as: "image",
    imagesrcset: metadata[0].map(entry => entry.srcset).join(', '),
    imagesizes: pictureSize.widths,
    crossorigin: false
  };
  return preload;
}