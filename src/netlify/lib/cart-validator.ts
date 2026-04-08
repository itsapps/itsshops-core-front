import type {
  SanityVariantResult,
  SanityTaxRuleResult,
  ValidatedCartItem,
  LocaleString,
} from '../types/checkout'
import type { CheckoutCartItem } from '../types/api'
import { findTaxRate, extractVat } from './tax'
import { resolveLocalizedTitle, estimateWineBottleWeight } from './shipping'
import { composeDisplayTitle } from './order-item-display'

const MAX_DISPLAY_LEN = 300

function sanitize(s: string | undefined): string | null {
  if (!s) return null
  // Strip control chars + clamp length. The string is otherwise opaque to us.
  // eslint-disable-next-line no-control-regex
  const cleaned = s.replace(/[\x00-\x1F\x7F]/g, '').trim()
  if (!cleaned) return null
  return cleaned.slice(0, MAX_DISPLAY_LEN)
}

export type CartValidationResult = {
  items: ValidatedCartItem[]
  unavailableItems: string[]
}

/**
 * Validate cart items against fetched Sanity variant data.
 * - Filters out unavailable variants (not found, not active)
 * - Caps quantities to stock levels
 * - Resolves all fields needed for order creation
 */
export function validateCart(
  cartItems: CheckoutCartItem[],
  variants: SanityVariantResult[],
  taxRules: SanityTaxRuleResult[],
  locale: string,
  defaultLocale = 'de',
  hasStockFeature = true,
  defaultTaxCategoryCode?: string | null,
): CartValidationResult {
  const variantMap = new Map(variants.map(v => [v._id, v]))
  const validatedItems: ValidatedCartItem[] = []
  const unavailableItems: string[] = []

  for (const cartItem of cartItems) {
    const variant = variantMap.get(cartItem.variantId)

    if (!variant || variant.status !== 'active') {
      unavailableItems.push(cartItem.variantId)
      continue
    }

    const price = variant.price ?? variant.productPrice
    if (price === null || price === undefined) {
      unavailableItems.push(cartItem.variantId)
      continue
    }

    // Cap quantity to stock if stock tracking is enabled
    let quantity = cartItem.quantity
    if (hasStockFeature && variant.stock !== null && variant.stock !== undefined) {
      quantity = Math.min(quantity, Math.max(0, variant.stock))
      if (quantity === 0) {
        unavailableItems.push(cartItem.variantId)
        continue
      }
    }

    const taxCategoryCode = variant.taxCategoryCode ?? variant.productTaxCategoryCode ?? ''
    const vatRate = findTaxRate(taxRules, taxCategoryCode, defaultTaxCategoryCode)
    const vatAmount = extractVat(price * quantity, vatRate)

    const title = resolveLocalizedTitle(variant.productTitle, locale, defaultLocale)
    const variantTitle = resolveLocalizedTitle(variant.title, locale, defaultLocale) || null

    // Resolve shipping weight (grams).
    // - physical: explicit weight on variant or parent product
    // - wine:     estimated from bottle volume (no schema weight field)
    // - bundle:   sum of children's resolved weights × child quantity
    // - digital:  null (skipped by shipping calculator)
    let weight: number | null = null
    if (variant.kind === 'physical') {
      weight = variant.weight ?? variant.productWeight ?? null
    } else if (variant.kind === 'wine' && variant.wine?.volume) {
      weight = estimateWineBottleWeight(variant.wine.volume)
    } else if (variant.kind === 'bundle' && variant.bundleItems) {
      let total = 0
      for (const bi of variant.bundleItems) {
        const child = bi.variant
        let childGrams = 0
        if (child.kind === 'physical') {
          childGrams = child.weight ?? child.productWeight ?? 0
        } else if (child.kind === 'wine' && child.wine?.volume) {
          childGrams = estimateWineBottleWeight(child.wine.volume)
        }
        total += childGrams * bi.quantity
      }
      weight = total > 0 ? total : null
    }

    const options = variant.options?.map(o => ({
      groupTitle: resolveLocalizedTitle(o.groupTitle, locale, defaultLocale),
      optionTitle: resolveLocalizedTitle(o.title, locale, defaultLocale),
    })) ?? null

    const bundleItems = variant.bundleItems?.map(bi => ({
      variantId: bi.variant._id,
      quantity: bi.quantity,
    })) ?? null

    const item: ValidatedCartItem = {
      variantId: variant._id,
      productId: variant.productId ?? '',
      kind: variant.kind,
      title,
      variantTitle,
      displayTitle: '', // assigned below
      displaySubtitle: sanitize(cartItem.displaySubtitle),
      sku: variant.sku,
      price,
      weight,
      quantity,
      taxCategoryCode,
      vatRate,
      vatAmount,
      wine: variant.wine ? {
        vintage: variant.wine.vintage ?? null,
        volume: variant.wine.volume ?? null,
      } : null,
      options,
      bundleItems,
    }

    // Customer-supplied display string is canonical. Fall back to a composed
    // default only if the client did not provide one (older client, manual API call).
    const clientTitle = sanitize(cartItem.displayTitle)
    if (clientTitle) {
      item.displayTitle = clientTitle
    } else {
      const fallback = composeDisplayTitle(item)
      item.displayTitle = fallback.title
      if (!item.displaySubtitle) item.displaySubtitle = fallback.subtitle
    }

    validatedItems.push(item)
  }

  return { items: validatedItems, unavailableItems }
}
