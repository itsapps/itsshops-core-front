import common_de from './de_11ty'
import common_en from './en_11ty'
import shared_de from './de_shared'
import shared_en from './en_shared'
import { createTranslator } from './t9n'
import type { PluginConfigs, TranslatorParams } from '../../types'


export function setupTranslation(configs: PluginConfigs) {
  const { eleventyConfig, config } = configs
  const coreResources = {
    de: { common: common_de, shared: shared_de },
    en: { common: common_en, shared: shared_en },
  };

  const translation = createTranslator(config, coreResources)
  eleventyConfig.addFilter('trans', function (key: string, params: TranslatorParams = {}) {
    return translation.translate(key, params, this.page?.lang)
  })

  return translation
}

