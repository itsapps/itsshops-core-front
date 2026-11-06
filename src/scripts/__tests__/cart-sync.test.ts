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
    const element = { mount: vi.fn(), on: (name: string, fn: (e: any) => any) => { handlers[name] = fn } }
    const calc = { totals: { grandTotal: 4321 }, shippingMethods: [], selectedShippingMethodId: null, items: [], appliedCoupons: [] }
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
    return { handlers, calc, updateAmount, onCreatePayment, onCancel, confirmEvent, addressEvent }
  }

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
