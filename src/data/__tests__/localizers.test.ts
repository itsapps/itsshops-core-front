import { describe, it, expect } from 'vitest'
import { resolveInheritedString } from '../localizers'

const de = (value: string) => ({ language: 'de', value })
const en = (value: string) => ({ language: 'en', value })
const fr = (value: string) => ({ language: 'fr', value })
const r = (v: any, p: any, locale = 'en') => resolveInheritedString(v, p, locale as never, 'de' as never)

describe('resolveInheritedString', () => {
  it('variant[locale] first', () => {
    expect(r([de('V de'), en('V en')], [en('P en')])).toBe('V en')
  })
  it('product[locale] before variant[default]', () => {
    expect(r([de('V de')], [de('P de'), en('P en')])).toBe('P en')
  })
  it('variant[default] before product[default]', () => {
    expect(r([de('V de')], [de('P de')])).toBe('V de')
  })
  it('product[default] before variant[first]', () => {
    expect(r([fr('V fr')], [de('P de')])).toBe('P de')
  })
  it('variant[first] before product[first]', () => {
    expect(r([fr('V fr')], [fr('P fr')])).toBe('V fr')
    expect(r([], [fr('P fr')])).toBe('P fr')
  })
  it('skips blank entries', () => {
    expect(r([en('  '), de('V de')], [en('P en')])).toBe('P en')
    expect(r([en('')], [])).toBe('')
  })
  it('empty or missing arrays → empty string', () => {
    expect(r([], [])).toBe('')
    expect(r(null, undefined)).toBe('')
  })
})
