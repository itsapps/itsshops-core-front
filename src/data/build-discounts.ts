import type { SanityClient } from '@sanity/client'
import { buildAutomaticShippingDiscountsQuery } from './queries'
import { isUnconditional, toDiscountInput, type DiscountInput, type RawDiscount } from '../shared/discounts'

/**
 * The automatic shipping discounts the build may state as a static claim (card note, tax line,
 * "Versand & Zahlung", schema.org shipping rate 0): only with checkout, and only rules without
 * dates / limits / thresholds (`isUnconditional`) — a page can't follow those until the next
 * deploy, while checkout evaluates every rule live.
 *
 * Plain `client.fetch`, never the resolver's `fetchQuery`: in preview builds that enables stega,
 * which encodes strings such as `appliesTo.kinds` ("bundle" + invisible chars), so the selector
 * would never match.
 */
export async function fetchBuildShippingDiscounts(
  client: Pick<SanityClient, 'fetch'>,
  features: { shop: { enabled: boolean; checkout: boolean } },
): Promise<DiscountInput[]> {
  if (!features.shop.enabled || !features.shop.checkout) return []
  const raw = await client.fetch<RawDiscount[] | null>(buildAutomaticShippingDiscountsQuery())
  return (raw ?? []).map(d => toDiscountInput(d, () => '')).filter(isUnconditional)
}
