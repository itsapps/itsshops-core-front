import { describe, it, expect, vi, afterEach } from 'vitest'
import { resolveLocaleRegions } from '../config'

describe('resolveLocaleRegions', () => {
  afterEach(() => vi.restoreAllMocks())

  it('defaults to de_DE / en_GB', () => {
    expect(resolveLocaleRegions()).toEqual({ de: 'DE', en: 'GB' })
  })

  it('overrides one locale and keeps the other default', () => {
    expect(resolveLocaleRegions({ de: 'AT' })).toEqual({ de: 'AT', en: 'GB' })
  })

  it('normalises case and whitespace', () => {
    expect(resolveLocaleRegions({ de: ' at ' })).toEqual({ de: 'AT', en: 'GB' })
  })

  it.each(['AUT', ''])('falls back to the default and warns for %j', (value) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(resolveLocaleRegions({ de: value })).toEqual({ de: 'DE', en: 'GB' })
    expect(warn).toHaveBeenCalledTimes(1)
  })
})
