import type { EmailSettingsQueryResult } from '../services/sanity'
import type { EmailAddress, EmailCompany, EmailShopSettings } from '../templates/email/types'

function toEmailAddress(
  a: EmailSettingsQueryResult['billingAddress'],
): EmailAddress | null {
  if (!a) return null
  return {
    line1: a.line1 ?? '',
    line2: a.line2 ?? null,
    zip: a.zip ?? '',
    city: a.city ?? '',
    country: a.country ?? '',
  }
}

function toEmailCompany(c: EmailSettingsQueryResult['company']): EmailCompany | null {
  if (!c) return null
  return {
    name: c.name ?? null,
    owner: c.owner ?? null,
    email: c.email ?? null,
    phone: c.phone ?? null,
    vatId: c.vatId ?? null,
    registerNumber: c.registerNumber ?? null,
    registerCourt: c.registerCourt ?? null,
    address: c.address?.line1 ? toEmailAddress(c.address) : null,
  }
}

/**
 * Map the `shopSettings` query result to the `EmailShopSettings` shape the email
 * templates consume. Single source of truth for this mapping — used by every
 * notifier (order / auth / withdrawal).
 *
 * Callers must have validated that `shopName`/`senderName`/`senderEmail` are
 * present. `baseUrl` is resolved by the caller, since env precedence differs
 * between flows (auth prefers PUBLIC_URL for tunnel testing).
 */
export function buildEmailShopSettings(
  raw: EmailSettingsQueryResult,
  baseUrl: string,
): EmailShopSettings {
  return {
    shopName: raw.shopName ?? '',
    senderName: raw.senderName ?? '',
    senderEmail: raw.senderEmail ?? '',
    baseUrl,
    logoUrl: null,
    logoWidth: null,
    logoHeight: null,
    billingAddress: toEmailAddress(raw.billingAddress),
    bankAccount:
      raw.bankAccount?.name && raw.bankAccount.iban && raw.bankAccount.bic
        ? { name: raw.bankAccount.name, iban: raw.bankAccount.iban, bic: raw.bankAccount.bic }
        : null,
    orderNumberPrefix: raw.orderNumberPrefix,
    invoiceNumberPrefix: raw.invoiceNumberPrefix,
    returnAddress: toEmailAddress(raw.returnAddress),
    returnShippingBorneBy: raw.returnShippingBorneBy ?? 'customer',
    returnPolicyNote: raw.returnPolicyNote,
    shopNotificationEmail: raw.shopNotificationEmail || raw.senderEmail || '',
    withdrawalPeriodStart: raw.withdrawalPeriodStart ?? 'multipleGoods',
    withdrawalExceptions: raw.withdrawalExceptions ?? [],
    company: toEmailCompany(raw.company),
  }
}
