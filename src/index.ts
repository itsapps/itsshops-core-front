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
import { buildPermalinkTranslations } from './i18n/permalinks'
import { buildCmsData } from './data/resolver'
import { resolveConfig } from './config/config'
import { createTranslation } from './i18n/translations/frontTranslation'

export const shopCoreFrontendPlugin = async (eleventyConfig: EleventyConfig, itsshopsConfig: Config) => {
  const config = resolveConfig(itsshopsConfig)
  const pluginConfigs: PluginConfigs = { eleventyConfig, config }

  setupIgnores(pluginConfigs)

  const translate = createTranslation(config)

  cssConfig(pluginConfigs)

  const client = createSanityClient(config.sanity)
  console.log('✅ Sanity client initialized: ', config.sanity.perspective)

  createFilters(pluginConfigs)

  // CMS global data
  const permalinks = buildPermalinkTranslations(config.permalinks)
  eleventyConfig.addGlobalData('cms', () => buildCmsData(client, config, permalinks))

  // Global template data
  eleventyConfig.addGlobalData('coreConfig', config)
  loadTemplates(pluginConfigs)
}
