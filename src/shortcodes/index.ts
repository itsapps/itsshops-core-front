import * as path from 'node:path'
import type { CoreContext } from "../types";
import { sanityPicture, staticPicture, preGenerateStaticImages, type PictureSize, type PictureOptions } from "../image";

export const createShortcodes = (ctx: CoreContext) => {
  const { eleventyConfig, imageBuilder, config, imageSizes } = ctx

  eleventyConfig.addShortcode("sanityPicture", (image, size, options) =>
    sanityPicture(imageBuilder, image, size, options)
  )

  if (!config.preview?.enabled) {
    eleventyConfig.on('eleventy.before', async () => {
      const inputDir = eleventyConfig.directories?.input ?? 'src'
      const staticDir = path.join(process.cwd(), inputDir, 'assets/images/static')
      await preGenerateStaticImages(staticDir, imageSizes)
    })
  }

  eleventyConfig.addShortcode("staticPicture", (src: string, size: PictureSize, options: PictureOptions) =>
    staticPicture(src, size, options)
  )
}
