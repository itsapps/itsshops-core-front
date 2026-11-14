import type { VinofactConfig, VinofactField } from '../types'

const BASE_FIELDS = 'id slug title'

/**
 * VinoFact's date-versioned GraphQL API this core speaks (vino-facts `.claude/graphql/versioning.md`).
 * The query shape lives in this file, so the version does too — never in an env var. Bump it
 * (together with core-back's constant) when VinoFact releases a change this core needs; never to a
 * date after that VinoFact release (a future date answers 400).
 */
export const VINOFACT_API_VERSION = '2026-11-14'
export const VINOFACT_DEFAULT_ORIGIN = 'https://www.vinofact.com'

/**
 * The dated GraphQL endpoint. `endpoint` (`VINOFACT_API_URL`, optional) only overrides the origin,
 * e.g. for a local VinoFact dev server — any path is ignored. An invalid value throws `Invalid URL`.
 */
export function vinofactEndpoint(endpoint?: string): string {
  return `${new URL(endpoint || VINOFACT_DEFAULT_ORIGIN).origin}/api/graphql/v${VINOFACT_API_VERSION}/`
}

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
    qualityGrades:       `qualityGrades { id qualityGradeId name ${L} }`,
    certificates:        `certificates { name ${L} url description ${L} image { url alt ${L} } }`,
    awards:              `awards { name ${L} value ${L} }`,
    bottleImage:         `bottleImage { url alt ${L} }`,
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

/** Per-attempt timeout — a hanging VinoFact request must not stall the build forever. */
const REQUEST_TIMEOUT_MS = 30_000

/** A failure worth one more try: network error, timeout, 429 or 5xx. */
class TransientVinofactError extends Error {}

function describeFetchError(err: unknown): string {
  const e = err as any
  const cause = e?.cause?.message ?? e?.cause
  return [e?.message ?? String(e), e?.code && `code ${e.code}`, cause && `cause: ${cause}`]
    .filter(Boolean).join(', ')
}

async function requestWines(endpoint: string, accessToken: string, body: string): Promise<any[]> {
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${accessToken}`,
      },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    throw new TransientVinofactError(`request failed (${describeFetchError(err)})`)
  }

  if (response.status === 429 || response.status >= 500) {
    throw new TransientVinofactError(`API responded with status ${response.status}`)
  }
  if (response.status === 401) throw new Error('invalid or missing API token (status 401)')
  if (!response.ok) throw new Error(`API responded with status ${response.status}`)

  let json: any
  try {
    json = await response.json()
  } catch (err) {
    throw new TransientVinofactError(`invalid JSON response (${describeFetchError(err)})`)
  }
  if (json?.errors?.length) throw new Error(`GraphQL error: ${json.errors[0]?.message ?? 'unknown'}`)
  if (!Array.isArray(json?.data?.wines)) throw new Error('response has no `data.wines` list')
  return json.data.wines
}

/**
 * Fetch specific wines from the Vinofact GraphQL API.
 * One request with all required IDs and locales — locale-keyed fields are
 * resolved per-locale in the variant resolver using ctx.resolveString.
 * Returns a Map keyed by wine ID for O(1) lookups when enriching variants.
 *
 * A failed request **fails the build** — publishing a shop without its wine data
 * is worse than a red deploy (the last good deploy stays live). Transient
 * failures (network error, timeout, 429, 5xx, unparsable body) are retried once
 * after `retryDelayMs`; auth/4xx/GraphQL errors fail immediately. Wine IDs the
 * API doesn't return (deleted/unpublished in VinoFact) only warn.
 */
export async function fetchVinofactWines(
  config: VinofactConfig,
  wineIds: string[],
  locales: string[],
  { retryDelayMs = 3000 }: { retryDelayMs?: number } = {},
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
  const body = JSON.stringify({ query, variables: { profileSlug, ids: wineIds } })

  const url = vinofactEndpoint(endpoint)

  const fail = (err: unknown, attempts: number) => new Error([
    `[itsshops] VinoFact request failed${attempts > 1 ? ` after ${attempts} attempts` : ''} — aborting the build so the shop isn't published without wine data.`,
    `  Endpoint: ${url}`,
    `  Profile:  ${profileSlug}`,
    `  Error:    ${(err as Error)?.message ?? String(err)}`,
  ].join('\n'), { cause: err })

  let wines: any[]
  try {
    wines = await requestWines(url, accessToken, body)
  } catch (err) {
    if (!(err instanceof TransientVinofactError)) throw fail(err, 1)
    console.warn(`[itsshops] VinoFact ${err.message} — retrying in ${retryDelayMs / 1000}s…`)
    await new Promise((r) => setTimeout(r, retryDelayMs))
    try {
      wines = await requestWines(url, accessToken, body)
    } catch (err2) {
      throw fail(err2, 2)
    }
  }

  const map = new Map<string, any>(wines.map((w: any) => [String(w.id), w]))
  const missing = wineIds.filter((id) => !map.has(String(id)))
  if (missing.length) {
    console.warn(`[itsshops] VinoFact returned no data for ${missing.length} of ${wineIds.length} wine ID(s): ${missing.join(', ')} — those variants render without VinoFact data.`)
  }
  return map
}
