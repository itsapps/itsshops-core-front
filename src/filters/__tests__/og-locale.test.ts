import { describe, it, expect } from 'vitest'
import { ogLocale } from '../index'

describe('ogLocale', () => {
  it('joins locale and region with an underscore', () => {
    expect(ogLocale('de', { de: 'AT' })).toBe('de_AT')
    expect(ogLocale('en', { en: 'GB' })).toBe('en_GB')
  })

  it('returns the locale as is without a region', () => {
    expect(ogLocale('de', {})).toBe('de')
  })
})
