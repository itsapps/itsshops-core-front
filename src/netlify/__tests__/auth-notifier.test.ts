import { describe, it, expect } from 'vitest'
import {
  AuthNotifierError,
  buildAuthCallbackUrl,
  type AuthUserPaths,
} from '../lib/auth-urls'
import { ErrorCode } from '../types/errors'

const userPaths: AuthUserPaths = {
  de: { userConfirm: 'kundenkonto/bestaetigen', userReset: 'kundenkonto/passwort-zuruecksetzen' },
  en: { userConfirm: 'account/confirm',         userReset: 'account/reset-password' },
}

describe('buildAuthCallbackUrl', () => {
  it('routes signup to userConfirm path', () => {
    const url = buildAuthCallbackUrl('https://shop.example', 'de', 'signup', 'tok123', userPaths, 'de')
    expect(url).toBe('https://shop.example/de/kundenkonto/bestaetigen/?token_hash=tok123')
  })

  it('routes recovery to userReset path', () => {
    const url = buildAuthCallbackUrl('https://shop.example', 'de', 'recovery', 'tok123', userPaths, 'de')
    expect(url).toBe('https://shop.example/de/kundenkonto/passwort-zuruecksetzen/?token_hash=tok123')
  })

  it('routes invite to userReset path with type=invite', () => {
    const url = buildAuthCallbackUrl('https://shop.example', 'de', 'invite', 'tok123', userPaths, 'de')
    expect(url).toBe('https://shop.example/de/kundenkonto/passwort-zuruecksetzen/?token_hash=tok123&type=invite')
  })

  it('uses requested locale segment for English', () => {
    const url = buildAuthCallbackUrl('https://shop.example', 'en', 'signup', 'tok', userPaths, 'de')
    expect(url).toBe('https://shop.example/en/account/confirm/?token_hash=tok')
  })

  it('falls back to defaultLocale paths when requested locale has no entry', () => {
    const url = buildAuthCallbackUrl('https://shop.example', 'fr', 'recovery', 'tok', userPaths, 'de')
    // Locale segment uses the requested 'fr', paths fall back to 'de' entries.
    expect(url).toBe('https://shop.example/fr/kundenkonto/passwort-zuruecksetzen/?token_hash=tok')
  })

  it('throws when neither requested nor default locale has paths', () => {
    expect(() =>
      buildAuthCallbackUrl('https://shop.example', 'fr', 'signup', 'tok', userPaths, 'es'),
    ).toThrow(AuthNotifierError)
    try {
      buildAuthCallbackUrl('https://shop.example', 'fr', 'signup', 'tok', userPaths, 'es')
    } catch (err) {
      expect(err).toBeInstanceOf(AuthNotifierError)
      expect((err as AuthNotifierError).code).toBe(ErrorCode.INTERNAL_ERROR)
    }
  })

  it('url-encodes the token_hash', () => {
    const url = buildAuthCallbackUrl('https://shop.example', 'de', 'signup', 'a/b+c=d', userPaths, 'de')
    expect(url).toBe('https://shop.example/de/kundenkonto/bestaetigen/?token_hash=a%2Fb%2Bc%3Dd')
  })
})
