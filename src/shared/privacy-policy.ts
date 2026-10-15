/**
 * Privacy policy (Art. 13 GDPR) built from what the shop actually runs — features, function-side
 * services (env at build time) and `settings.company` — so a section appears or disappears with
 * the feature it describes. Rendered by `privacyPolicyModule`.
 *
 * The wording lives in the `11ty` translations (`privacyPolicy.*`, informal overlay for "Du");
 * provider facts (name, privacy-policy link) are data here. Shop-specific processing core can't
 * know (a map, an embed) comes from the module's `extraSections` and renders after the embedded
 * content section. Bump `PRIVACY_POLICY_UPDATED` whenever the wording or a section condition changes.
 */
import type { WithdrawalAddress, WithdrawalRichText, WithdrawalSegment } from './withdrawal-instructions'

/** "Stand" of the generated text (YYYY-MM). */
export const PRIVACY_POLICY_UPDATED = '2026-10'

export const PRIVACY_PROVIDERS = {
  netlify:  { name: 'Netlify, Inc.', url: 'https://www.netlify.com/privacy/' },
  sanity:   { name: 'Sanity', url: 'https://www.sanity.io/legal/privacy' },
  stripe:   { name: 'Stripe', url: 'https://stripe.com/privacy' },
  resend:   { name: 'Resend', url: 'https://resend.com/legal/privacy-policy' },
  mailgun:  { name: 'Mailgun', url: 'https://www.mailgun.com/legal/privacy-policy/' },
  supabase: { name: 'Supabase, Inc.', url: 'https://supabase.com/privacy' },
  hcaptcha: { name: 'hCaptcha', url: 'https://www.hcaptcha.com/privacy' },
  vinofact: { name: 'VinoFact e.U.', url: 'https://about.vinofact.com/datenschutz' },
  winenet:  { name: 'winenet gmbh', url: 'https://www.winenet.at/datenschutzerklaerung/' },
} as const

const DSB_URL = 'https://www.dsb.gv.at'

export type PrivacyPolicyInput = {
  company: {
    name: string | null | undefined
    address: WithdrawalAddress | null | undefined
    email: string | null | undefined
  }
  features: {
    checkout: boolean
    users: boolean
    newsletter: boolean
    /** vinofact bottle images are fetched (`'bottleImage'` in `vinofact.fields`) → loaded from i.vinofact.com. */
    vinofact: boolean
    ageGate: boolean
  }
  /** At least one shipping method delivers (not pickup only) → carrier paragraph. */
  hasDelivery: boolean
  /** Online withdrawal function is linked (`orderWithdrawUrl`). */
  hasWithdrawal: boolean
  services: { emailProvider: 'resend' | 'mailgun'; mailgunEu: boolean; wcApi: boolean }
  /** hCaptcha site key configured. */
  captcha: boolean
  /** Days an unpaid checkout snapshot is kept (`ORDER_META_RETENTION_DAYS`). */
  orderMetaRetentionDays: number
  dpoContact?: string | null
  extraSections?: Array<{ heading: string | null | undefined; text: string | null | undefined }>
  countryName: (code: string) => string
  /** Localized "month year" for `PRIVACY_POLICY_UPDATED`. */
  formatUpdated: (yearMonth: string) => string
}

export type PrivacySection = {
  id: string
  heading: string
  paragraphs: WithdrawalRichText[]
  /** Bullet list after the first paragraph (browser storage). */
  items?: string[]
}

export type PrivacyPolicy = { sections: PrivacySection[]; updated: string }

/** Translator for `privacyPolicy.*` keys (namespace handled by the caller). */
export type PrivacyT = (key: string, params?: Record<string, string>) => string

/** Settings the policy can't be generated without (Art. 13(1)(a)). Empty = complete. */
export function missingPrivacyData(input: PrivacyPolicyInput): string[] {
  const { company } = input
  const a = company.address
  return [
    !company.name?.trim() && 'company.name',
    !(a?.line1 && a.zip && a.city && a.country) && 'company.address',
    !company.email?.trim() && 'company.email',
  ].filter((v): v is string => !!v)
}

function addressLine(a: WithdrawalAddress, countryName: (code: string) => string): string {
  return [a.line1, a.line2, `${a.zip} ${a.city}`, countryName(a.country)].filter(Boolean).join(', ')
}

/** Plain paragraphs of an editor text (blank lines separate them). */
const plainParagraphs = (text: string): WithdrawalRichText[] =>
  text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => [{ text: p }])

/** Returns null when required data is missing — never a half-filled legal text. */
export function buildPrivacyPolicy(input: PrivacyPolicyInput, t: PrivacyT): PrivacyPolicy | null {
  if (missingPrivacyData(input).length) return null
  const { features: f, services } = input

  // Links travel through the translator as opaque tokens, then become segments.
  const links: WithdrawalSegment[] = []
  const link = (text: string, href: string) => `\u0001${links.push({ text, href }) - 1}\u0001`
  const rich = (text: string): WithdrawalRichText =>
    text.split(/\u0001(\d+)\u0001/).flatMap((part, i) =>
      i % 2 ? [links[Number(part)]] : part ? [{ text: part }] : [])
  const provider = (id: keyof typeof PRIVACY_PROVIDERS) =>
    link(PRIVACY_PROVIDERS[id].name, PRIVACY_PROVIDERS[id].url)

  const sections: PrivacySection[] = []
  const add = (id: string, keys: Array<string | false>, params: Record<string, string> = {}, items?: string[]) => {
    sections.push({
      id,
      heading: t(`privacyPolicy.${id}.heading`),
      paragraphs: keys.filter((k): k is string => !!k).map((k) => rich(t(`privacyPolicy.${id}.${k}`, params))),
      ...(items && { items }),
    })
  }

  const email = input.company.email!.trim()
  const emailLink = link(email, `mailto:${email}`)
  const dpo = input.dpoContact?.trim()

  add('controller', ['text', !!dpo && 'dpo'], {
    company: input.company.name!.trim(),
    address: addressLine(input.company.address!, input.countryName),
    email: emailLink,
    dpo: dpo ?? '',
  })
  add('overview', [f.checkout ? 'textShop' : 'text'])
  add('hosting', ['text', 'retention'], { provider: provider('netlify') })
  add('content', ['text'], { provider: provider('sanity') })

  if (f.checkout) {
    add('orders', ['text', input.hasDelivery && 'carrier'], {
      provider: provider('sanity'),
      days: String(input.orderMetaRetentionDays),
    })
    add('payment', ['text', 'fraud', 'wallets'], { provider: provider('stripe') })
  }
  if (f.checkout || f.users || f.newsletter) {
    const mailgunKey = services.mailgunEu ? 'mailgunEu' : 'mailgunUs'
    add('email', ['text', services.emailProvider === 'resend' ? 'resend' : mailgunKey], {
      provider: provider(services.emailProvider),
    })
  }
  if (f.checkout && input.hasWithdrawal) add('withdrawal', ['text'])
  if (f.checkout && services.wcApi) add('orderSystem', ['text'], { provider: provider('winenet') })
  if (f.users) add('account', ['text'], { provider: provider('supabase') })
  if (f.newsletter) add('newsletter', ['text'], { provider: provider('sanity') })

  const captchaForms = input.captcha
    ? [f.users && 'register', f.users && 'recover', f.newsletter && 'newsletter'].filter((v): v is string => !!v)
    : []
  if (captchaForms.length) {
    add('captcha', ['text'], {
      forms: captchaForms.map((form) => t(`privacyPolicy.captcha.forms.${form}`)).join(', '),
      provider: provider('hcaptcha'),
    })
  }
  if (f.vinofact) add('vinofact', ['text'], { provider: provider('vinofact') })

  ;(input.extraSections ?? []).forEach((extra, i) => {
    const heading = extra.heading?.trim()
    const text = extra.text?.trim()
    if (heading && text) sections.push({ id: `extra-${i + 1}`, heading, paragraphs: plainParagraphs(text) })
  })

  const storageItems = [
    f.checkout && 'cart',
    f.checkout && 'pendingPayment',
    f.checkout && 'orderSnapshot',
    f.ageGate && 'ageGate',
    'search',
  ].filter((v): v is string => !!v).map((item) => t(`privacyPolicy.storage.items.${item}`))
  add('storage', ['intro'], {}, storageItems)
  // The outro follows the list.
  sections[sections.length - 1].paragraphs.push(
    rich(t(`privacyPolicy.storage.${f.checkout || f.users ? 'outroCookies' : 'outro'}`)))

  if (f.checkout) add('required', ['text'])
  add('automated', ['text', f.checkout && 'stripe'])
  add('rights', ['text'], { email: emailLink })
  add('complaint', ['text'], { dsb: link('www.dsb.gv.at', DSB_URL) })

  return {
    sections,
    updated: t('privacyPolicy.updated', { date: input.formatUpdated(PRIVACY_POLICY_UPDATED) }),
  }
}
