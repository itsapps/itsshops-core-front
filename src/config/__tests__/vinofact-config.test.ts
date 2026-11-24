import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveConfig } from '../config'

process.env.SANITY_PROJECT_ID ??= 'test'
process.env.SANITY_DATASET ??= 'test'

afterEach(() => { vi.unstubAllEnvs() })

describe('VinoFact integration (env only)', () => {
  it('is set from token + profile slug, without a URL', () => {
    vi.stubEnv('VINOFACT_API_URL', '')
    vi.stubEnv('VINOFACT_API_TOKEN', 't')
    vi.stubEnv('VINOFACT_PROFILE_SLUG', 'p')
    expect(resolveConfig({}).features.shop.vinofact.integration)
      .toEqual({ endpoint: '', accessToken: 't', profileSlug: 'p' })
  })

  it('is unset without a token', () => {
    vi.stubEnv('VINOFACT_API_TOKEN', '')
    vi.stubEnv('VINOFACT_PROFILE_SLUG', 'p')
    expect(resolveConfig({}).features.shop.vinofact.integration).toBeUndefined()
  })
})
