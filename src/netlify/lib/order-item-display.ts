/**
 * Compose a subtitle from structural cart-item data.
 *
 * Bundles: always used — "2× A, 1× B" from the bundle's current items (`bundleItems`, titles in
 * the order locale; same format as `addToCartButton` in `macros/product.njk`), so the order never
 * carries contents the cart froze at add-to-cart time.
 *
 * Other kinds: only a fallback when the client did not supply a `subtitle` (older client,
 * integration test, manual API call) — for those the canonical wording comes from the client.
 */
export function composeSubtitle(
  kind: 'wine' | 'physical' | 'digital' | 'bundle',
  wine: { vintage: string | null; volume: number | null } | null,
  options: { groupTitle: string; optionTitle: string }[] | null,
  bundleItems: { quantity: number; title: string }[] | null = null,
): string | null {
  if (kind === 'bundle') {
    if (bundleItems && bundleItems.length > 0) {
      return bundleItems.map(bi => `${bi.quantity}× ${bi.title}`).join(', ')
    }
  } else if (kind === 'wine' && wine) {
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

/** One row of a bundle's contents under its order line (mails, invoice). */
export type BundleItemLine = {
  /** Units of this item in one bundle (mails: under "2x Box" the box's contents). */
  quantity: number
  /** Units over the whole line (`quantity` × the line's quantity — the invoice). */
  totalQuantity: number
  title: string
  subtitle: string | null
  /** The item's VAT rate; `null` on orders whose snapshot has no rate. */
  vatRate: number | null
}

/**
 * The contents of a bundle order line, from its stored `bundle.items` snapshot. `[]` for other
 * lines and for older bundle orders without `items` (those keep showing their subtitle).
 */
export function bundleItemLines(item: {
  quantity: number
  bundle?: { items?: { quantity: number; title: string; subtitle?: string | null; vatRate?: number | null }[] } | null
}): BundleItemLine[] {
  return (item.bundle?.items ?? []).map(bi => ({
    quantity: bi.quantity,
    totalQuantity: bi.quantity * item.quantity,
    title: bi.title,
    subtitle: bi.subtitle || null,
    vatRate: typeof bi.vatRate === 'number' ? bi.vatRate : null,
  }))
}

/**
 * Locale-independent key of a bundle's contents: "variantId:quantity" per item, sorted, joined
 * ",". The product page writes the same key (`data-bundle-key` in `addToCartButton`), so checkout
 * can tell a contents change from a subtitle that only differs in wording or language.
 */
export function bundleContentsKey(items: { variantId: string; quantity: number }[]): string {
  return items.map(i => `${i.variantId}:${i.quantity}`).sort().join(',')
}
