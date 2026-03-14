export * from './types'
export * from './data/types'
export * as projections from './data/projections'
export { resolveString, resolveImage, resolveLocaleAltImage, resolveBaseImage } from './data/locale'
export { resolvePortableText } from './data/portableText'
export { sanityPicture, imageUrl } from './media'
export type { PictureSize } from './media'

import type { EleventyConfig } from '11ty.ts'
import type { Config, PluginConfigs } from './types'
import { setupIgnores } from './config/ignores'
import { loadTemplates } from './config/templates'
import { createFilters } from './filters'
import { createSanityClient } from './core'
import { cssConfig } from './config/css'
import { setupAssets } from './config/assets'
import { buildPermalinkTranslations } from './i18n/permalinks'
import { buildCmsData } from './data/resolver'
import { resolveConfig } from './config/config'
import { createTranslation } from './i18n/translations/frontTranslation'

export const shopCoreFrontendPlugin = async (eleventyConfig: EleventyConfig, itsshopsConfig: Config) => {
  const config = resolveConfig(itsshopsConfig)
  const client = createSanityClient(config.sanity)
  const permalinks = buildPermalinkTranslations(config.permalinks)
  const pluginConfigs: PluginConfigs = { eleventyConfig, config }

  setupIgnores(pluginConfigs)
  createTranslation(config)
  cssConfig(pluginConfigs)
  createFilters(pluginConfigs)
  setupAssets(pluginConfigs)

  eleventyConfig.addGlobalData('cms', () => buildCmsData(client, config, permalinks))
  eleventyConfig.addGlobalData('coreConfig', config)

  loadTemplates(pluginConfigs)
}
