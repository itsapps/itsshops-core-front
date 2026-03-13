export * from './types'
export * from './data/types'
export * as projections from './data/projections'
export { resolveString, resolveImage, resolveLocaleAltImage, resolveBaseImage } from './data/locale'
export { resolvePortableText } from './data/portableText'
export { sanityPicture, imageUrl } from './media'
export type { PictureSize } from './media'

import type { Config } from './types'
import { setIgnores } from './config/debug'
import { loadTemplates } from './config/templates'
import { createFilters } from './filters'
import { createSanityClient, createPreviewClient } from './core'
import { cssConfig } from './config/css'
import { buildPermalinkTranslations } from './i18n/permalinks'
import { buildCmsData } from './data/resolver'

export const shopCoreFrontendPlugin = async (eleventyConfig: any, config: Config) => {
  const isPreview = config.preview?.enabled ?? false
  const permalinks = buildPermalinkTranslations(config.permalinks)

  // Eleventy setup
  setIgnores(eleventyConfig)
  loadTemplates(eleventyConfig)
  createFilters(eleventyConfig)

  // Global template data
  eleventyConfig.addGlobalData('isPreview', isPreview)
  eleventyConfig.addGlobalData('defaultLocale', config.defaultLocale)
  eleventyConfig.addGlobalData('locales', config.locales)

  if (!isPreview) {
    cssConfig(eleventyConfig, config.tailwind)
  }

  // Sanity client — use draft perspective in preview mode
  const client = isPreview
    ? createPreviewClient(config.sanity)
    : createSanityClient(config.sanity)

  // CMS global data
  eleventyConfig.addGlobalData('cms', () => buildCmsData(client, config, permalinks))
}
