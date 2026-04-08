import type { ValidatedCartItem } from '../types/checkout'

/**
 * Compose a fallback display string from structural cart-item data.
 *
 * Used only when the client did not supply a `displayTitle` (e.g. older
 * client, integration test, manual API call). For real customer orders,
 * the canonical wording always comes from the client — this is just a
 * safety net so the order doc never has an empty headline.
 */
export function composeDisplayTitle(item: ValidatedCartItem): { title: string; subtitle: string | null } {
  const headline = [item.title, item.variantTitle].filter(Boolean).join(' ')

  let subtitle: string | null = null

  if (item.kind === 'wine' && item.wine) {
    const parts: string[] = []
    if (item.wine.vintage) parts.push(item.wine.vintage)
    if (item.wine.volume) parts.push(formatVolume(item.wine.volume))
    if (parts.length > 0) subtitle = parts.join(' · ')
  } else if ((item.kind === 'physical' || item.kind === 'digital') && item.options && item.options.length > 0) {
    subtitle = item.options.map(o => `${o.groupTitle}: ${o.optionTitle}`).join(' · ')
  } else if (item.kind === 'bundle' && item.bundleItems && item.bundleItems.length > 0) {
    const total = item.bundleItems.reduce((sum, b) => sum + b.quantity, 0)
    subtitle = `${total} items`
  }

  return { title: headline, subtitle }
}

function formatVolume(ml: number): string {
  if (ml >= 1000) {
    const liters = ml / 1000
    return `${liters.toString().replace('.', ',')} l`
  }
  return `${ml} ml`
}
