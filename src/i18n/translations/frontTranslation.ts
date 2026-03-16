import common_de from './de_11ty'
import common_en from './en_11ty'
import shared_de from './de_shared'
import shared_en from './en_shared'
import { createTranslator } from './t9n'
import type { CoreConfig, TranslatorFunction } from '../../types'

export function setupTranslation(config: CoreConfig): TranslatorFunction {
  const coreResources = {
    de: { common: common_de, shared: shared_de },
    en: { common: common_en, shared: shared_en },
  }

  const { translate } = createTranslator(config, coreResources)

  return translate
}

