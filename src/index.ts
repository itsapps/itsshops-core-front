export * from './types'
export * from './data/types'
export * as projections from './data/projections'
export * as queries from './data/queries'
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
import { buildCmsData } from './data/resolver'
import { resolveConfig } from './config/config'
import { setupTranslation } from './i18n/translations/frontTranslation'
import { createShortcodes } from './shortcodes'
import { setupPlugins } from './config/plugins'

export const shopCoreFrontendPlugin = async (eleventyConfig: EleventyConfig, itsshopsConfig: Config) => {
  const config = resolveConfig(itsshopsConfig)
  const client = createSanityClient(config.sanity)
  const pluginConfigs: PluginConfigs = { eleventyConfig, config }
  const translator = setupTranslation(pluginConfigs)

  const context = {
    translator,
    config,
  }


  setupIgnores(pluginConfigs)
  setupPlugins(pluginConfigs)
  cssConfig(pluginConfigs)
  createFilters(pluginConfigs)
  createShortcodes(pluginConfigs)
  setupAssets(pluginConfigs)
  
  eleventyConfig.addGlobalData('cms', () => buildCmsData(client, config))
  eleventyConfig.addGlobalData('coreConfig', config)

  loadTemplates(pluginConfigs)
}
