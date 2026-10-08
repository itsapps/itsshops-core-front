import type Stripe from 'stripe'
import type { OrderPaymentMethod } from '../types/checkout'

/**
 * Map the charge's `payment_method_details` (what was actually charged — survives a later
 * detach of the PaymentMethod) to the stored order snapshot. Only PCI-allowed truncation:
 * brand + last 4 (card), last 4 IBAN digits (SEPA). Never card number/IBAN, expiry, CVC.
 */
export function mapPaymentMethodDetails(
  details: Stripe.Charge.PaymentMethodDetails | null | undefined,
): OrderPaymentMethod | null {
  if (!details?.type) return null
  const out: OrderPaymentMethod = { _type: 'orderPaymentMethod', type: details.type }
  if (details.type === 'card' && details.card) {
    if (details.card.brand) out.brand = details.card.brand
    if (details.card.last4) out.last4 = details.card.last4
    if (details.card.wallet?.type) out.wallet = details.card.wallet.type
  } else if (details.type === 'sepa_debit' && details.sepa_debit?.last4) {
    out.last4 = details.sepa_debit.last4
  }
  return out
}

const CARD_BRANDS: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
  diners: 'Diners Club',
  jcb: 'JCB',
  unionpay: 'UnionPay',
  cartes_bancaires: 'Cartes Bancaires',
}

/** Translator that returns the key itself when it's missing (as `serverT` / the email `t`). */
type T = (key: string) => string

/**
 * Readable label: "Visa •••• 4242", "Apple Pay (Visa •••• 4242)", "SEPA-Lastschrift •••• 3000",
 * "EPS". Unknown types fall back to the generic `emails.payment.types.other` label.
 */
export function paymentMethodLabel(p: OrderPaymentMethod, t: T): string {
  const masked = p.last4 ? ` •••• ${p.last4}` : ''
  if (p.type === 'card' && p.brand) {
    const card = `${CARD_BRANDS[p.brand] ?? p.brand.charAt(0).toUpperCase() + p.brand.slice(1)}${masked}`
    if (!p.wallet) return card
    const walletKey = `emails.payment.wallets.${p.wallet}`
    const wallet = t(walletKey)
    return `${wallet === walletKey ? p.wallet : wallet} (${card})`
  }
  const typeKey = `emails.payment.types.${p.type}`
  const typeName = t(typeKey)
  return `${typeName === typeKey ? t('emails.payment.types.other') : typeName}${masked}`
}
