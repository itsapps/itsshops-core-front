// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { CheckoutCoupon, shouldClearStoredCode, type CouponLabels } from '../checkout-coupon'
import { renderTotals } from '../order-totals'
import { buildLineItems } from '../checkout-express'
import type { AppliedDiscountResponse, TotalsResponse } from '../../shared/checkout-api'

const code = (over: Partial<AppliedDiscountResponse> = {}): AppliedDiscountResponse =>
  ({ title: 'Sommer', code: 'SUMMER', trigger: 'code', target: 'order', amount: 300, ...over })
const auto = (over: Partial<AppliedDiscountResponse> = {}): AppliedDiscountResponse =>
  ({ title: 'Versandkostenfrei mit Weinpaket', trigger: 'automatic', target: 'shipping', amount: 700, ...over })
const error = (errorCode: string, discountTitle?: string) => ({ code: 'SUMMER', errorCode, message: 'x', ...(discountTitle && { discountTitle }) })

describe('shouldClearStoredCode', () => {
  it('only without a code entry', () => {
    expect(shouldClearStoredCode({ couponError: error('COUPON_EXPIRED'), appliedDiscounts: [auto()] })).toBe(true)
    expect(shouldClearStoredCode({ couponError: error('COUPON_EXPIRED'), appliedDiscounts: [code()] })).toBe(false)
    expect(shouldClearStoredCode({ couponError: null, appliedDiscounts: [] })).toBe(false)
  })
})

describe('CheckoutCoupon.render', () => {
  const labels: CouponLabels = {
    apply: 'Einlösen', remove: 'Entfernen', applied: 'Eingelöst', errorFallback: 'Fehler',
    errors: { COUPON_NOT_COMBINABLE: 'Nicht mit Aktion „{title}“ kombinierbar' },
    notDiscounted: 'Nicht rabattiert: {items}',
  }
  let el: HTMLElement
  let box: CheckoutCoupon
  const q = (sel: string) => el.querySelector<HTMLElement>(sel)!
  beforeEach(() => {
    document.body.innerHTML = `<div data-checkout-coupon>
      <input data-checkout-coupon-input><button data-checkout-coupon-apply></button>
      <button data-checkout-coupon-remove hidden></button>
      <p data-checkout-coupon-applied hidden><code data-checkout-coupon-applied-code></code></p>
      <p data-checkout-coupon-error role="alert" hidden></p>
      <p data-checkout-coupon-hint role="status"></p></div>`
    el = document.querySelector('[data-checkout-coupon]')!
    box = new CheckoutCoupon(el, labels)
  })

  it('an automatic discount alone neither locks the input nor reads "applied"', () => {
    box.render([auto()], null)
    expect((q('[data-checkout-coupon-input]') as HTMLInputElement).disabled).toBe(false)
    expect(q('[data-checkout-coupon-applied]').hidden).toBe(true)
  })

  it('the code entry is shown as applied, with the hint for skipped lines', () => {
    box.render([auto(), code()], null, ['Weinpaket Rieden', 'Sprudel Paket'])
    expect(q('[data-checkout-coupon-applied-code]').textContent).toBe('SUMMER')
    expect(q('[data-checkout-coupon-hint]').textContent).toBe('Nicht rabattiert: Weinpaket Rieden, Sprudel Paket')
    box.render([code()], null, [])
    expect(q('[data-checkout-coupon-hint]').textContent).toBe('')
  })

  it('COUPON_NOT_COMBINABLE names the winning discount, as text', () => {
    box.render([auto()], error('COUPON_NOT_COMBINABLE', '<b>Herbst</b>'))
    const err = q('[data-checkout-coupon-error]')
    expect(err.hidden).toBe(false)
    expect(err.textContent).toBe('Nicht mit Aktion „<b>Herbst</b>“ kombinierbar')
    expect(err.querySelector('b')).toBeNull()
  })
})

describe('renderTotals — discount rows', () => {
  beforeEach(() => {
    document.body.innerHTML = `<template id="row"><div><dt><span data-slot="label"></span> <code data-slot="code" hidden></code></dt><dd data-slot="value"></dd></div></template><dl id="t"></dl>`
  })
  const totals: TotalsResponse = { subtotal: 5000, shipping: 0, tax: 0, discount: 300, grandTotal: 4700, vatBreakdown: [] }
  const labels = { subtotal: 'Zwischensumme', shipping: 'Versand', total: 'Gesamt', vat: 'MwSt.', vatExempt: 'steuerfrei', discount: 'Rabatt' }

  it('one row per discount with amount > 0, title as label, code in its slot', () => {
    const dl = document.getElementById('t')!
    renderTotals(dl, { totals, appliedDiscounts: [code(), auto(), auto({ title: 'Null', amount: 0 }), code({ title: '', code: 'X', amount: 50 })] },
      labels, c => `€${c / 100}`, 'row')
    const rows = Array.from(dl.querySelectorAll('.checkout-totals__row--discount')).map(r => r.textContent!.replace(/\s+/g, ' ').trim())
    expect(rows).toEqual(['Sommer SUMMER− €3', 'Rabatt X− €0.5'])
  })

  const rowText = (dl: HTMLElement, i: number) => dl.children[i].textContent!.replace(/\s+/g, ' ').trim()

  it('a shipping discount is no row of its own: the shipping row names it and reads "kostenlos"', () => {
    const dl = document.getElementById('t')!
    renderTotals(dl, { totals, appliedDiscounts: [code(), auto()] }, { ...labels, free: 'kostenlos' }, c => `€${c / 100}`, 'row')
    expect(rowText(dl, 2)).toBe('Versand (Versandkostenfrei mit Weinpaket) kostenlos')
  })

  it('a shipping code shows its code next to the title (once when they are equal)', () => {
    const dl = document.getElementById('t')!
    const free = (over: object) => code({ target: 'shipping', amount: 890, ...over })
    renderTotals(dl, { totals, appliedDiscounts: [free({ title: 'Gratis-Versand-Aktion', code: 'FREI' })] }, { ...labels, free: 'kostenlos' }, c => `€${c / 100}`, 'row')
    expect(rowText(dl, 1)).toBe('Versand (Gratis-Versand-Aktion · FREI) kostenlos')
    renderTotals(dl, { totals, appliedDiscounts: [free({ title: 'FREI', code: 'FREI' })] }, { ...labels, free: 'kostenlos' }, c => `€${c / 100}`, 'row')
    expect(rowText(dl, 1)).toBe('Versand (FREI) kostenlos')
  })

  it('shipping 0 without a discount (threshold): plain label; without a free label "—"', () => {
    const dl = document.getElementById('t')!
    renderTotals(dl, { totals, appliedDiscounts: [] }, { ...labels, free: 'kostenlos' }, c => `€${c / 100}`, 'row')
    expect(rowText(dl, 1)).toBe('Versand kostenlos')
    renderTotals(dl, { totals, appliedDiscounts: [] }, labels, c => `€${c / 100}`, 'row')
    expect(rowText(dl, 1)).toBe('Versand —')
  })
})

describe('buildLineItems — wallet lines', () => {
  it('one negative line per items/order discount, none for shipping', () => {
    const items = [{ variantId: 'v', kind: 'wine', title: 'Wein', subtitle: null, price: 5000, quantity: 1, requestedQuantity: 1, stock: null, imageUrl: null, weight: null, bundleKey: null }]
    const lines = buildLineItems(items as never, undefined, 'Versand', [code(), auto()])
    expect(lines).toEqual([{ name: '1x Wein', amount: 5000 }, { name: 'Sommer', amount: -300 }])
  })
})
