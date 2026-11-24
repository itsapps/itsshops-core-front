import { describe, it, expect } from 'vitest'
import { resolveRedirects } from '../redirects'

describe('resolveRedirects', () => {
  it('returns [] when unset', () => {
    expect(resolveRedirects(undefined)).toEqual([])
  })

  it('defaults to 301, not forced', () => {
    expect(resolveRedirects([{ from: '/alt', to: '/de/neu/' }])).toEqual([
      { from: '/alt', to: '/de/neu/', status: 301, force: false },
    ])
  })

  it('keeps status, force, splats and absolute targets', () => {
    expect(resolveRedirects([
      { from: '/news/*', to: '/de/blog/:splat', status: 302 },
      { from: '/de/x/', to: 'https://example.com/y', force: true },
    ])).toEqual([
      { from: '/news/*', to: '/de/blog/:splat', status: 302, force: false },
      { from: '/de/x/', to: 'https://example.com/y', status: 301, force: true },
    ])
  })

  it.each([
    [{ from: 'alt', to: '/neu' }, 'must start with "/"'],
    [{ from: '/', to: '/neu' }, 'must not be "/"'],
    [{ from: '/a b', to: '/neu' }, 'whitespace'],
    [{ from: '/alt', to: 'neu' }, '`to` must start'],
    [{ from: '/alt', to: '/n eu' }, 'whitespace'],
    [{ from: '/alt', to: '/neu', status: 200 as any }, '`status` must be'],
  ])('rejects %j', (rule, msg) => {
    expect(() => resolveRedirects([rule])).toThrow(msg)
  })

  it('rejects duplicate sources', () => {
    expect(() => resolveRedirects([
      { from: '/alt', to: '/a' },
      { from: '/alt', to: '/b' },
    ])).toThrow('duplicate')
  })
})
