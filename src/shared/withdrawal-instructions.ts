/**
 * Withdrawal instructions + model withdrawal form (FAGG Anhang I, Teil A + B) built from shop
 * settings — the single source for the website module and the order confirmation mail, so both
 * always say the same thing.
 *
 * The wording lives in the `shared` translations (`withdrawalInstructions.*`), copied verbatim from
 * the official text (RIS, version for contracts from 2026-10-01); the informal overlay changes only
 * the forms of address. This module only picks the statutory variants and fills the gaps:
 * - [1] period start            ← `withdrawalPeriodStart`
 * - [2] trader identity         ← `settings.company` (fallback billing address)
 * - [3] online function         ← always (core provides the §13a withdrawal function)
 * - [4] refund withheld         ← always (the shop doesn't collect the goods)
 * - [5] return + costs + value  ← `returnAddress`, `returnShippingBorneBy`
 * Exceptions (§ 18) and the shop's return note are separate blocks, never spliced into the model
 * text. Runs in the build (Eleventy) and in the functions (email) — no Node/DOM dependencies.
 */

export type WithdrawalPeriodStart = 'goods' | 'multipleGoods' | 'partialDeliveries' | 'subscription'

export const WITHDRAWAL_EXCEPTIONS = [
  'customMade',
  'perishable',
  'sealedHygiene',
  'mixed',
  'alcoholMarketPrice',
  'sealedMedia',
  'newspapers',
] as const

export type WithdrawalAddress = {
  line1: string
  line2?: string | null
  zip: string
  city: string
  country: string
}

export type WithdrawalInstructionsInput = {
  trader: {
    name: string | null | undefined
    address: WithdrawalAddress | null | undefined
    phone?: string | null
    email: string | null | undefined
  }
  /** Where goods go back; null → the trader's address ("an uns"). */
  returnAddress?: WithdrawalAddress | null
  returnShippingBorneBy: 'customer' | 'merchant'
  periodStart: WithdrawalPeriodStart
  exceptions?: readonly string[]
  returnPolicyNote?: string | null
  /** Absolute URL of the withdrawal function ("Vertrag widerrufen"). */
  withdrawUrl: string
  /** Localized country name for an ISO code. */
  countryName: (code: string) => string
}

export type WithdrawalInstructions = {
  /** Teil A: "Widerrufsrecht", "Folgen des Widerrufs". */
  sections: Array<{ heading: string; paragraphs: string[] }>
  /** Teil B. */
  form: { heading: string; intro: string; to: string; lines: string[]; footnote: string }
  exceptions: { heading: string; intro: string; items: string[] } | null
  note: { heading: string; text: string } | null
}

/** Translator for `withdrawalInstructions.*` keys (namespace handled by the caller). */
export type WithdrawalT = (key: string, params?: Record<string, string>) => string

const PERIOD_STARTS: readonly WithdrawalPeriodStart[] = ['goods', 'multipleGoods', 'partialDeliveries', 'subscription']

/** Settings the instructions can't be generated without (FAGG Anhang I [2]). Empty = complete. */
export function missingWithdrawalData(input: WithdrawalInstructionsInput): string[] {
  const { trader } = input
  const a = trader.address
  return [
    !trader.name?.trim() && 'company.name',
    !(a?.line1 && a.zip && a.city && a.country) && 'company.address',
    !trader.email?.trim() && 'company.email',
    !input.withdrawUrl && 'withdrawUrl',
  ].filter((v): v is string => !!v)
}

function addressLine(a: WithdrawalAddress, countryName: (code: string) => string): string {
  return [a.line1, a.line2, `${a.zip} ${a.city}`, countryName(a.country)].filter(Boolean).join(', ')
}

/**
 * Returns null when required data is missing — never a half-filled legal text; callers fall back
 * (email: short notice + log a warning; website: editor hint in preview only).
 */
export function buildWithdrawalInstructions(
  input: WithdrawalInstructionsInput,
  t: WithdrawalT,
): WithdrawalInstructions | null {
  if (missingWithdrawalData(input).length) return null
  const k = (key: string, params?: Record<string, string>) => t(`withdrawalInstructions.${key}`, params)
  const { trader, countryName } = input
  const traderAddress = addressLine(trader.address!, countryName)

  // [2] name, address, phone, email
  const traderLine = [
    trader.name!.trim(),
    traderAddress,
    trader.phone?.trim() && k('phone', { phone: trader.phone.trim() }),
    k('email', { email: trader.email!.trim() }),
  ].filter(Boolean).join(', ')

  const periodStart = PERIOD_STARTS.includes(input.periodStart) ? input.periodStart : 'multipleGoods'
  const returnTo = input.returnAddress?.line1
    ? `${trader.name!.trim()}, ${addressLine(input.returnAddress, countryName)}`
    : k('returnToUs')

  const exceptions = (input.exceptions ?? []).filter((e) =>
    (WITHDRAWAL_EXCEPTIONS as readonly string[]).includes(e),
  )

  return {
    sections: [
      {
        heading: k('rightHeading'),
        paragraphs: [
          k('right'),
          k(`periodStart.${periodStart}`),
          `${k('howTo', { trader: traderLine })} ${k('online', { url: input.withdrawUrl })}`,
          k('deadline'),
        ],
      },
      {
        heading: k('consequencesHeading'),
        paragraphs: [
          `${k('refund')} ${k('refundWithheld')}`,
          k('returnGoods', { returnTo }),
          k(`returnCost.${input.returnShippingBorneBy === 'merchant' ? 'merchant' : 'customer'}`),
          k('diminishedValue'),
        ],
      },
    ],
    form: {
      heading: k('form.heading'),
      intro: k('form.intro'),
      to: k('form.to', {
        trader: [trader.name!.trim(), traderAddress, trader.email!.trim()].join(', '),
      }),
      lines: ['declaration', 'orderedOn', 'consumerName', 'consumerAddress', 'signature', 'date'].map(
        (line) => k(`form.lines.${line}`),
      ),
      footnote: k('form.footnote'),
    },
    exceptions: exceptions.length
      ? {
          heading: k('exceptions.heading'),
          intro: k('exceptions.intro'),
          items: exceptions.map((e) => k(`exceptions.items.${e}`)),
        }
      : null,
    note: input.returnPolicyNote?.trim()
      ? { heading: k('noteHeading'), text: input.returnPolicyNote.trim() }
      : null,
  }
}
