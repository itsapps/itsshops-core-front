import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const ENV = ['SANITY_PROJECT_ID', 'SANITY_DATASET', 'SANITY_TOKEN'] as const

describe('sanityClient (lazy)', () => {
  const saved: Record<string, string | undefined> = {}
  beforeEach(() => {
    for (const name of ENV) {
      saved[name] = process.env[name]
      delete process.env[name]
    }
    vi.resetModules()
  })
  afterEach(() => {
    for (const name of ENV) {
      if (saved[name] === undefined) delete process.env[name]
      else process.env[name] = saved[name]
    }
  })

  it('imports without SANITY_* env and throws on first use', async () => {
    const { sanityClient } = await import('../services/sanity')
    expect(() => sanityClient.fetch).toThrow(/SANITY_PROJECT_ID, SANITY_DATASET, and SANITY_TOKEN/)
  })

  it('the functions/utils entry imports without env', async () => {
    await expect(import('../functions/utils')).resolves.toHaveProperty('sendMail')
  })

  it('creates one client on first use and binds its methods', async () => {
    process.env.SANITY_PROJECT_ID = 'abc123'
    process.env.SANITY_DATASET = 'production'
    process.env.SANITY_TOKEN = 'token'
    const { sanityClient } = await import('../services/sanity')
    expect(sanityClient.config().projectId).toBe('abc123')
    const { config } = sanityClient
    expect(config().dataset).toBe('production')
  })
})
