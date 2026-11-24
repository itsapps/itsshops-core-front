/**
 * German form of address for every core text (website, emails, server messages).
 *
 * `SHOP_FORMALITY=formal|informal`, default `formal` ("Sie"). Set it on the Netlify site for
 * **all scopes** — the build (website) and the functions (emails) both read it; build-only gives a
 * "Du" website with "Sie" emails. `informal` merges the `de_*.informal.ts` overlays over the base.
 */
export type Formality = 'formal' | 'informal'

const warned = new Set<string>()

export function readFormality(value: string | undefined = process.env.SHOP_FORMALITY): Formality {
  if (!value || value === 'formal') return 'formal'
  if (value === 'informal') return 'informal'
  if (!warned.has(value)) {
    warned.add(value)
    console.warn(`[itsshops] Invalid SHOP_FORMALITY "${value}" — expected "formal" or "informal", using "formal"`)
  }
  return 'formal'
}
