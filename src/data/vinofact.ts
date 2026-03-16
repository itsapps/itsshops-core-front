import type { VinofactConfig } from '../types'

const BASE_FIELDS = 'id slug title'

/**
 * Fetch specific wines from the Vinofact GraphQL API.
 * One request with all required IDs and locales.
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
        ${config.fields ?? ''}
      }
    }
  `

  const response = await fetch(endpoint, {
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

  if (!response.ok) {
    if (response.status === 401) throw new Error('[itsshops] Invalid or missing Vinofact API token')
    throw new Error(`[itsshops] Vinofact API responded with status ${response.status}`)
  }

  const { data, errors } = await response.json()
  if (errors) throw new Error(`[itsshops] Vinofact GraphQL error: ${errors[0]?.message ?? 'unknown'}`)

  return new Map((data?.wines ?? []).map((w: any) => [String(w.id), w]))
}
