// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { initOrderThanks } from '../order-thanks'
import { saveOrderSnapshot, type OrderSnapshot } from '../order-snapshot'

// Mirrors templates/overridable/order-thanks.njk + macros/cart.njk (rendered, de).
const PAGE = `
<article data-order-thanks data-checkout-url="/de/kasse/" data-currency="EUR"
  data-t-heading-named="Vielen Dank für Deine Bestellung, %name%!"
  data-t-subtotal="Zwischensumme" data-t-shipping="Versand" data-t-total="Gesamt"
  data-t-vat="MwSt." data-t-vat-exempt="Steuerfrei" data-t-discount="Rabatt">
  <h1 data-order-thanks-heading>Vielen Dank für Deine Bestellung!</h1>
  <p data-order-thanks-status="generic">generic</p>
  <p data-order-thanks-status="succeeded" data-t-with-email="ok, mail an %email%." hidden>ok</p>
  <p data-order-thanks-status="processing" data-t-with-email="processing, mail an %email%." hidden>processing</p>
  <section data-order-thanks-summary hidden>
    <ul data-order-thanks-items></ul><dl data-order-thanks-totals></dl>
  </section>
  <section data-order-thanks-delivery hidden>
    <p data-slot="shipping-method" hidden></p><address data-slot="address" hidden></address>
  </section>
  <section data-order-thanks-next hidden></section>
  <template id="order-thanks-item-template"><li><div class="cart-item" data-cart-item>
    <img src="" alt="" data-slot="image"><a href="#" data-slot="title"></a>
    <span data-slot="subtitle" hidden></span><span data-qty-value>1</span><span data-slot="price"></span>
  </div></li></template>
  <template id="order-thanks-totals-row-template"><div class="checkout-totals__row">
    <dt><span data-slot="label"></span> <code data-slot="code" hidden></code></dt><dd data-slot="value"></dd>
  </div></template>
</article>`

const CART_KEY = `itsshops_cart_${location.host}`

const snapshot = (overrides: Partial<OrderSnapshot> = {}): OrderSnapshot => ({
  v: 1,
  paymentIntentId: 'pi_123',
  createdAt: Date.now(),
  email: 'anna@example.com',
  firstName: 'Anna',
  items: [{ title: 'Grüner Veltliner', subtitle: '2023', imageUrl: '/img.jpg', url: '/de/gv', price: 1450, quantity: 2 }],
  summary: {
    totals: { subtotal: 2900, shipping: 590, tax: 582, discount: 0, grandTotal: 3490, vatBreakdown: [{ rate: 20, net: 2908, vat: 582 }] },
    appliedCoupons: [],
  },
  shippingMethod: { title: 'Post', methodType: 'delivery' },
  shippingAddress: { name: 'Anna Muster', line1: 'Hauptstraße 1', zip: '3550', city: 'Langenlois', country: 'Österreich' },
  ...overrides,
})

function visit(query: string): void {
  history.replaceState(null, '', `/de/kasse/danke/${query}`)
  initOrderThanks()
}

const $ = (sel: string) => document.querySelector<HTMLElement>(sel)!
const cart = () => JSON.parse(localStorage.getItem(CART_KEY) || '[]')

describe('initOrderThanks', () => {
  beforeEach(() => {
    document.documentElement.lang = 'de'
    document.body.innerHTML = PAGE
    sessionStorage.clear()
    localStorage.setItem(CART_KEY, JSON.stringify([{ id: 'v1', quantity: 2 }]))
  })

  it('succeeded: clears the cart, strips the Stripe params, renders the snapshot', () => {
    saveOrderSnapshot(snapshot())
    visit('?payment_intent=pi_123&payment_intent_client_secret=pi_123_secret_x&redirect_status=succeeded&utm=keep')

    expect(cart()).toEqual([])
    expect(location.search).toBe('?utm=keep')
    expect($('[data-order-thanks-status="generic"]').hidden).toBe(true)
    expect($('[data-order-thanks-status="succeeded"]').textContent).toBe('ok, mail an anna@example.com.')
    expect($('[data-order-thanks-heading]').textContent).toBe('Vielen Dank für Deine Bestellung, Anna!')
    expect($('[data-order-thanks-summary]').hidden).toBe(false)
    expect($('[data-order-thanks-items] [data-slot="title"]').textContent).toBe('Grüner Veltliner')
    expect($('[data-order-thanks-items] [data-qty-value]').textContent).toBe('2')
    expect($('.checkout-totals__row--total dd').textContent?.replace(/\s/g, ' ')).toBe('34,90 €')
    expect($('[data-slot="address"]').textContent).toBe('Anna Muster\nHauptstraße 1\n3550 Langenlois\nÖsterreich')
    expect($('[data-order-thanks-next]').hidden).toBe(false)
    expect(sessionStorage.length).toBe(0)
  })

  it('processing: clears the cart and shows the processing text', () => {
    saveOrderSnapshot(snapshot())
    visit('?payment_intent=pi_123&redirect_status=processing')

    expect(cart()).toEqual([])
    expect($('[data-order-thanks-status="processing"]').hidden).toBe(false)
    expect($('[data-order-thanks-status="processing"]').textContent).toBe('processing, mail an anna@example.com.')
    expect($('[data-order-thanks-status="succeeded"]').hidden).toBe(true)
  })

  it('pickup: shows the method, no address', () => {
    saveOrderSnapshot(snapshot({ shippingMethod: { title: 'Abholung', methodType: 'pickup' } }))
    visit('?payment_intent=pi_123&redirect_status=succeeded')

    expect($('[data-slot="shipping-method"]').textContent).toBe('Abholung')
    expect($('[data-slot="address"]').hidden).toBe(true)
  })

  it('snapshot of another payment: status text without summary', () => {
    saveOrderSnapshot(snapshot({ paymentIntentId: 'pi_other' }))
    visit('?payment_intent=pi_123&redirect_status=succeeded')

    expect($('[data-order-thanks-status="succeeded"]').textContent).toBe('ok')
    expect($('[data-order-thanks-heading]').textContent).toBe('Vielen Dank für Deine Bestellung!')
    expect($('[data-order-thanks-summary]').hidden).toBe(true)
  })

  it('renders snapshot values as text, never markup', () => {
    saveOrderSnapshot(snapshot({ firstName: '<img src=x>', email: '$& <b>x</b>' }))
    visit('?payment_intent=pi_123&redirect_status=succeeded')

    expect(document.querySelector('[data-order-thanks] img:not([data-slot])')).toBeNull()
    expect($('[data-order-thanks-heading]').textContent).toBe('Vielen Dank für Deine Bestellung, <img src=x>!')
    expect($('[data-order-thanks-status="succeeded"]').textContent).toBe('ok, mail an $& <b>x</b>.')
  })

  it('no params: generic page, cart and snapshot untouched', () => {
    saveOrderSnapshot(snapshot())
    visit('')

    expect(cart()).toHaveLength(1)
    expect($('[data-order-thanks-status="generic"]').hidden).toBe(false)
    expect($('[data-order-thanks-next]').hidden).toBe(true)
    expect(sessionStorage.length).toBe(1)
  })

  it('failed: keeps cart and snapshot (redirects back to checkout)', () => {
    saveOrderSnapshot(snapshot())
    visit('?payment_intent=pi_123&redirect_status=failed')

    expect(cart()).toHaveLength(1)
    expect(sessionStorage.length).toBe(1)
    expect($('[data-order-thanks-status="generic"]').hidden).toBe(false)
  })
})
