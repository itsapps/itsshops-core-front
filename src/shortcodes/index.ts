import * as path from 'node:path'
import type { CoreContext } from "../types";
import { image, preload, staticImage, staticPreload, preGenerateStaticImages, vinofactImage, type PictureSize, type PictureOptions } from "../image";
import { renderGallery, type GalleryOptions } from "../gallery/render";

export const createShortcodes = (ctx: CoreContext) => {
  const { eleventyConfig, imageBuilder, config, imageSizes, translate } = ctx

  const inputDir = eleventyConfig.directories?.input ?? 'src'
  const staticDir = path.join(process.cwd(), inputDir, 'assets/images/static')
  
  // build static images before building
  if (!config.preview.enabled) {
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
  eleventyConfig.addShortcode("vinofactImage", ((image: any, size: PictureSize, options?: PictureOptions) =>
    vinofactImage(image, size, options)
  ) as any)

  // Lightbox gallery: { gallery images, size, options }
  eleventyConfig.addShortcode("gallery", function (this: any, images: any[], size: PictureSize, options: GalleryOptions = {}) {
    const locale = this?.page?.lang || config.defaultLocale
    const t = (k: string) => translate(`gallery.${k}`, {}, locale)
    const chrome = { view: t('view'), close: t('close'), prev: t('previous'), next: t('next'), download: t('download'), dialog: t('carousel') }
    return renderGallery(imageBuilder, images, size, options, chrome)
  } as any)
}
