import type { VinofactConfig, VinofactField } from '../types'

const BASE_FIELDS = 'id slug title'

const FIELD_SELECTIONS: Record<VinofactField, string> = {
  year:                'year',
  color:               'color',
  flavor:              'flavor',
  type:                'type',
  description:         'description',
  alcohol:             'alcohol',
  residualSugar:       'residualSugar',
  tartaricAcid:        'tartaricAcid',
  totalSulfur:         'totalSulfur',
  freeSulfur:          'freeSulfur',
  phValue:             'phValue',
  histamine:           'histamine',
  varietals:           'varietals { id varietalId name amount trainingSystem }',
  classifications:     'classifications { id classificationId name }',
  normClassifications: 'normClassifications { id classificationId name }',
  certificates:        'certificates { name }',
  awards:              'awards { name value }',
  bottleImage:         'bottleImage { url alt }',
  terroir:             'terroir { id name description soils { id name } }',
  factsheetPdfUrl:     'factsheetPdfUrl',
  factsheetHtmlUrl:    'factsheetHtmlUrl',
  elabelUrl:           'elabelUrl',
}

function buildFieldsSelection(fields: VinofactField[] | undefined): string {
  if (!fields?.length) return ''
  return fields.map(f => FIELD_SELECTIONS[f]).join('\n        ')
}

/**
 * Fetch specific wines from the Vinofact GraphQL API.
 * One request with all required IDs and locales — locale-keyed fields are
 * resolved per-locale in the variant resolver using ctx.resolveString.
 * Returns a Map keyed by wine ID for O(1) lookups when enriching variants.
 */
export async function fetchVinofactWines(
  config: VinofactConfig,
  wineIds: string[],
  locales: string[],
): Promise<Map<string, any>> {
  if (!config.integration || wineIds.length === 0) return new Map()

  const { endpoint, accessToken, profileSlug } = config.integration
  const query = `
    query ($profileSlug: String!, $locales: [String!]!, $ids: [ID!]) {
      wines(profileSlug: $profileSlug, locales: $locales, ids: $ids) {
        ${BASE_FIELDS}
        ${buildFieldsSelection(config.fields)}
      }
    }
  `

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${accessToken}`,
      },
      body: JSON.stringify({
        query,
        variables: { profileSlug, locales, ids: wineIds },
      }),
    })
  } catch (err) {
    const e = err as any
    console.warn([
      `[itsshops] Vinofact fetch failed — wine data will be missing.`,
      `  Endpoint: ${endpoint}`,
      `  Error:    ${e?.message ?? String(e)}`,
      `  Code:     ${e?.code ?? 'n/a'}`,
      `  Cause:    ${e?.cause?.message ?? e?.cause ?? 'n/a'}`,
    ].join('\n'))
    return new Map()
  }

  if (!response.ok) {
    if (response.status === 401) throw new Error('[itsshops] Invalid or missing Vinofact API token')
    throw new Error(`[itsshops] Vinofact API responded with status ${response.status}`)
  }

  const { data, errors } = await response.json()
  if (errors) throw new Error(`[itsshops] Vinofact GraphQL error: ${errors[0]?.message ?? 'unknown'}`)

  return new Map((data?.wines ?? []).map((w: any) => [String(w.id), w]))
}
