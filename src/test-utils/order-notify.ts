import { describe, it, expect, beforeAll } from 'vitest'
import { createNotifyHandler } from '../netlify/functions/order-notify'
import type { NotifyHandlerOptions, NotifyResponseBody } from '../netlify/functions/order-notify'

type TestConfig = NotifyHandlerOptions & {
  /** Return a real Sanity order ID from the customer's dataset */
  getOrderId: () => Promise<string>
}

function buildRequest(body: unknown, secret?: string): Request {
  return new Request('http://localhost/api/order/notify', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(secret !== undefined && { 'x-server-secret': secret }),
    },
    body: JSON.stringify(body),
  })
}

async function parseResponse<T>(res: Response): Promise<{ status: number; body: T }> {
  return { status: res.status, body: await res.json() as T }
}

export function orderNotifyTests(config: TestConfig) {
  const { getOrderId, ...handlerOptions } = config
  const handler = createNotifyHandler(handlerOptions)
  const dummyContext = {} as any

  function authedRequest(body: unknown): Request {
    return buildRequest(body, process.env.SERVER_FUNCTIONS_SECRET)
  }

  describe('order-notify: auth', () => {
    it('rejects request with missing secret', async () => {
      const res = await handler(buildRequest({ orderId: 'any', mailType: 'orderConfirmation' }), dummyContext)
      expect(res.status).toBe(401)
    })

    it('rejects request with wrong secret', async () => {
      const res = await handler(buildRequest({ orderId: 'any', mailType: 'orderConfirmation' }, 'wrong-secret'), dummyContext)
      expect(res.status).toBe(401)
    })
  })

  describe('order-notify: validation', () => {
    it('rejects missing orderId', async () => {
      const res = await handler(authedRequest({ mailType: 'orderConfirmation' }), dummyContext)
      expect(res.status).toBe(400)
    })

    it('rejects missing mailType', async () => {
      const res = await handler(authedRequest({ orderId: 'some-id' }), dummyContext)
      expect(res.status).toBe(400)
    })

    it('rejects invalid mailType', async () => {
      const res = await handler(authedRequest({ orderId: 'some-id', mailType: 'nonexistent' }), dummyContext)
      expect(res.status).toBe(400)
    })

    it('rejects nonexistent orderId', async () => {
      const res = await handler(authedRequest({ orderId: 'nonexistent-order-id', mailType: 'orderConfirmation' }), dummyContext)
      expect(res.status).toBe(404)
    })

    it('rejects invalid JSON body', async () => {
      const res = await handler(
        new Request('http://localhost/api/order/notify', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-server-secret': process.env.SERVER_FUNCTIONS_SECRET!,
          },
          body: 'not-json',
        }),
        dummyContext,
      )
      expect(res.status).toBe(400)
    })
  })

  describe('order-notify: send', () => {
    let orderId: string

    beforeAll(async () => {
      orderId = await getOrderId()
      expect(orderId).toBeTruthy()
    })

    it('sends orderConfirmation and returns messageId + to', async () => {
      const res = await handler(authedRequest({ orderId, mailType: 'orderConfirmation' }), dummyContext)
      const { status, body } = await parseResponse<NotifyResponseBody>(res)
      expect(status).toBe(200)
      expect(body.messageId).toBeDefined()
      expect(body.to).toContain('@')
      expect(body.mailType).toBe('orderConfirmation')
    })

    it('sends orderInvoice with PDF attachment', async () => {
      const res = await handler(authedRequest({ orderId, mailType: 'orderInvoice', attachInvoice: true }), dummyContext)
      const { status, body } = await parseResponse<NotifyResponseBody>(res)
      expect(status).toBe(200)
      expect(body.messageId).toBeDefined()
      expect(body.mailType).toBe('orderInvoice')
    })

    it('sends orderShipping', async () => {
      const res = await handler(authedRequest({ orderId, mailType: 'orderShipping' }), dummyContext)
      const { status } = await parseResponse<NotifyResponseBody>(res)
      expect(status).toBe(200)
    })

    it('rejects non-POST methods', async () => {
      const res = await handler(
        new Request('http://localhost/api/order/notify', { method: 'GET' }),
        dummyContext,
      )
      expect(res.status).toBe(405)
    })
  })
}
