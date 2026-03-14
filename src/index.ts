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

// Shared across all Eleventy config instances within one Eleventy invocation.
// Eleventy v3 calls the plugin once per internal worker — heavy work runs once.
// Must be reset between requests (see resetPluginState) to prevent worker accumulation.
let sharedSetup: {
  client: ReturnType<typeof createSanityClient>
  config: ReturnType<typeof resolveConfig>
  permalinks: ReturnType<typeof buildPermalinkTranslations>
} | null = null

export const resetPluginState = () => { sharedSetup = null }

export const shopCoreFrontendPlugin = async (eleventyConfig: EleventyConfig, itsshopsConfig: Config) => {
  if (!sharedSetup) {
    const config = resolveConfig(itsshopsConfig)
    const client = createSanityClient(config.sanity)
    const permalinks = buildPermalinkTranslations(config.permalinks)
    sharedSetup = { client, config, permalinks }
  }

  const { client, config, permalinks } = sharedSetup
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
