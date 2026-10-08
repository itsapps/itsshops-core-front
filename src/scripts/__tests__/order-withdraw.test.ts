// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { initOrderWithdraw } from '../order-withdraw'

const flush = () => new Promise((r) => setTimeout(r, 0))

function render(values: Record<string, string> = {}) {
  document.body.innerHTML = `
    <div data-order-withdraw data-api="/api/order/withdraw" data-locale="de"
      data-t-error-service="Fehler" data-t-error-rate-limited="Zu viele Anfragen"
      data-t-error-name="Name fehlt" data-t-error-order-number="Nummer fehlt"
      data-t-error-no-links="Keine Links" data-t-error-email="E-Mail ungültig">
      <form>
        <input name="name" value="${values.name ?? ''}"><span data-field-error="name" hidden></span>
        <input name="orderNumber" value="${values.orderNumber ?? ''}"><span data-field-error="orderNumber" hidden></span>
        <input name="email" value="${values.email ?? ''}"><span data-field-error="email" hidden></span>
        <textarea name="reason"></textarea>
        <input name="website" value="">
        <div data-form-error hidden></div>
        <button type="submit"><span data-submit-text></span><span data-submit-loading hidden></span></button>
      </form>
    </div>`
  initOrderWithdraw()
  const form = document.querySelector('form')!
  return {
    submit: async () => { form.dispatchEvent(new Event('submit', { cancelable: true })); await flush(); await flush() },
    error: (field: string) => document.querySelector<HTMLElement>(`[data-field-error="${field}"]`)!,
    formError: () => document.querySelector<HTMLElement>('[data-form-error]')!,
    input: (field: string) => document.querySelector<HTMLInputElement>(`[name="${field}"]`)!,
  }
}

const valid = { name: 'Anna Muster', orderNumber: '000042', email: 'anna@example.com' }

describe('order-withdraw form', () => {
  beforeEach(() => { document.body.innerHTML = '' })
  afterEach(() => vi.unstubAllGlobals())

  it('requires a name and marks the field invalid, without calling the API', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const ui = render({ ...valid, name: '' })
    await ui.submit()
    expect(ui.error('name').hidden).toBe(false)
    expect(ui.error('name').textContent).toBe('Name fehlt')
    expect(ui.input('name').getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(ui.input('name'))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a URL-like name', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const ui = render({ ...valid, name: 'www.spam.example' })
    await ui.submit()
    expect(ui.error('name').textContent).toBe('Keine Links')
  })

  it('shows the "try again later" message on 429 (non-JSON body)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Too Many Requests', { status: 429 })))
    const ui = render(valid)
    await ui.submit()
    expect(ui.formError().hidden).toBe(false)
    expect(ui.formError().textContent).toBe('Zu viele Anfragen')
  })

  it('shows the service error on a non-JSON server error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 502 })))
    const ui = render(valid)
    await ui.submit()
    expect(ui.formError().textContent).toBe('Fehler')
  })

  it('sends name, order number and email', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { message: 'x', details: { email: 'Server sagt nein' } } }), { status: 400 }))
    vi.stubGlobal('fetch', fetchMock)
    const ui = render(valid)
    await ui.submit()
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body).toEqual(valid)
    expect(ui.error('email').textContent).toBe('Server sagt nein')
  })
})
