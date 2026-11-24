// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CheckoutFulfillment } from '../checkout-fulfillment'
import { CheckoutForm } from '../checkout-form'
import { CheckoutShipping } from '../checkout-shipping'
import type { ShippingMethodResponse } from '../../shared/checkout-api'

const fmt = (c: number) => `€ ${(c / 100).toFixed(2)}`
const labels = { delivery: 'Versand', free: 'kostenlos', readyIn: 'Abholbereit in: {time}', holdPeriod: '{days} Tage' }
const methods: ShippingMethodResponse[] = [
  { _id: 'dpd', title: 'DPD', methodType: 'delivery', price: 590, isFree: false },
  {
    _id: 'pu1', title: 'Abholung im Weingut', methodType: 'pickup', price: 0, isFree: true, deliveryTime: '1–2 Werktage',
    pickupAddress: { line1: 'Eisenstätter Straße 10', zip: '7061', city: 'Trausdorf', country: 'AT' },
    pickupInstructions: 'Mo–Fr 9–17', pickupHoldDays: 14,
  },
]

// The relevant part of core/components/checkout.njk.
function page(): HTMLElement {
  document.body.innerHTML = `
    <div data-checkout data-t-address-delivery="Lieferung" data-t-address-billing="Rechnungsadresse">
      <form data-checkout-form>
        <fieldset data-checkout-fulfillment hidden>
          <legend>Versand oder Abholung</legend>
          <div data-checkout-fulfillment-options></div>
          <div data-checkout-pickup-details id="checkout-pickup-details" hidden></div>
        </fieldset>
        <p data-checkout-fulfillment-status class="sr-only" role="status"></p>
        <fieldset data-checkout-address-section>
          <legend data-checkout-address-legend>Lieferung</legend>
          <input name="contactEmail" value="a@b.at">
          <input name="shipping.prename" value="Max"><input name="shipping.lastname" value="Muster">
          <input name="shipping.line1" value="Bahnhofstr. 1"><input name="shipping.zip" value="8001">
          <input name="shipping.city" value="Zürich">
          <select name="shipping.country" data-checkout-country><option value="CH" selected>Schweiz</option></select>
          <input name="shipping.phone" value="">
          <span data-checkout-error="shipping.country"></span>
        </fieldset>
        <fieldset data-checkout-billing-section>
          <legend class="sr-only">Rechnungsadresse</legend>
          <input type="checkbox" data-checkout-same-billing>
          <div data-checkout-billing-fields>
            <input name="billing.prename" value=""><input name="billing.lastname" value="">
            <input name="billing.line1" value=""><input name="billing.zip" value="">
            <input name="billing.city" value=""><select name="billing.country"><option value=""></option></select>
          </div>
        </fieldset>
        <fieldset data-checkout-shipping-section><legend>Versand</legend><div data-checkout-shipping></div></fieldset>
      </form>
    </div>`
  return document.body
}

describe('CheckoutFulfillment', () => {
  beforeEach(() => { page() })
  const make = () => new CheckoutFulfillment(document.querySelector<HTMLElement>('[data-checkout-fulfillment]')!, labels)

  it('stays hidden without a pickup method', () => {
    const f = make()
    f.render([methods[0]], undefined, fmt)
    expect(document.querySelector<HTMLElement>('[data-checkout-fulfillment]')!.hidden).toBe(true)
    expect(f.getPickupId()).toBeUndefined()
  })

  it('renders "Versand" + one radio per pickup, delivery checked by default', () => {
    const f = make()
    f.render(methods, undefined, fmt)
    const radios = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="fulfillment"]'))
    expect(radios.map(r => r.value)).toEqual(['delivery', 'pu1'])
    expect(radios[0].checked).toBe(true)
    expect(radios[1].getAttribute('aria-describedby')).toBe('checkout-pickup-details')
    expect(radios[1].closest('label')!.textContent).toContain('kostenlos')
    expect(f.getPickupId()).toBeUndefined()
  })

  it('choosing pickup reports its id and shows its details; the status region exists beforehand', () => {
    expect(document.querySelector('[data-checkout-fulfillment-status]')).not.toBeNull()
    const f = make()
    const onChange = vi.fn()
    f.setOnChange(onChange)
    f.render(methods, undefined, fmt)
    const pickupRadio = document.querySelector<HTMLInputElement>('input[value="pu1"]')!
    pickupRadio.checked = true
    pickupRadio.dispatchEvent(new Event('change'))
    expect(onChange).toHaveBeenCalledWith('pu1')
    const details = document.querySelector<HTMLElement>('[data-checkout-pickup-details]')!
    expect(details.hidden).toBe(false)
    expect(details.textContent).toContain('Eisenstätter Straße 10')
    expect(details.textContent).toContain('Mo–Fr 9–17')
    expect(details.textContent).toContain('Abholbereit in: 1–2 Werktage')
    expect(details.textContent).toContain('14 Tage')
  })

  it('a pickup that disappears falls back to delivery', () => {
    const f = make()
    f.render(methods, undefined, fmt)
    f.select('pu1')
    f.render([methods[0], { ...methods[1], _id: 'pu2' }], 'pu1', fmt)
    expect(f.getPickupId()).toBeUndefined()
  })
})

describe('CheckoutForm — pickup mode', () => {
  beforeEach(() => { page() })

  it('hides the billing and shipping-method fieldsets and swaps the legend', () => {
    const form = new CheckoutForm(document.querySelector('form')!)
    form.setPickupMode(true)
    expect(document.querySelector<HTMLElement>('[data-checkout-billing-section]')!.hidden).toBe(true)
    expect(document.querySelector<HTMLElement>('[data-checkout-shipping-section]')!.hidden).toBe(true)
    expect(document.querySelector('[data-checkout-address-legend]')!.textContent).toBe('Rechnungsadresse')
    form.setPickupMode(false)
    expect(document.querySelector<HTMLElement>('[data-checkout-billing-section]')!.hidden).toBe(false)
    expect(document.querySelector<HTMLElement>('[data-checkout-shipping-section]')!.hidden).toBe(false)
    expect(document.querySelector('[data-checkout-address-legend]')!.textContent).toBe('Lieferung')
    // back on delivery the billing fields follow the (unchecked) box again
    expect(document.querySelector<HTMLElement>('[data-checkout-billing-fields]')!.hidden).toBe(false)
  })

  it('pickup: no billing address sent and the (empty) billing fields are not validated', () => {
    const form = new CheckoutForm(document.querySelector('form')!)
    // "same as shipping" unchecked with empty billing fields → delivery validation fails
    expect(form.validate().some(e => e.field.startsWith('billing.'))).toBe(true)
    form.setPickupMode(true)
    expect(form.validate()).toEqual([])
    expect(form.getBillingAddress()).toBeUndefined()
    expect(form.getShippingAddress()).toMatchObject({ name: 'Max Muster', country: 'CH' })
  })

  it('the optional phone is sent only when filled', () => {
    const form = new CheckoutForm(document.querySelector('form')!)
    expect(form.getShippingAddress().phone).toBeUndefined()
    document.querySelector<HTMLInputElement>('[name="shipping.phone"]')!.value = '+41 44 1234567'
    expect(form.getShippingAddress().phone).toBe('+41 44 1234567')
  })
})

describe('CheckoutShipping', () => {
  beforeEach(() => { page() })
  it('lists delivery methods only; none → the "not possible" note', () => {
    const el = document.querySelector<HTMLElement>('[data-checkout-shipping]')!
    const s = new CheckoutShipping(el)
    s.render(methods, 'dpd', fmt, 'Versand in dieses Land ist nicht möglich.')
    expect(Array.from(el.querySelectorAll('input')).map(i => i.value)).toEqual(['dpd'])
    s.render([methods[1]], null, fmt, 'Versand in dieses Land ist nicht möglich.')
    expect(el.textContent).toBe('Versand in dieses Land ist nicht möglich.')
  })
})
