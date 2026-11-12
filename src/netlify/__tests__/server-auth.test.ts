import { describe, it, expect, afterEach, vi } from 'vitest'
import { allowedOrigins, requireServerSecret, safeEqual } from '../utils/server-auth'

describe('server-auth', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('safeEqual: equal, different, different length', () => {
    expect(safeEqual('secret', 'secret')).toBe(true)
    expect(safeEqual('secret', 'secreT')).toBe(false)
    expect(safeEqual('secret', 'secret-longer')).toBe(false)
    expect(safeEqual('', '')).toBe(true)
  })

  it('allowedOrigins trims and drops empty entries', () => {
    vi.stubEnv('SERVER_FUNCTIONS_ALLOWED_ORIGINS', ' https://a.example , ,https://b.example')
    expect(allowedOrigins()).toEqual(['https://a.example', 'https://b.example'])
    vi.stubEnv('SERVER_FUNCTIONS_ALLOWED_ORIGINS', '')
    expect(allowedOrigins()).toEqual([])
  })

  it('requireServerSecret: missing env → 500, wrong/missing header → 401, match → null', () => {
    const req = (secret?: string) =>
      new Request('https://shop.example/api/x', { method: 'POST', headers: secret ? { 'x-server-secret': secret } : {} })
    vi.stubEnv('SERVER_FUNCTIONS_SECRET', '')
    expect(requireServerSecret(req('s'))?.status).toBe(500)
    vi.stubEnv('SERVER_FUNCTIONS_SECRET', 's3cret')
    expect(requireServerSecret(req())?.status).toBe(401)
    expect(requireServerSecret(req('s3cre'))?.status).toBe(401)
    expect(requireServerSecret(req('s3cret'))).toBeNull()
  })
})
