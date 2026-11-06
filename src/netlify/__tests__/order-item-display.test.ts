import { describe, it, expect } from 'vitest'
import { bundleItemLines, composeSubtitle } from '../lib/order-item-display'

describe('bundleItemLines', () => {
  it('quantity per bundle, totalQuantity × the line quantity, rates', () => {
    expect(bundleItemLines({
      quantity: 2,
      bundle: { items: [
        { quantity: 2, title: 'Wein', subtitle: '2023 · 750 ml', vatRate: 13 },
        { quantity: 1, title: 'Saft', vatRate: 20 },
      ] },
    })).toEqual([
      { quantity: 2, totalQuantity: 4, title: 'Wein', subtitle: '2023 · 750 ml', vatRate: 13 },
      { quantity: 1, totalQuantity: 2, title: 'Saft', subtitle: null, vatRate: 20 },
    ])
  })

  it('no rate stored → null; old order or plain line → []', () => {
    expect(bundleItemLines({ quantity: 1, bundle: { items: [{ quantity: 1, title: 'A' }] } })[0].vatRate).toBeNull()
    expect(bundleItemLines({ quantity: 1, bundle: {} })).toEqual([])
    expect(bundleItemLines({ quantity: 1 })).toEqual([])
  })
})

describe('composeSubtitle', () => {
  it('bundle: "2× A, 1× B" from the items; none without items', () => {
    expect(composeSubtitle('bundle', null, null, [{ quantity: 2, title: 'A' }, { quantity: 1, title: 'B' }])).toBe('2× A, 1× B')
    expect(composeSubtitle('bundle', null, null, [])).toBeNull()
  })

  it('wine and options unchanged', () => {
    expect(composeSubtitle('wine', { vintage: '2022', volume: 1500 }, null)).toBe('2022 · 1,5 l')
    expect(composeSubtitle('physical', null, [{ groupTitle: 'Farbe', optionTitle: 'Rot' }])).toBe('Farbe: Rot')
  })
})
