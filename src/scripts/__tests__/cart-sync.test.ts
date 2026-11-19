// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { syncCartFromServer, removeItems, getCart, emptyCartChanges, type CartItem } from '../cart-store'
import { mustReconfirm, expressMustReconfirm, renderChanges, type ChangeLabels } from '../checkout-changes'

const CART_KEY = `itsshops_cart_${location.host}`
const item = (id: string, over: Partial<CartItem> = {}): CartItem => ({
  id, title: `Title ${id}`, price: 1000, quantity: 1, imageUrl: '', url: '#', ...over,
})
const setCart = (items: CartItem[]) => localStorage.setItem(CART_KEY, JSON.stringify(items))
const line = (variantId: string, over: Record<string, unknown> = {}) => ({
  variantId, kind: 'wine' as const, subtitle: null, price: 1000, quantity: 1, requestedQuantity: 1, bundleKey: null, ...over,
})

describe('syncCartFromServer', () => {
  let events = 0
  document.addEventListener('cart:updated', () => events++)
  beforeEach(() => {
    localStorage.clear()
    events = 0
  })

  it('no change → empty lists, no save', () => {
    setCart([item('a')])
    const changes = syncCartFromServer({ items: [line('a')], unavailableItems: [] })
    expect(changes).toEqual(emptyCartChanges())
    expect(events).toBe(0)
  })

  it('removed / price / quantity / contents in one save', () => {
    setCart([
      item('gone'),
      item('p', { price: 1000 }),
      item('q', { quantity: 5 }),
      item('b', { subtitle: '2× A', bundleKey: 'a:2' }),
    ])
    const changes = syncCartFromServer({
      items: [
        line('p', { price: 1200 }),
        line('q', { quantity: 2, requestedQuantity: 5 }),
        line('b', { kind: 'bundle', subtitle: '3× A', bundleKey: 'a:3' }),
      ],
      unavailableItems: ['gone'],
    })
    expect(changes.removed.map(i => i.id)).toEqual(['gone'])
    expect(changes.price.map(c => [c.item.id, c.from, c.to])).toEqual([['p', 1000, 1200]])
    expect(changes.quantity.map(c => [c.item.id, c.from, c.to])).toEqual([['q', 5, 2]])
    expect(changes.contents.map(i => [i.id, i.subtitle])).toEqual([['b', '3× A']])
    expect(events).toBe(1)
    expect(getCart().map(i => [i.id, i.price, i.quantity, i.subtitle ?? null, i.bundleKey ?? null])).toEqual([
      ['p', 1200, 1, null, null],
      ['q', 1000, 2, null, null],
      ['b', 1000, 1, '3× A', 'a:3'],
    ])
  })

  it('same bundle key, another subtitle (locale) → subtitle updated, no contents change', () => {
    setCart([item('b', { subtitle: '2× Juice', bundleKey: 'a:2' })])
    const changes = syncCartFromServer({ items: [line('b', { kind: 'bundle', subtitle: '2× Saft', bundleKey: 'a:2' })], unavailableItems: [] })
    expect(changes.contents).toEqual([])
    expect(getCart()[0].subtitle).toBe('2× Saft')
  })

  it('no stored key (cart from before) → no contents change, key and subtitle taken', () => {
    setCart([item('b', { subtitle: '2× A' })])
    const changes = syncCartFromServer({ items: [line('b', { kind: 'bundle', subtitle: '3× A', bundleKey: 'a:3' })], unavailableItems: [] })
    expect(changes.contents).toEqual([])
    expect(getCart()[0]).toMatchObject({ subtitle: '3× A', bundleKey: 'a:3' })
  })

  it('stored quantity ≠ requestedQuantity (changed in flight) → quantity left alone', () => {
    setCart([item('q', { quantity: 7 })])
    const changes = syncCartFromServer({ items: [line('q', { quantity: 2, requestedQuantity: 5 })], unavailableItems: [] })
    expect(changes.quantity).toEqual([])
    expect(getCart()[0].quantity).toBe(7)
  })

  it('removeItems (CART_EMPTY ids) removes them and returns the entries', () => {
    setCart([item('a'), item('b'), item('c')])
    const removed = removeItems('a, c'.split(', '))
    expect(removed.map(i => i.id)).toEqual(['a', 'c'])
    expect(getCart().map(i => i.id)).toEqual(['b'])
    expect(removeItems(['x'])).toEqual([])
  })
})

describe('mustReconfirm', () => {
  const some = { ...emptyCartChanges(), removed: [item('a')] }
  it('changes or another total → true; same total, no change → false', () => {
    expect(mustReconfirm(some, 1000, 1000)).toBe(true)
    expect(mustReconfirm(emptyCartChanges(), 1000, 1000)).toBe(false)
    expect(mustReconfirm(emptyCartChanges(), 1000, 1100)).toBe(true)
    expect(mustReconfirm(emptyCartChanges(), null, 1000)).toBe(true)
  })
})

describe('renderChanges', () => {
  const labels: ChangeLabels = {
    intro: 'Updated:', removed: '{title} removed.', price: '{title}: {from} → {to}.',
    quantity: 'Only {quantity} of {title}.', contents: '{title} now {contents}.', reconfirm: 'Confirm again.',
  }
  const fmt = (c: number) => `€${(c / 100).toFixed(2)}`

  it('one list item per change, then empties again', () => {
    const el = document.createElement('div')
    renderChanges(el, {
      removed: [item('a')],
      price: [{ item: item('p'), from: 1000, to: 1200 }],
      quantity: [{ item: item('q'), from: 5, to: 2 }],
      contents: [item('b', { subtitle: '3× A' })],
    }, labels, fmt, { reconfirm: true })
    expect(Array.from(el.querySelectorAll('li'), li => li.textContent)).toEqual([
      'Title a removed.', 'Title p: €10.00 → €12.00.', 'Only 2 of Title q.', 'Title b now 3× A.',
    ])
    expect(el.textContent).toContain('Confirm again.')
    renderChanges(el, emptyCartChanges(), labels, fmt)
    expect(el.childNodes).toHaveLength(0)
  })
})

describe('expressMustReconfirm', () => {
  const calc = (total: number, price = 1000, subtitle: string | null = null) => ({
    totals: { grandTotal: total } as never,
    items: [{ variantId: 'a', quantity: 1, price, subtitle } as never],
  })
  it('only a difference to what the sheet showed blocks', () => {
    expect(expressMustReconfirm(calc(1500), calc(1500))).toBe(false)
    expect(expressMustReconfirm(calc(1500), calc(1600))).toBe(true)
    expect(expressMustReconfirm(calc(1500, 1000), calc(1500, 900))).toBe(true)
    expect(expressMustReconfirm(calc(1500, 1000, '2× A'), calc(1500, 1000, '3× A'))).toBe(true)
    expect(expressMustReconfirm(null, calc(1500))).toBe(true)
  })
})

describe('CheckoutExpress', () => {
  async function setup(over: Record<string, unknown> = {}) {
    const { CheckoutExpress } = await import('../checkout-express')
    const handlers: Record<string, (e: any) => any> = {}
    const element = { mount: vi.fn(), unmount: vi.fn(), update: vi.fn(), on: (name: string, fn: (e: any) => any) => { handlers[name] = fn } }
    const calc = {
      totals: { grandTotal: 4321 },
      shippingMethods: [
        { _id: 'sm1', title: 'DPD', methodType: 'delivery', price: 590, isFree: false },
        { _id: 'pu1', title: 'Abholung', methodType: 'pickup', price: 0, isFree: true },
      ],
      selectedShippingMethodId: 'sm1',
      items: [],
      appliedCoupons: [],
    }
    const updateAmount = vi.fn()
    const onCreatePayment = vi.fn(async () => ({ error: 'stop' }))
    const onCancel = vi.fn()
    const express = new CheckoutExpress({
      stripe: { createExpressCheckoutElement: () => element, updateAmount } as never,
      container: document.createElement('div'),
      returnUrl: '/thanks',
      allowedCountries: ['AT'],
      labels: { shipping: 'Versand' },
      getLatest: () => null,
      onAddressChange: async () => calc as never,
      onRateChange: async () => calc as never,
      onCreatePayment,
      onCancel,
      ...over,
    })
    express.mount()
    const confirmEvent = {
      shippingAddress: { name: 'A', address: { line1: 'L', city: 'C', country: 'AT', postal_code: '1010' } },
      billingDetails: { email: 'a@b.at' },
      shippingRate: { id: 'sm1' },
      paymentFailed: vi.fn(),
    }
    const addressEvent = () => ({ address: { country: 'AT', city: 'C', postal_code: '1010' }, resolve: vi.fn(), reject: vi.fn() })
    return { handlers, element, calc, updateAmount, onCreatePayment, onCancel, confirmEvent, addressEvent }
  }

  it('ready with a wallet → onReady; without one (e.g. Firefox desktop) → element unmounted', async () => {
    const onReady = vi.fn()
    const withWallet = await setup({ onReady })
    withWallet.handlers.ready({ availablePaymentMethods: { applePay: true, klarna: false } })
    expect(onReady).toHaveBeenCalledTimes(1)
    expect(withWallet.element.unmount).not.toHaveBeenCalled()

    const onReadyNone = vi.fn()
    const none = await setup({ onReady: onReadyNone })
    none.handlers.ready({ availablePaymentMethods: undefined })
    expect(onReadyNone).not.toHaveBeenCalled()
    expect(none.element.unmount).toHaveBeenCalledTimes(1)
  })

  it('sets the Elements amount to the sheet\'s total before answering it', async () => {
    const { handlers, updateAmount, addressEvent } = await setup()
    const ev = addressEvent()
    ev.resolve.mockImplementation(() => expect(updateAmount).toHaveBeenCalledWith(4321))
    await handlers.shippingaddresschange(ev)
    expect(ev.resolve).toHaveBeenCalled()
  })

  it('rejects instead of hanging when the answer fails', async () => {
    const { handlers, addressEvent } = await setup()
    const ev = addressEvent()
    ev.resolve.mockImplementation(() => { throw new Error('IntegrationError') })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await handlers.shippingaddresschange(ev)
    expect(ev.reject).toHaveBeenCalled()
  })

  it('passes the shown calculation to onCreatePayment, null after cancel (+ onCancel)', async () => {
    const { handlers, calc, onCreatePayment, onCancel, confirmEvent, addressEvent } = await setup()
    await handlers.shippingaddresschange(addressEvent())
    await handlers.confirm(confirmEvent)
    expect(onCreatePayment).toHaveBeenLastCalledWith(expect.objectContaining({ shownCalculation: calc }))
    handlers.cancel({})
    expect(onCancel).toHaveBeenCalled()
    await handlers.confirm(confirmEvent)
    expect(onCreatePayment).toHaveBeenLastCalledWith(expect.objectContaining({ shownCalculation: null }))
  })
})

describe('CheckoutExpress — pickup', () => {
  async function setup() {
    const { CheckoutExpress } = await import('../checkout-express')
    const handlers: Record<string, (e: any) => any> = {}
    const element = { mount: vi.fn(), unmount: vi.fn(), update: vi.fn(), on: (name: string, fn: (e: any) => any) => { handlers[name] = fn } }
    const calc = {
      totals: { grandTotal: 3000 },
      shippingMethods: [
        { _id: 'sm1', title: 'DPD', methodType: 'delivery', price: 590, isFree: false },
        { _id: 'pu1', title: 'Abholung im Weingut', methodType: 'pickup', price: 0, isFree: true },
      ],
      selectedShippingMethodId: 'pu1',
      items: [{ variantId: 'a', title: 'Wein', subtitle: null, price: 1500, quantity: 2 }],
      appliedCoupons: [],
    }
    const onCreatePayment = vi.fn(async (_input: any) => ({ error: 'stop' }))
    const express = new CheckoutExpress({
      stripe: { createExpressCheckoutElement: () => element, updateAmount: vi.fn() } as never,
      container: document.createElement('div'),
      returnUrl: '/thanks',
      allowedCountries: ['AT'],
      labels: { shipping: 'Versand', pickup: 'Abholung' },
      getLatest: () => calc as never,
      onAddressChange: async () => calc as never,
      onRateChange: async () => calc as never,
      onCreatePayment,
    })
    express.mount()
    return { express, handlers, element, calc, onCreatePayment }
  }

  it('setPickup updates both address flags (only on a mode change)', async () => {
    const { express, element } = await setup()
    express.setPickup('pu1')
    expect(element.update).toHaveBeenLastCalledWith({ shippingAddressRequired: false, billingAddressRequired: true })
    express.setPickup('pu1')
    expect(element.update).toHaveBeenCalledTimes(1)
    express.setPickup(null)
    expect(element.update).toHaveBeenLastCalledWith({ shippingAddressRequired: true, billingAddressRequired: false })
  })

  it('pickup click: no shipping rates, pickup line, and the shown calculation is set', async () => {
    const { express, handlers, calc, onCreatePayment } = await setup()
    express.setPickup('pu1')
    const click = { resolve: vi.fn() }
    handlers.click(click)
    const payload = click.resolve.mock.calls[0][0]
    expect(payload).not.toHaveProperty('shippingRates')
    expect(payload.lineItems.at(-1)).toEqual({ name: 'Abholung (Abholung im Weingut)', amount: 0 })
    // confirm with the billing address → the page's calculation was shown (not refused)
    await handlers.confirm({
      billingDetails: { name: 'Max Muster', email: 'm@x.ch', phone: '+41 1', address: { line1: 'Bahnhofstr. 1', city: 'Zürich', country: 'CH', postal_code: '8001' } },
      paymentFailed: vi.fn(),
    })
    const input = onCreatePayment.mock.calls[0][0]
    expect(input.shownCalculation).toBe(calc)
    expect(input.shippingMethodId).toBe('pu1')
    expect(input.address).toMatchObject({ name: 'Max Muster', line1: 'Bahnhofstr. 1', country: 'CH', zip: '8001', phone: '+41 1' })
  })

  it('pickup confirm without a billing address fails', async () => {
    const { express, handlers, onCreatePayment } = await setup()
    express.setPickup('pu1')
    const paymentFailed = vi.fn()
    await handlers.confirm({ billingDetails: { email: 'm@x.ch' }, paymentFailed })
    expect(paymentFailed).toHaveBeenCalled()
    expect(onCreatePayment).not.toHaveBeenCalled()
  })

  it('delivery mode: the sheet lists no pickup rate; only pickups → rejected', async () => {
    const { buildPayloadFromCalculation } = await import('../checkout-express')
    const { calc } = await setup()
    const payload = buildPayloadFromCalculation({ ...calc, selectedShippingMethodId: 'sm1' } as never, 'Versand')!
    expect(payload.shippingRates).toEqual([{ id: 'sm1', amount: 590, displayName: 'DPD' }])
    expect(buildPayloadFromCalculation({ ...calc, shippingMethods: [calc.shippingMethods[1]] } as never, 'Versand')).toBeNull()
  })
})
