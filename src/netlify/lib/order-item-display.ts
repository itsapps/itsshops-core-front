/**
 * Compose a fallback subtitle from structural cart-item data.
 *
 * Used only when the client did not supply a `subtitle` (e.g. older
 * client, integration test, manual API call). For real customer orders,
 * the canonical wording always comes from the client — this is just a
 * safety net so the order doc has useful secondary info.
 */
export function composeSubtitle(
  kind: 'wine' | 'physical' | 'digital' | 'bundle',
  wine: { vintage: string | null; volume: number | null } | null,
  options: { groupTitle: string; optionTitle: string }[] | null,
): string | null {
  if (kind === 'wine' && wine) {
    const parts: string[] = []
    if (wine.vintage) parts.push(wine.vintage)
    if (wine.volume) parts.push(formatVolume(wine.volume))
    if (parts.length > 0) return parts.join(' · ')
  } else if ((kind === 'physical' || kind === 'digital') && options && options.length > 0) {
    return options.map(o => `${o.groupTitle}: ${o.optionTitle}`).join(' · ')
  }

  return null
}

function formatVolume(ml: number): string {
  if (ml >= 1000) {
    const liters = ml / 1000
    return `${liters.toString().replace('.', ',')} l`
  }
  return `${ml} ml`
}
