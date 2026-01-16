
const imageMIMETypes = {
  webp: "image/webp",
  jpg: "image/jpeg",
  png: "image/png"
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

export const sanityReplaceableImageUrl = (imageUrls, image, pictureSize) => {
  const size = pictureSize?.placeholderSize || [100, 100];
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

export const pictureFromData = ({
  metadata,
  title="",
  alt="",
  fallbackAlt="",
  pictureClassNames="",
  imageClassNames="",
  loading="eager",
  widths='100vw',
  dataAttributes={}
}) => {
  // let lowsrc = metadata[metadata.length-1][0];
  // use webp version
  let lowsrc = metadata[0][0];
  const picture = `
    <picture
      ${pictureClassNames ? ` class="${pictureClassNames}"` : ''}
      ${dataAttributes ? Object.entries(dataAttributes).map(([key, value]) => `data-${key}="${value}"`).join(' ') : ''}
    >
      ${metadata
        .map(imageFormat => {
          return `
            <source
              type="${imageFormat[0].sourceType}"
              srcset="${imageFormat.map(entry => entry.srcset).join(',')}"
              sizes="${widths}"
            >`;
        }).join('')}
      <img
        ${imageClassNames ? ` class="${imageClassNames}"` : ''}
        src="${lowsrc.url}"
        width="${lowsrc.width}"
        height="${lowsrc.height}"
        ${title ? `title="${title}"` : ''}
        ${alt || fallbackAlt ? `alt="${alt  || fallbackAlt}"` : ''}
        loading="${loading}"
        decoding="${loading === 'eager' ? 'sync' : 'async'}">
    </picture>`;

  return picture;
}

export const sanityPicture = ({
  imageUrls,
  image,
  fallbackAlt,
  pictureSize,
  pictureClassNames,
  imageClassNames,
  loading,
}) => {
  const metadata = imageUrls(image, {sizes: pictureSize.sizes});
  if (!metadata) {
    return "";
  }
  return pictureFromData({
    metadata,
    title: image.title,
    alt: image.alt,
    fallbackAlt,
    pictureClassNames,
    imageClassNames,
    loading,
    widths: pictureSize.widths,
  });
}

export const placeholderPicture = ({
  pictureSize,
  title,
  alt,
  fallbackAlt,
  pictureClassNames,
  imageClassNames,
  loading
}) => {
  if (!pictureSize) {
    return "";
  }
  return pictureFromData({
    metadata: pictureSize.meta,
    title,
    alt,
    fallbackAlt,
    pictureClassNames,
    imageClassNames,
    loading,
    widths: pictureSize.widths
  });
}