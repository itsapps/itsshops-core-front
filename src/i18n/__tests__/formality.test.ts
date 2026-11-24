import { describe, it, expect, afterEach, vi } from 'vitest'
import de11ty from '../translations/de_11ty'
import deServer from '../translations/de_server'
import deShared from '../translations/de_shared'
import de11tyInformal from '../translations/de_11ty.informal'
import deServerInformal from '../translations/de_server.informal'
import deSharedInformal from '../translations/de_shared.informal'
import { readFormality } from '../formality'
import { serverT, shopTimeZone, formatShopDate, DEFAULT_SHOP_TIMEZONE } from '../../netlify/utils/i18n'

/** Dot-paths of every string leaf. */
function leafKeys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? leafKeys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  )
}

describe('informal overlays', () => {
  it.each([
    ['de_11ty', de11ty, de11tyInformal],
    ['de_server', deServer, deServerInformal],
    ['de_shared', deShared, deSharedInformal],
  ])('%s overlay only contains keys of its base', (_name, base, overlay) => {
    const baseKeys = new Set(leafKeys(base))
    expect(leafKeys(overlay).filter(k => !baseKeys.has(k))).toEqual([])
  })
})

describe('readFormality', () => {
  it('defaults to formal', () => {
    expect(readFormality(undefined)).toBe('formal')
    expect(readFormality('')).toBe('formal')
  })

  it('reads informal', () => {
    expect(readFormality('informal')).toBe('informal')
  })

  it('falls back to formal on an invalid value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(readFormality('du')).toBe('formal')
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })
})

describe('serverT form of address', () => {
  afterEach(() => { vi.unstubAllEnvs() })

  it('uses "Sie" without SHOP_FORMALITY', () => {
    vi.stubEnv('SHOP_FORMALITY', '')
    expect(serverT('de', 'emails.orderConfirmation.preview')).toBe('Danke für Ihren Einkauf!')
  })

  it('uses "Du" with SHOP_FORMALITY=informal', () => {
    vi.stubEnv('SHOP_FORMALITY', 'informal')
    expect(serverT('de', 'emails.orderConfirmation.preview')).toBe('Danke für Deinen Einkauf!')
  })

  it('keeps strings without address and English unchanged', () => {
    vi.stubEnv('SHOP_FORMALITY', 'informal')
    expect(serverT('de', 'emails.orderNumber')).toBe('Bestellnummer')
    expect(serverT('en', 'emails.orderNumber')).toBe(serverT('en', 'emails.orderNumber'))
  })
})

describe('shop timezone', () => {
  afterEach(() => { vi.unstubAllEnvs() })

  it('defaults to Europe/Vienna', () => {
    expect(shopTimeZone(undefined)).toBe(DEFAULT_SHOP_TIMEZONE)
  })

  it('accepts a valid IANA name', () => {
    expect(shopTimeZone('Europe/Berlin')).toBe('Europe/Berlin')
  })

  it('falls back on an invalid value without throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(shopTimeZone('Mars/Olympus')).toBe(DEFAULT_SHOP_TIMEZONE)
    warn.mockRestore()
  })

  it('formats date and time in the shop timezone', () => {
    vi.stubEnv('SHOP_TIMEZONE', '')
    // 23:30 UTC on 31 Dec is already 1 Jan in Vienna (CET, UTC+1)
    const s = formatShopDate('2025-12-31T23:30:00Z', 'de', { withTime: true })
    expect(s).toContain('1. Januar 2026')
    expect(s).toContain('00:30')
  })
})
