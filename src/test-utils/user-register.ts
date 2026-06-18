import { describe, it, expect } from 'vitest'
import { createUserRegisterHandler } from '../netlify/functions/user-register'
import type { UserRegisterConfig } from '../netlify/functions/user-register'

type TestConfig = UserRegisterConfig & {
  /**
   * Real address that should receive the signup confirmation (or, if the user
   * already exists, the recovery) mail.
   */
  recipient: string
  /** Password for the created test user. Defaults to a strong value. */
  password?: string
  /** `x-locale` header value. Defaults to 'de'. */
  locale?: string
}

function buildRequest(body: unknown, locale: string): Request {
  return new Request('http://localhost/api/user/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-locale': locale },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

/**
 * Integration tests for the user-register function, including a live "send"
 * test that actually dispatches the signup auth mail (via Supabase
 * `admin.generateLink` + Mailgun) to `recipient`.
 *
 * Requires the same env as production (Supabase service role, Mailgun, Sanity).
 * Captcha is forced off — a real token can't be produced in a test. Set
 * `SKIP_AUTH_EMAILS=true` to exercise the flow without actually sending.
 */
export function userRegisterTests(config: TestConfig) {
  const { recipient, password = 'Test-Password-1234!', locale = 'de', ...handlerConfig } = config
  const handler = createUserRegisterHandler({ ...handlerConfig, captcha: false })
  const dummyContext = {} as any

  // A complete profile so the request satisfies any required registrationFields
  // (prename / lastname / address …). Unused fields are simply ignored.
  const fullProfile = {
    email: recipient,
    password,
    prename: 'Test',
    lastname: 'User',
    phone: '+430000000000',
    line1: 'Teststraße 1',
    zip: '1010',
    city: 'Wien',
    country: 'AT',
    newsletter: false,
  }

  describe('user-register: validation', () => {
    it('rejects non-POST methods', async () => {
      const res = await handler(
        new Request('http://localhost/api/user/register', { method: 'GET' }),
        dummyContext,
      )
      expect(res.status).toBe(405)
    })

    it('rejects invalid JSON body', async () => {
      const res = await handler(buildRequest('not-json', locale), dummyContext)
      expect(res.status).toBe(400)
    })

    it('rejects missing password', async () => {
      const res = await handler(buildRequest({ email: recipient }, locale), dummyContext)
      expect(res.status).toBe(400)
    })

    it('rejects malformed email', async () => {
      const res = await handler(
        buildRequest({ ...fullProfile, email: 'not-an-email' }, locale),
        dummyContext,
      )
      expect(res.status).toBe(400)
    })
  })

  describe('user-register: send', () => {
    it('registers and dispatches the signup auth mail', async () => {
      const res = await handler(buildRequest(fullProfile, locale), dummyContext)
      expect(res.status).toBe(200)
      const body = (await res.json()) as { redirectUrl?: string }
      expect(body.redirectUrl).toBeTruthy()
    })
  })
}
