import Image from '@11ty/eleventy-img';
import path from 'path';

const aspectRatio = 9/16
const sizeMapTypes = {
  square: 1,
  landscape: 2,
  portrait: 3,
  dynamicHeight: 4,
}
const sizeMap = {
  [sizeMapTypes.portrait]: {
    sizeType: sizeMapTypes.portrait,
    toSizes: (sizes, ratio) => sizes.map(size => [size, Math.round(size/ratio)]),
    placeholderSize: (ratio) => [Math.round(500*ratio), 500],
  },
  [sizeMapTypes.landscape]: {
    sizeType: sizeMapTypes.landscape,
    toSizes: (sizes, ratio) => sizes.map(size => [Math.round(size/ratio), size]),
    placeholderSize: (ratio) => [Math.round(500/ratio), 500],
  },
  [sizeMapTypes.square]: {
    sizeType: sizeMapTypes.square,
    toSizes: (sizes, ratio) => sizes.map(size => [size, size]),
    placeholderSize: (ratio) => [500, 500],
  },
  [sizeMapTypes.dynamicHeight]: {
    sizeType: sizeMapTypes.dynamicHeight,
    toSizes: (sizes, ratio) => sizes.map(size => [size, null]),
    placeholderSize: (ratio) => [500, null],
  },
}

const toPictureSize = (sizes, ratio, sizeType, widths) => {
  return {
    sizeType,
    sizes: sizeMap[sizeType].toSizes(sizes, ratio),
    widths,
    placeholderSize: sizeMap[sizeType].placeholderSize(ratio)
  }
}

export const pictureSizes = {
  productDetail: toPictureSize([500, 1000, 1500, 2000], 1, sizeMapTypes.square, "(min-width: 40em) 50vw, 100vw"),
  productCard: toPictureSize([200, 400, 800], 1, sizeMapTypes.square, "33vw"),
  genericColumn: toPictureSize([500, 1000, 1500], 1, sizeMapTypes.square, "100vw"),
  dynamicFullscreen: toPictureSize([500, 1000, 1500], 1, sizeMapTypes.dynamicHeight, "100vw"),
  heroImage: toPictureSize([500, 1000, 1500], 1, sizeMapTypes.dynamicHeight, "(min-width: 40em) 50vw, 100vw"),
  fullscreen: toPictureSize([800, 1000, 1500], aspectRatio, sizeMapTypes.landscape, "100vw"),
  productMedium: toPictureSize([200, 400, 600], 1, sizeMapTypes.square, "200px"),
  productSmall: toPictureSize([100, 200, 300], 1, sizeMapTypes.square, "100px"),
  productXS: toPictureSize([50, 100, 150], 1, sizeMapTypes.square, "50px"),
  blogLoop: toPictureSize([400, 800, 1200], 1, sizeMapTypes.square, "400px"),
}

const placeholderImage = async (isPreview, outputDir, src, imgSizes, formats=["webp", "jpg"]) => {
  const urlPath = '/assets/images/placeholders/';
  let metadata = await Image(src, {
    widths: imgSizes.map(size => size[0]),
    formats,
    urlPath,
    ...isPreview && {urlFormat: function ({hash, src, width, format}) {return "";}},//dont build files when previewing
    ...!isPreview && {outputDir: path.join(outputDir, urlPath)},
    // Custom Image Filename
    filenameFormat: function (id, src, width, format, options) {
      const extension = path.extname(src);
      const name = path.basename(src, extension);

      return `${name}-${width}w.${format}`;
    }
  });
  return Object.values(metadata);
};

const createPlaceholderImages = async (isPreview, outputDir, sizeTypePlaceholderSources) => {
  const dict = {};
  for (const [key, value] of Object.entries(pictureSizes)) {
    dict[key] = {
      meta: await placeholderImage(isPreview, outputDir, sizeTypePlaceholderSources[value.sizeType], value.sizes),
      sizes: value.sizes,
      widths: value.widths,
      placeholderSize: value.placeholderSize
    };
  }
  return dict
}

export async function createImageSettings(isPreview, coreAssetDir, outputDir, placeholders) {
  const placeholderDir = path.join(coreAssetDir, "images", "placeholders");
  const placeholderSquare = path.join(placeholderDir, "product_placeholder_square.jpg");
  const placeholderLandscape = path.join(placeholderDir, "product_placeholder_landscape.jpg");
  const placeholderPortrait = path.join(placeholderDir, "product_placeholder_portrait.jpg");

  const sizeTypePlaceholderSources = {
    [sizeMapTypes.square]: placeholders.square || placeholderSquare,
    [sizeMapTypes.landscape]: placeholders.landscape || placeholderLandscape,
    [sizeMapTypes.portrait]: placeholders.portrait || placeholderPortrait,
    [sizeMapTypes.dynamicHeight]: placeholders.square || placeholderSquare,
  }
  return await createPlaceholderImages(isPreview, outputDir, sizeTypePlaceholderSources)
}