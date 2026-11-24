import type { ProductSelector, SelectorCriteria, SelectorLine } from './types'

const nonEmpty = (list: readonly unknown[] | null | undefined): boolean => !!list && list.length > 0

/** Whether one selector side names any criterion. */
export function hasCriteria(criteria: SelectorCriteria | null | undefined): boolean {
  if (!criteria) return false
  return (
    nonEmpty(criteria.kinds) ||
    nonEmpty(criteria.categoryIds) ||
    nonEmpty(criteria.manufacturerIds) ||
    nonEmpty(criteria.productIds) ||
    nonEmpty(criteria.variantIds) ||
    criteria.hasCompareAtPrice === true
  )
}

const includesAny = (list: string[] | null | undefined, values: string[]): boolean =>
  !!list?.length && values.some(v => list.includes(v))

/** Whether **any** criterion of the side matches the line (an empty side matches nothing). */
export function matchesCriteria(line: SelectorLine, criteria: SelectorCriteria | null | undefined): boolean {
  if (!criteria) return false
  return (
    !!criteria.kinds?.includes(line.kind) ||
    includesAny(criteria.categoryIds, line.categoryIds) ||
    includesAny(criteria.manufacturerIds, line.manufacturerIds) ||
    !!criteria.productIds?.includes(line.productId) ||
    !!criteria.variantIds?.includes(line.variantId) ||
    (criteria.hasCompareAtPrice === true && line.hasCompareAtPrice)
  )
}

/**
 * A line matches when (`include` is empty **or** any include criterion matches) **and** no
 * exclude criterion matches. An empty / missing selector matches every line. A bundle line
 * matches by its own fields only (its items are never matched).
 */
export function matchesSelector(line: SelectorLine, selector: ProductSelector | null | undefined): boolean {
  const include = selector?.include
  const exclude = selector?.exclude
  const included = !hasCriteria(include) || matchesCriteria(line, include)
  return included && !(hasCriteria(exclude) && matchesCriteria(line, exclude))
}

/**
 * Shop-wide exclusions (`shopSettings.discountExclusions`): an include list of what is never
 * discounted. Unlike `matchesSelector`, an empty list excludes **nothing**.
 */
export function isExcluded(line: SelectorLine, exclusions: ProductSelector | null | undefined): boolean {
  return hasCriteria(exclusions?.include) && matchesSelector(line, exclusions)
}

type ParentLookup = Map<string, string | null | undefined> | Record<string, string | null | undefined>

/**
 * `ids` plus all their ancestor categories (categories nest without a depth limit). Cycle-safe:
 * stops at an id already seen. Without subcategories there are no parents — a no-op.
 */
export function withAncestors(ids: readonly string[], parentById: ParentLookup): string[] {
  const parentOf = (id: string) =>
    parentById instanceof Map ? parentById.get(id) : (parentById as Record<string, string | null | undefined>)[id]
  const seen = new Set<string>()
  for (const id of ids) {
    let current: string | null | undefined = id
    while (current && !seen.has(current)) {
      seen.add(current)
      current = parentOf(current)
    }
  }
  return [...seen]
}
