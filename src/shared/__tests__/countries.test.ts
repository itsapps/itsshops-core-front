import isoCountries from 'i18n-iso-countries'
import { describe, expect, it } from 'vitest'

import { COUNTRY_CODES, isCountryCode } from '../countries'

describe('COUNTRY_CODES', () => {
  it('equals the i18n-iso-countries alpha-2 list', () => {
    expect([...COUNTRY_CODES].sort()).toEqual(Object.keys(isoCountries.getAlpha2Codes()).sort())
  })
  it('isCountryCode', () => {
    expect(isCountryCode('CH')).toBe(true)
    expect(isCountryCode('ch')).toBe(false)
    expect(isCountryCode('XX')).toBe(false)
    expect(isCountryCode(undefined)).toBe(false)
  })
})
