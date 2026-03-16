export * from './types'
export * from './types/data'
export * as projections from './data/projections'
export * as queries from './data/queries'
export { resolveString, resolveImage, resolveLocaleAltImage, resolveBaseImage } from './data/localizers'
export { resolvePortableText } from './data/portableText'
export { sanityPicture, imageUrl } from './media'
export type { PictureSize } from './media'

import type { EleventyConfig } from '11ty.ts'
import type { Config, CoreContext } from './types'
import { setupIgnores } from './config/ignores'
import { loadTemplates } from './config/templates'
import { createFilters } from './filters'
import { createSanityClient, createImageBuilder } from './core'
import { cssConfig } from './config/css'
import { setupAssets } from './config/assets'
import { buildCmsData } from './data/resolver'
import { resolveConfig } from './config/config'
import { setupTranslation } from './i18n/translations/frontTranslation'
import { createShortcodes } from './shortcodes'
import { setupPlugins } from './config/plugins'

export const shopCoreFrontendPlugin = (eleventyConfig: EleventyConfig, itsshopsConfig: Config) => {
  const config = resolveConfig(itsshopsConfig)

  const client = createSanityClient(config.sanity)
  const imageBuilder = createImageBuilder(client)
  const translate = setupTranslation(config)
  const ctx: CoreContext = { eleventyConfig, config, translate, imageBuilder }

  setupIgnores(ctx)
  setupPlugins(ctx)
  cssConfig(ctx)
  createFilters(ctx)
  createShortcodes(ctx)
  setupAssets(ctx)

  eleventyConfig.addGlobalData('cms', () => buildCmsData(client, ctx))
  eleventyConfig.addGlobalData('coreConfig', config)

  loadTemplates(ctx)
}
