/**
 * Variant → product fallbacks shared by the build (`data/resolve/variants.ts`) and checkout
 * (`netlify/lib/cart-validator.ts`). Reference table: `.claude/architecture/data-layer.md`
 * → "Variant → product fallbacks".
 */

type Priced = { price?: number | null; compareAtPrice?: number | null }

const isNum = (n: unknown): n is number => typeof n === 'number'

/**
 * The compare-at ("was") price a variant shows. A variant with its own price uses only its own
 * compare-at price; a variant without one inherits both from the product. Emitted only when it is
 * higher than the effective price (`variant.price ?? product.price`); `null` otherwise or when
 * there is no effective price.
 */
export function effectiveCompareAtPrice(
  variant: Priced,
  product: Priced | null | undefined,
): number | null {
  const ownPrice = isNum(variant.price)
  const price = ownPrice ? variant.price : product?.price
  if (!isNum(price)) return null
  const compareAt = ownPrice
    ? variant.compareAtPrice
    : (isNum(variant.compareAtPrice) ? variant.compareAtPrice : product?.compareAtPrice)
  return isNum(compareAt) && compareAt > price ? compareAt : null
}
