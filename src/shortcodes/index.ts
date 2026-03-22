import type { CoreContext } from "../types";
import { sanityPicture, staticPicture, type PictureSize, type PictureOptions } from "../image";

export const createShortcodes = (ctx: CoreContext) => {
  const { eleventyConfig, imageBuilder, config } = ctx

  eleventyConfig.addShortcode("sanityPicture", (image, size, options) =>
    sanityPicture(imageBuilder, image, size, options)
  )

  const isPreview = config.preview?.enabled === true
  eleventyConfig.addAsyncShortcode("staticPicture", (src: string, size: PictureSize, options: PictureOptions) =>
    staticPicture(src, size, options, isPreview)
  )
}
