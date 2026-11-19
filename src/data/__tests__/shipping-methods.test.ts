import { describe, it, expect } from 'vitest'
import { resolveShippingMethods } from '../resolve/settings'

const ctx = { resolveString: (x: unknown) => (typeof x === 'string' ? x : '') } as never

describe('resolveShippingMethods — pickup (Versand & Zahlung page)', () => {
  it('a pickup method shows no leftover rates, countries, packaging or threshold', () => {
    const [m] = resolveShippingMethods([{
      _id: 'pu1', title: 'Abholung im Weingut', methodType: 'pickup', pickupFee: 0,
      freeShippingThreshold: 10000,
      countries: [{ countryCode: 'AT', enabled: true }],
      rates: [{ maxWeight: 5, price: 500 }],
      packagingGroups: [{ bottles: [{ volume: 750 }], packages: [{ places: 6, price: 900 }] }],
      pickupAddress: { line1: 'Eisenstätter Straße 10', zip: '7061', city: 'Trausdorf', country: 'AT' },
      pickupInstructions: 'Mo–Fr 9–17',
      pickupHoldDays: 14,
    }], ctx)
    expect(m).toMatchObject({
      methodType: 'pickup', countries: [], rates: [], packagingGroups: [], freeShippingThreshold: null,
      pickupAddress: { line1: 'Eisenstätter Straße 10', zip: '7061', city: 'Trausdorf', country: 'AT' },
      pickupInstructions: 'Mo–Fr 9–17', pickupHoldDays: 14,
    })
  })

  it('a delivery method keeps its data and has no pickup fields', () => {
    const [m] = resolveShippingMethods([{
      _id: 'dpd', title: 'DPD', methodType: 'delivery', countries: [{ countryCode: 'AT', enabled: true }],
      rates: [{ maxWeight: 5, price: 500 }], pickupAddress: { line1: 'x' }, pickupHoldDays: 3,
    }], ctx)
    expect(m).toMatchObject({ countries: ['AT'], rates: [{ maxWeight: 5, price: 500 }], pickupAddress: null, pickupHoldDays: null })
  })

  it('home-country methods first; pickup (no countries) last', () => {
    const methods = resolveShippingMethods([
      { _id: 'pu1', title: 'Abholung', methodType: 'pickup' },
      { _id: 'dpd', title: 'DPD', methodType: 'delivery', countries: [{ countryCode: 'AT', enabled: true }] },
    ], ctx, 'AT')
    expect(methods.map(m => m._id)).toEqual(['dpd', 'pu1'])
  })
})
