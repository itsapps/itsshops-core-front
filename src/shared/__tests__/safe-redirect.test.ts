import { describe, it, expect } from 'vitest'
import { safeRedirectPath } from '../safe-redirect'

const ORIGIN = 'https://shop.example'
const FALLBACK = '/de/'
const redirect = (next: string | null) => safeRedirectPath(next, ORIGIN, FALLBACK)

describe('safeRedirectPath', () => {
  it.each([
    '//evil.com',
    '/\\evil.com',
    'https://evil.com',
    'https://evil.com/de/konto/',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'http://shop.example/de/', // other scheme → other origin
  ])('rejects %s', (next) => {
    expect(redirect(next)).toBe(FALLBACK)
  })

  it('keeps an already decoded %2F%2F as a path on the same origin', () => {
    // searchParams.get('next') of `?next=%252F%252Fevil.com` → '%2F%2Fevil.com', a relative path
    expect(redirect('%2F%2Fevil.com')).toBe('/%2F%2Fevil.com')
  })

  it('empty or null → fallback', () => {
    expect(redirect('')).toBe(FALLBACK)
    expect(redirect(null)).toBe(FALLBACK)
  })

  it('keeps a same-origin path with query and hash', () => {
    expect(redirect('/de/konto/?x=1#y')).toBe('/de/konto/?x=1#y')
    expect(redirect('https://shop.example/de/konto/')).toBe('/de/konto/')
  })
})
