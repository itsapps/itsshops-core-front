import { describe, it, expect } from 'vitest'

import { renderSimpleEmail } from '../lib/simple-email'
import type { EmailShopSettings } from '../templates/email/types'

const settings = {
  shopName: 'Weingut Test',
  senderName: 'Weingut Test',
  senderEmail: 'noreply@shop.example',
  baseUrl: 'https://shop.example',
  billingAddress: { line1: 'Hauptstraße 1', zip: '3550', city: 'Langenlois', country: 'AT' },
  bankAccount: null,
  orderNumberPrefix: null,
  invoiceNumberPrefix: null,
  returnShippingBorneBy: 'customer',
  shopNotificationEmail: 'orders@shop.example',
} as EmailShopSettings

describe('renderSimpleEmail', () => {
  it('renders the shared layout with headline, text lines and CTA', async () => {
    const html = await renderSimpleEmail({
      locale: 'de',
      settings,
      headline: 'Bitte bestätigen',
      text: 'Zeile eins\nZeile <zwei>',
      cta: { url: 'https://shop.example/de/x/?token=abc', label: 'Bestätigen' },
    })
    expect(html).toMatch(/^<!DOCTYPE html/i)
    expect(html).toContain('Bitte bestätigen')
    expect(html).toContain('Zeile eins')
    expect(html).toContain('Zeile &lt;zwei&gt;')
    expect(html).toContain('href="https://shop.example/de/x/?token=abc"')
    expect(html).toContain('Weingut Test')
  })
})
