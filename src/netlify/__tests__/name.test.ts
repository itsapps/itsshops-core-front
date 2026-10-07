import { describe, it, expect } from 'vitest'
import { splitNameForExport } from '../utils/name'

describe('splitNameForExport', () => {
  it('uses the typed first/last name when present (manual checkout)', () => {
    expect(splitNameForExport({ name: 'Anna Maria Muster', prename: 'Anna Maria', lastname: 'Muster' }))
      .toEqual({ firstName: 'Anna Maria', lastName: 'Muster' })
  })

  it('splits a full name: last word is the last name (express checkout)', () => {
    expect(splitNameForExport({ name: 'Maria von Trapp' })).toEqual({ firstName: 'Maria von', lastName: 'Trapp' })
    expect(splitNameForExport({ name: '  Anna   Muster ', prename: null, lastname: null }))
      .toEqual({ firstName: 'Anna', lastName: 'Muster' })
  })

  it('never drops a single-word name', () => {
    expect(splitNameForExport({ name: 'Madonna' })).toEqual({ firstName: '', lastName: 'Madonna' })
  })

  it('handles missing names', () => {
    expect(splitNameForExport({ name: null })).toEqual({ firstName: '', lastName: '' })
    expect(splitNameForExport({})).toEqual({ firstName: '', lastName: '' })
  })
})
