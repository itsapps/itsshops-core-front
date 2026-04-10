/**
 * Resolved Vinofact types — all locale-keyed JSONObject fields are resolved
 * to plain strings by resolveLocaleMaps() before these types are applied.
 *
 * Fields marked optional are only present when included in VinofactConfig.fields.
 * Base fields (id, slug, title) are always fetched.
 */

export type VinofactVarietal = {
  id: string
  varietalId: string
  name: string | null
  amount: number | null
  varietalAge: number | null
  varietalAgeTo: number | null
  varietalYield: number | null
  varietalYieldTo: number | null
  plantDensity: number | null
  plantDensityTo: number | null
  botrytisAmount: number | null
  trainingSystem: string | null
}

export type VinofactClassification = {
  id: string
  classificationId: string
  name: string | null
}

export type VinofactAward = {
  name: string | null
  value: string | null
}

export type VinofactTerroir = {
  id: string
  name: string | null
  description: string | null
  soils: Array<{
    id: string
    name: string | null
  }>
}

export type VinofactImage = {
  url: string
  alt: string
}

/** Fields that can be requested via VinofactConfig.fields (excludes always-fetched base fields). */
export type VinofactField =
  | 'year' | 'color' | 'flavor' | 'type' | 'description'
  | 'alcohol' | 'residualSugar' | 'tartaricAcid' | 'totalSulfur' | 'freeSulfur' | 'phValue' | 'histamine'
  | 'varietals' | 'classifications' | 'normClassifications' | 'awards' | 'bottleImage' | 'terroir'
  | 'factsheetPdfUrl' | 'factsheetHtmlUrl'

/** Resolved wine data from the Vinofact API (all locale maps already resolved to strings). */
export type VinofactWine = {
  // Base fields — always present
  id: string
  slug: string
  title: string
  // Optional — included via VinofactConfig.fields
  year?: string | null
  color?: string | null
  flavor?: string | null
  type?: string | null
  description?: string | null
  alcohol?: number | null
  residualSugar?: number | null
  tartaricAcid?: number | null
  totalSulfur?: number | null
  freeSulfur?: number | null
  phValue?: number | null
  histamine?: number | null
  varietals?: VinofactVarietal[]
  classifications?: VinofactClassification[]
  normClassifications?: VinofactClassification[]
  awards?: VinofactAward[]
  bottleImage?: VinofactImage | null
  terroir?: VinofactTerroir | null
  factsheetPdfUrl?: string | null
  factsheetHtmlUrl?: string | null
}
