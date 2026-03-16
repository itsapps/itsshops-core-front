import type { CoreContext } from "../types";
import { sanityPicture } from "../media";

export const createShortcodes = (ctx: CoreContext) => {
  const { eleventyConfig, imageBuilder } = ctx

  eleventyConfig.addShortcode("sanityPicture", (image, size, options) =>
    sanityPicture(imageBuilder, image, size, options)
  )
}
