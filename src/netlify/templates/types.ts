/**
 * Shared types for server-rendered email templates.
 *
 * Templates are decoupled from the GROQ projection: the notify function builds
 * an `EmailShopSettings` from a fresh query and hands it (plus the loaded order)
 * to whichever template the mailType resolves to.
 */
import type { OrderDocument } from '../types/checkout'
import type { MailType } from '../types/orderTransitions'

export type EmailAddress = {
  line1: string
  line2?: string | null
  zip: string
  city: string
  country: string
}

export type EmailBankAccount = {
  name: string
  bic: string
  iban: string
}

/**
 * Minimal shop settings shape required to render emails.
 * The notify function constructs this from a GROQ query against shopSettings + settings.
 */
export type EmailShopSettings = {
  /** Display name for the shop (from settings.siteTitle or similar). */
  shopName: string
  /** Sender display name (from shopSettings.senderName). */
  senderName: string
  /** Sender email (from shopSettings.senderEmail). */
  senderEmail: string
  /** Public shop URL — used for header logo link and tracking links. */
  baseUrl: string
  /** Optional logo URL. When omitted, the header falls back to the shopName text. */
  logoUrl?: string | null
  /** Logo intrinsic width (px) — required if logoUrl is set. */
  logoWidth?: number | null
  /** Logo intrinsic height (px) — required if logoUrl is set. */
  logoHeight?: number | null
  /** Footer business address. */
  billingAddress: EmailAddress | null
  /** Bank account, optionally rendered on invoices. */
  bankAccount: EmailBankAccount | null
  /** Order/invoice prefixes (mainly used by the PDF invoice). */
  orderNumberPrefix: string | null
  invoiceNumberPrefix: string | null
}

/**
 * Translator function passed into templates. Bound to a specific locale.
 * Supports `{{name}}` interpolation via `params`.
 */
export type EmailTranslator = (key: string, params?: Record<string, string | number>) => string

/**
 * Localized currency formatter bound to a specific locale + currency.
 */
export type EmailFormatPrice = (cents: number) => string

/**
 * Context object passed to every email template render.
 */
export type EmailContext = {
  locale: string
  t: EmailTranslator
  formatPrice: EmailFormatPrice
  settings: EmailShopSettings
}

export type OrderEmailProps = {
  ctx: EmailContext
  order: OrderDocument
  mailType: MailType
}

export type SimpleEmailProps = {
  ctx: EmailContext
  /** Heading shown above the body text. Optional — falls back to a generic greeting. */
  headline?: string
  /** Body text shown in the email. Plain string; line breaks become `<br/>`. */
  text: string
}
