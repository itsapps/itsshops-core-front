import * as path from 'node:path'
import type { CoreContext } from "../types";
import { image, preload, staticImage, staticPreload, preGenerateStaticImages, type PictureSize, type PictureOptions } from "../image";

export const createShortcodes = (ctx: CoreContext) => {
  const { eleventyConfig, imageBuilder, config, imageSizes } = ctx

  const inputDir = eleventyConfig.directories?.input ?? 'src'
  const staticDir = path.join(process.cwd(), inputDir, 'assets/images/static')
  
  // build static images before building
  if (!config.preview?.enabled) {
    eleventyConfig.on('eleventy.before', async () => {
      await preGenerateStaticImages(staticDir, imageSizes)
    })
  }

  // image shortcodes
  eleventyConfig.addShortcode("image", (img, size, options) =>
    image(imageBuilder, img, size, options)
  )
  eleventyConfig.addShortcode("preload", (img, size, options) =>
    preload(imageBuilder, img, size, options)
  )
  eleventyConfig.addShortcode("staticImage", (filename: string, size: PictureSize, options: PictureOptions) =>
    staticImage(path.join(staticDir, filename), size, options)
  )
  eleventyConfig.addShortcode("staticPreload", (filename: string, size: PictureSize) =>
    staticPreload(path.join(staticDir, filename), size)
  )
}
