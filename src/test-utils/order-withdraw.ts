import { describe, it, expect, beforeAll } from 'vitest'
import { createOrderWithdrawHandler } from '../netlify/functions/order-withdraw'
import type { OrderWithdrawConfig } from '../netlify/functions/order-withdraw'

type TestConfig = OrderWithdrawConfig & {
  /** Returns a real order number + its matching contact email from the dataset. */
  getOrder: () => Promise<{ orderNumber: string; email: string }>
  /** `x-locale` header value. Defaults to 'de'. */
  locale?: string
}

function buildRequest(body: unknown, locale: string): Request {
  return new Request('http://localhost/api/order/withdraw', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-locale': locale },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

/**
 * Integration tests for the order-withdraw function, including a live test that
 * records an `orderWithdrawal` document and sends the confirmation + shop emails.
 *
 * Captcha is forced off. Set `SKIP_AUTH_EMAILS=true` to record without sending.
 * Re-runs hit the per-order dedupe and return 200 without a second record/mail.
 */
export function orderWithdrawTests(config: TestConfig) {
  const { getOrder, locale = 'de', ...handlerConfig } = config
  const handler = createOrderWithdrawHandler({ ...handlerConfig, captcha: false })
  const dummyContext = {} as any

  describe('order-withdraw: validation', () => {
    it('rejects non-POST methods', async () => {
      const res = await handler(
        new Request('http://localhost/api/order/withdraw', { method: 'GET' }),
        dummyContext,
      )
      expect(res.status).toBe(405)
    })

    it('rejects invalid JSON body', async () => {
      const res = await handler(buildRequest('not-json', locale), dummyContext)
      expect(res.status).toBe(400)
    })

    it('rejects missing fields', async () => {
      const res = await handler(buildRequest({ orderNumber: 'X' }, locale), dummyContext)
      expect(res.status).toBe(400)
    })

    it('rejects malformed email', async () => {
      const res = await handler(
        buildRequest({ orderNumber: 'X', email: 'not-an-email' }, locale),
        dummyContext,
      )
      expect(res.status).toBe(400)
    })

    it('rejects an unknown order number + email', async () => {
      const res = await handler(
        buildRequest(
          { orderNumber: 'NONEXISTENT-000000', email: 'nobody@example.com' },
          locale,
        ),
        dummyContext,
      )
      expect(res.status).toBe(400)
    })
  })

  describe('order-withdraw: send', () => {
    let order: { orderNumber: string; email: string }

    beforeAll(async () => {
      order = await getOrder()
      expect(order.orderNumber).toBeTruthy()
      expect(order.email).toContain('@')
    })

    it('records the withdrawal and returns a redirect', async () => {
      const res = await handler(
        buildRequest(
          { orderNumber: order.orderNumber, email: order.email, reason: 'Test withdrawal' },
          locale,
        ),
        dummyContext,
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as { redirectUrl?: string }
      expect(body.redirectUrl).toBeTruthy()
    })
  })
}
