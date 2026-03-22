export * from './types'
export * from './types/data'
export * as projections from './data/projections'
export * as queries from './data/queries'
export { resolveString, resolveImage, resolveLocaleAltImage, resolveBaseImage } from './data/localizers'
export { resolvePortableText, renderPortableText } from './data/portableText'
export type { PortableTextOptions } from './data/portableText'
export type { PortableTextExtensionContext, Extensions } from './types/config'
export { escapeHTML } from '@portabletext/to-html'
export type { PortableTextHtmlComponents } from '@portabletext/to-html'
export { sanityPicture, staticPicture, preGenerateStaticImages, imageUrl, imageSizes } from './image'
export { createSanityClient, createImageBuilder } from './core'
export { stegaClean } from '@sanity/client/stega'
export type { PictureSize, PictureOptions } from './image'

import type { EleventyConfig } from '11ty.ts'
import type { Config, CoreContext } from './types'
import { setupIgnores } from './config/ignores'
import { setupTemplates } from './config/templates'
import { createFilters } from './filters'
import { createSanityClient, createImageBuilder } from './core'
import { cssConfig } from './config/css'
import { setupAssets } from './config/assets'
import { buildCmsData } from './data/resolver'
import { resolveConfig } from './config/config'
import { imageSizes } from './image'
import { setupTranslation } from './i18n/translations/frontTranslation'
import { createShortcodes } from './shortcodes'
import { setupPlugins } from './config/plugins'
import { setupDev } from './config/dev'
import { setupJs } from './config/js'
import { setupHeaders } from './config/headers'
import utils from './utils'

export const shopCoreFrontendPlugin = (eleventyConfig: EleventyConfig, itsshopsConfig: Config) => {
  const config = resolveConfig(itsshopsConfig)
  setupDev(eleventyConfig, config)

  const client = createSanityClient(config.sanity)
  const imageBuilder = createImageBuilder(client)
  const translate = setupTranslation(config)
  const mergedImageSizes = { ...imageSizes, ...itsshopsConfig.imageSizes }
  const ctx: CoreContext = { eleventyConfig, config, translate, imageBuilder, imageSizes: mergedImageSizes }

  setupIgnores(ctx)
  setupPlugins(ctx)
  cssConfig(ctx)
  createFilters(ctx)
  createShortcodes(ctx)
  setupAssets(ctx)
  setupJs(ctx)
  setupHeaders(ctx)

  eleventyConfig.addGlobalData('cms', () => buildCmsData(client, ctx))
  eleventyConfig.addGlobalData('coreConfig', config)
  eleventyConfig.addGlobalData('imageSizes', mergedImageSizes)
  eleventyConfig.addGlobalData('utils', utils)

  setupTemplates(ctx)
}
