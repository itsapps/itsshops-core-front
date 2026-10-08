import _ from 'lodash'
import common_de from './de_11ty'
import common_en from './en_11ty'
import shared_de from './de_shared'
import shared_en from './en_shared'
import common_de_informal from './de_11ty.informal'
import shared_de_informal from './de_shared.informal'
import { createTranslator } from './t9n'
import type { CoreConfig, TranslatorFunction } from '../../types'

export function setupTranslation(config: CoreConfig): TranslatorFunction {
  const informal = config.formality === 'informal'
  const coreResources = {
    de: {
      common: informal ? _.merge({}, common_de, common_de_informal) : common_de,
      shared: informal ? _.merge({}, shared_de, shared_de_informal) : shared_de,
    },
    en: { common: common_en, shared: shared_en },
  }

  // Shop's own `config.translations` overrides are merged on top in createTranslator
  const { translate } = createTranslator(config, coreResources)

  return translate
}
