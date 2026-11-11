import { describe, it, expect } from 'vitest'
import { shouldIgnoreTemplate } from '../templates'
import { resolveConfig } from '../config'
import type { Config } from '../../types'

process.env.SANITY_PROJECT_ID ??= 'test'
process.env.SANITY_DATASET ??= 'test'

const ignored = (config: Config, file: string) =>
  shouldIgnoreTemplate({ dir: 'standard', file, ctx: { config: resolveConfig(config) } as any })

describe('search index gate', () => {
  it('derives features.shop.search from shop + extensions.search', () => {
    expect(resolveConfig({}).features.shop.search).toBe(false)
    expect(resolveConfig({ features: { shop: {} } }).features.shop.search).toBe(false)
    expect(resolveConfig({ extensions: { search: {} } }).features.shop.search).toBe(false)
    expect(resolveConfig({ features: { shop: {} }, extensions: { search: {} } }).features.shop.search).toBe(true)
  })

  it('writes search.json only when the product search is configured', () => {
    expect(ignored({}, 'search-index.njk')).toBe(true)
    expect(ignored({ features: { shop: {} } }, 'search-index.njk')).toBe(true)
    expect(ignored({ features: { shop: {} }, extensions: { search: {} } }, 'search-index.njk')).toBe(false)
  })

  it('keeps the other feature gates', () => {
    expect(ignored({}, 'products.njk')).toBe(true)
    expect(ignored({ features: { shop: {} } }, 'products.njk')).toBe(false)
    expect(ignored({}, 'pages.njk')).toBe(false)
  })
})
