import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  buildWithdrawalInstructions,
  missingWithdrawalData,
  type WithdrawalInstructionsInput,
} from '../withdrawal-instructions'
import { serverT } from '../../netlify/utils/i18n'

const t = (key: string, params?: Record<string, string>) => serverT('de', key, params)

const input = (over: Partial<WithdrawalInstructionsInput> = {}): WithdrawalInstructionsInput => ({
  trader: {
    name: 'Weingut Test',
    address: { line1: 'Hauptstraße 1', zip: '3550', city: 'Langenlois', country: 'AT' },
    phone: '+43 1 234',
    email: 'office@shop.example',
  },
  returnShippingBorneBy: 'customer',
  periodStart: 'multipleGoods',
  withdrawUrl: 'https://shop.example/de/widerruf/',
  countryName: (c) => (c === 'AT' ? 'Österreich' : c),
  ...over,
})

const text = (wi: ReturnType<typeof buildWithdrawalInstructions>) =>
  JSON.stringify(wi)

describe('withdrawal instructions', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('fills the trader identity and the online function sentence', () => {
    const wi = buildWithdrawalInstructions(input(), t)!
    const how = wi.sections[0].paragraphs[2]
    expect(how).toContain('müssen Sie uns (Weingut Test, Hauptstraße 1, 3550 Langenlois, Österreich, Tel. +43 1 234, E-Mail office@shop.example)')
    expect(how).toContain('auch online unter https://shop.example/de/widerruf/ ausüben')
    expect(wi.form.to).toBe('An Weingut Test, Hauptstraße 1, 3550 Langenlois, Österreich, office@shop.example:')
  })

  it.each([
    ['goods', 'die Waren in Besitz genommen'],
    ['multipleGoods', 'die letzte Ware in Besitz genommen'],
    ['partialDeliveries', 'die letzte Teilsendung oder das letzte Stück'],
    ['subscription', 'die erste Ware in Besitz genommen'],
  ] as const)('period start %s', (periodStart, expected) => {
    expect(buildWithdrawalInstructions(input({ periodStart }), t)!.sections[0].paragraphs[1]).toContain(expected)
  })

  it('return costs follow returnShippingBorneBy', () => {
    expect(text(buildWithdrawalInstructions(input(), t))).toContain('Sie tragen die unmittelbaren Kosten der Rücksendung')
    expect(text(buildWithdrawalInstructions(input({ returnShippingBorneBy: 'merchant' }), t))).toContain('Wir tragen die Kosten der Rücksendung')
  })

  it('always says the refund may be withheld until the goods are back', () => {
    expect(buildWithdrawalInstructions(input(), t)!.sections[1].paragraphs[0]).toContain('Wir können die Rückzahlung verweigern')
  })

  it('return address: "an uns" or the separate address', () => {
    expect(text(buildWithdrawalInstructions(input(), t))).toContain(', an uns zurückzusenden')
    const wi = buildWithdrawalInstructions(input({ returnAddress: { line1: 'Lager 5', zip: '3550', city: 'Gobelsburg', country: 'AT' } }), t)
    expect(text(wi)).toContain('an Weingut Test, Lager 5, 3550 Gobelsburg, Österreich zurückzusenden')
  })

  it('exceptions and the return note are separate blocks', () => {
    const wi = buildWithdrawalInstructions(input({ exceptions: ['alcoholMarketPrice', 'bogus'], returnPolicyNote: 'Bitte gut verpacken.' }), t)!
    expect(wi.exceptions!.items).toHaveLength(1)
    expect(wi.exceptions!.items[0]).toContain('alkoholische Getränke')
    expect(wi.note!.text).toBe('Bitte gut verpacken.')
    expect(text({ ...wi, exceptions: null, note: null })).not.toContain('alkoholische')
    expect(buildWithdrawalInstructions(input(), t)!.exceptions).toBeNull()
  })

  it('missing trader data → null (never a half-filled legal text)', () => {
    const bad = input({ trader: { name: 'X', address: null, email: '' } })
    expect(buildWithdrawalInstructions(bad, t)).toBeNull()
    expect(missingWithdrawalData(bad)).toEqual(['company.address', 'company.email'])
  })

  it('English: the directive wording with the same variants', () => {
    const en = (key: string, params?: Record<string, string>) => serverT('en', key, params)
    const wi = buildWithdrawalInstructions(input({ returnShippingBorneBy: 'merchant' }), en)!
    expect(wi.sections[0].paragraphs[1]).toBe('The withdrawal period will expire after 14 days from the day on which you acquire, or a third party other than the carrier and indicated by you acquires, physical possession of the last good.')
    expect(wi.sections[0].paragraphs[2]).toContain('You can also exercise your right of withdrawal online at https://shop.example/de/widerruf/.')
    expect(text(wi)).toContain('We will bear the cost of returning the goods.')
    expect(wi.form.heading).toBe('Model withdrawal form')
  })

  it('"Du" changes only the forms of address', () => {
    vi.stubEnv('SHOP_FORMALITY', 'informal')
    const wi = buildWithdrawalInstructions(input(), t)!
    expect(wi.sections[0].paragraphs[0]).toBe('Du hast das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.')
    expect(text(wi)).not.toMatch(/\b(Sie|Ihnen|Ihr|Ihre|Ihren)\b/)
  })
})
