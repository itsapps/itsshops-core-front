import { describe, it, expect } from 'vitest'
import { createPriceFormatter } from '../price'

// Intl output uses narrow no-break spaces in some locales — normalise for comparison.
const norm = (s: string) => s.replace(/[  ]/g, ' ')

describe('createPriceFormatter', () => {
  it('formats cents as Intl currency', () => {
    expect(norm(createPriceFormatter({ locale: 'de', currency: 'EUR' })(123456))).toBe('1.234,56 €')
    expect(norm(createPriceFormatter({ locale: 'en', currency: 'EUR' })(123456))).toBe('€1,234.56')
  })

  it('uses the currency label instead of the Intl currency when set', () => {
    const format = createPriceFormatter({ locale: 'de', currency: 'EUR', currencyLabel: 'EUR' })
    expect(norm(format(1500))).toBe('15,00 EUR')
  })

  it('always shows two fraction digits', () => {
    expect(norm(createPriceFormatter({ locale: 'de', currency: 'EUR' })(1000))).toBe('10,00 €')
    expect(norm(createPriceFormatter({ locale: 'de', currency: 'EUR', currencyLabel: '€' })(5))).toBe('0,05 €')
  })
})

describe('createPriceFormatter with a regional tag', () => {
  it('de-AT puts the euro sign first', () => {
    expect(norm(createPriceFormatter({ locale: 'de-AT', currency: 'EUR' })(123450))).toBe('€ 1.234,50')
  })

  it('en-GB formats prices like en', () => {
    expect(createPriceFormatter({ locale: 'en-GB', currency: 'EUR' })(123450))
      .toBe(createPriceFormatter({ locale: 'en', currency: 'EUR' })(123450))
  })

  it('de-AT groups plain numbers with a no-break space', () => {
    expect(new Intl.NumberFormat('de-AT').format(1234.5)).toBe('1\u00a0234,5')
  })
})

