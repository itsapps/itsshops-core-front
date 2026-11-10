import { describe, it, expect } from 'vitest'
import { findUndefinedColorVars } from '../css-color-check'

describe('findUndefinedColorVars', () => {
  it('ignores defined roles', () => {
    expect(findUndefinedColorVars(':root { --color-text: #111; } p { color: var(--color-text); }')).toEqual([])
  })
  it('reports undefined roles once, sorted', () => {
    const css = 'a { color: var(--color-link); } b { color: var(--color-accent); } i { color: var( --color-link ); }'
    expect(findUndefinedColorVars(css)).toEqual(['--color-accent', '--color-link'])
  })
  it('skips a use with a fallback', () => {
    expect(findUndefinedColorVars('p { color: var(--color-error, #b3261e); }')).toEqual([])
  })
  it('counts an undefined role inside a fallback', () => {
    expect(findUndefinedColorVars('p { color: var(--color-a, var(--color-b)); }')).toEqual(['--color-b'])
  })
  it('works on minified CSS', () => {
    expect(findUndefinedColorVars(':root{--color-bg:#fff}body{background:var(--color-bg);color:var(--color-ink)}')).toEqual(['--color-ink'])
  })
})
