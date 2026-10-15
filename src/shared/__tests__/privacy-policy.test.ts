import { describe, it, expect } from 'vitest'
import de11ty from '../../i18n/translations/de_11ty'
import en11ty from '../../i18n/translations/en_11ty'
import de11tyInformal from '../../i18n/translations/de_11ty.informal'
import { mergeTranslations } from '../../i18n/merge-translations'
import {
  buildPrivacyPolicy,
  missingPrivacyData,
  type PrivacyPolicyInput,
  type PrivacyPolicy,
} from '../privacy-policy'
import { richToText } from '../withdrawal-instructions'

/** Minimal i18next stand-in: dot-path lookup + {{param}} interpolation; the key when missing. */
const translator = (strings: object) => (key: string, params: Record<string, string> = {}) => {
  const value = key.split('.').reduce<any>((o, k) => o?.[k], strings)
  return typeof value === 'string' ? value.replace(/\{\{(\w+)\}\}/g, (_, p) => params[p] ?? '') : key
}
const tDe = translator(de11ty)
const tEn = translator(en11ty)
const tDu = translator(mergeTranslations(de11ty, de11tyInformal))

const input = (over: Partial<PrivacyPolicyInput> = {}): PrivacyPolicyInput => ({
  company: {
    name: 'Weingut Test',
    address: { line1: 'Hauptstraße 1', zip: '7000', city: 'Eisenstadt', country: 'AT' },
    email: 'shop@weingut.example',
  },
  // Tinhof-like: checkout + vinofact, Resend, wineNET, withdrawal function, delivery
  features: { checkout: true, users: false, newsletter: false, vinofact: true, ageGate: false },
  hasDelivery: true,
  hasWithdrawal: true,
  services: { emailProvider: 'resend', mailgunEu: true, wcApi: true },
  captcha: false,
  orderMetaRetentionDays: 30,
  countryName: (c) => (c === 'AT' ? 'Österreich' : c),
  formatUpdated: () => 'Oktober 2026',
  ...over,
})

const ids = (p: PrivacyPolicy | null) => p!.sections.map((s) => s.id)
const section = (p: PrivacyPolicy | null, id: string) => p!.sections.find((s) => s.id === id)!
const text = (p: PrivacyPolicy | null, id: string) => section(p, id).paragraphs.map(richToText).join('\n')

describe('privacy policy', () => {
  it('builds the sections of a Tinhof-like shop, in order', () => {
    expect(ids(buildPrivacyPolicy(input(), tDe))).toEqual([
      'controller', 'overview', 'hosting', 'content', 'orders', 'payment', 'email', 'withdrawal',
      'orderSystem', 'vinofact', 'storage', 'required', 'automated', 'rights', 'complaint',
    ])
  })

  it('adds account, newsletter and spam protection for a full config', () => {
    const p = buildPrivacyPolicy(input({
      features: { checkout: true, users: true, newsletter: true, vinofact: false, ageGate: true },
      captcha: true,
    }), tDe)
    expect(ids(p)).toEqual(expect.arrayContaining(['account', 'newsletter', 'captcha']))
    expect(text(p, 'captcha')).toContain('(Registrierung, Passwort vergessen, Newsletter)')
    expect(section(p, 'storage').items).toContain('Ihre Bestätigung des Mindestalters,')
  })

  it('leaves out shop sections on a site without checkout', () => {
    const p = buildPrivacyPolicy(input({
      features: { checkout: false, users: false, newsletter: false, vinofact: false, ageGate: false },
      services: { emailProvider: 'resend', mailgunEu: true, wcApi: true },
    }), tDe)
    expect(ids(p)).toEqual(['controller', 'overview', 'hosting', 'content', 'storage', 'automated', 'rights', 'complaint'])
    expect(text(p, 'overview')).not.toContain('bestellen')
    expect(section(p, 'storage').items).toEqual(['Ihre letzten Suchbegriffe.'])
  })

  it('returns null and lists missing company data', () => {
    const bad = input({ company: { name: ' ', address: null, email: '' } })
    expect(buildPrivacyPolicy(bad, tDe)).toBeNull()
    expect(missingPrivacyData(bad)).toEqual(['company.name', 'company.address', 'company.email'])
  })

  it('renders extra sections right after embedded content, skipping empty ones', () => {
    const p = buildPrivacyPolicy(input({
      extraSections: [
        { heading: 'Karte', text: 'OpenStreetMap …\n\nZweiter Absatz.' },
        { heading: 'Leer', text: '  ' },
      ],
    }), tDe)
    expect(ids(p).slice(ids(p).indexOf('vinofact'), ids(p).indexOf('vinofact') + 3)).toEqual(['vinofact', 'extra-1', 'storage'])
    expect(section(p, 'extra-1').paragraphs.map(richToText)).toEqual(['OpenStreetMap …', 'Zweiter Absatz.'])
  })

  it('states the carrier only with a delivery method, and the cleanup period', () => {
    expect(text(buildPrivacyPolicy(input(), tDe), 'orders')).toContain('Paketdienstleistungsunternehmen')
    expect(text(buildPrivacyPolicy(input(), tDe), 'orders')).toContain('nach 30 Tagen')
    expect(text(buildPrivacyPolicy(input({ hasDelivery: false }), tDe), 'orders')).not.toContain('Paketdienst')
  })

  it('names the email provider and its region', () => {
    expect(text(buildPrivacyPolicy(input(), tDe), 'email')).toMatch(/Resend[\s\S]*Data Privacy Framework/)
    const eu = buildPrivacyPolicy(input({ services: { emailProvider: 'mailgun', mailgunEu: true, wcApi: false } }), tDe)
    expect(text(eu, 'email')).toMatch(/Mailgun[\s\S]*in der EU verarbeitet/)
    const us = buildPrivacyPolicy(input({ services: { emailProvider: 'mailgun', mailgunEu: false, wcApi: false } }), tDe)
    expect(text(us, 'email')).toContain('EU-Standardvertragsklauseln')
  })

  it('mentions the DPO only when a contact is set', () => {
    expect(text(buildPrivacyPolicy(input(), tDe), 'controller')).not.toContain('Datenschutzbeauftragte')
    expect(text(buildPrivacyPolicy(input({ dpoContact: 'dsb@weingut.example' }), tDe), 'controller'))
      .toContain('dsb@weingut.example')
  })

  it('links the company email and provider privacy policies', () => {
    const p = buildPrivacyPolicy(input(), tDe)
    expect(section(p, 'rights').paragraphs[0]).toContainEqual({ text: 'shop@weingut.example', href: 'mailto:shop@weingut.example' })
    expect(section(p, 'hosting').paragraphs[0]).toContainEqual({ text: 'Netlify, Inc.', href: 'https://www.netlify.com/privacy/' })
    expect(p!.updated).toBe('Stand: Oktober 2026')
  })

  it('addresses the reader as Du with the informal overlay, and translates to English', () => {
    expect(text(buildPrivacyPolicy(input(), tDu), 'rights')).toMatch(/^Du hast das Recht/)
    expect(text(buildPrivacyPolicy(input(), tDu), 'orders')).toContain('Wenn Du bestellst')
    expect(section(buildPrivacyPolicy(input(), tEn), 'rights').heading).toBe('Your rights')
  })

  it('has every key it uses in all languages', () => {
    const full = input({
      features: { checkout: true, users: true, newsletter: true, vinofact: true, ageGate: true },
      captcha: true,
      dpoContact: 'x',
    })
    for (const t of [tDe, tEn, tDu]) {
      expect(JSON.stringify(buildPrivacyPolicy(full, t))).not.toMatch(/"privacyPolicy\./)
    }
  })
})
