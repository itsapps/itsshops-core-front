import type { CoreContext } from "../types";
import { sanityPicture, staticPicture } from "../image";

export const createShortcodes = (ctx: CoreContext) => {
  const { eleventyConfig, imageBuilder } = ctx

  eleventyConfig.addShortcode("sanityPicture", (image, size, options) =>
    sanityPicture(imageBuilder, image, size, options)
  )

  eleventyConfig.addAsyncShortcode("staticPicture", staticPicture)
}
