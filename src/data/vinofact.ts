import type { VinofactConfig, VinofactField } from '../types'

const BASE_FIELDS = 'id slug title'

/**
 * Vinofact returns localized strings as a typed `LocalizedString` object.
 * Each query must select the locales it wants as sub-fields, e.g. `name { de en }`.
 * Locale codes with hyphens (only `zh-cn` today) are exposed as camelCase fields
 * (`zhCn`) because GraphQL field names cannot contain hyphens.
 */
function localeFieldName(locale: string): string {
  return locale.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

function buildLocaleSel(locales: string[]): string {
  return `{ ${locales.map(localeFieldName).join(' ')} }`
}

function fieldSelections(L: string): Record<VinofactField, string> {
  return {
    year:                'year',
    color:               `color ${L}`,
    flavor:              `flavor ${L}`,
    type:                `type ${L}`,
    description:         `description ${L}`,
    alcohol:             'alcohol',
    residualSugar:       'residualSugar',
    tartaricAcid:        'tartaricAcid',
    totalSulfur:         'totalSulfur',
    freeSulfur:          'freeSulfur',
    phValue:             'phValue',
    histamine:           'histamine',
    varietals:           `varietals { id varietalId name ${L} amount trainingSystem ${L} }`,
    classifications:     `classifications { id classificationId name ${L} }`,
    normClassifications: `normClassifications { id classificationId name ${L} }`,
    certificates:        `certificates { name ${L} }`,
    awards:              `awards { name ${L} value ${L} }`,
    bottleImage:         'bottleImage { url alt }',
    terroir:             `terroir { id name ${L} description ${L} soils { id name ${L} } }`,
    factsheetPdfUrl:     'factsheetPdfUrl',
    factsheetHtmlUrl:    'factsheetHtmlUrl',
    elabelUrl:           'elabelUrl',
  }
}

function buildFieldsSelection(fields: VinofactField[] | undefined, locales: string[]): string {
  if (!fields?.length) return ''
  const selections = fieldSelections(buildLocaleSel(locales))
  return fields.map(f => selections[f]).join('\n        ')
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
    query ($profileSlug: String!, $ids: [ID!]) {
      wines(profileSlug: $profileSlug, ids: $ids) {
        ${BASE_FIELDS}
        ${buildFieldsSelection(config.fields, locales)}
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
        variables: { profileSlug, ids: wineIds },
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
