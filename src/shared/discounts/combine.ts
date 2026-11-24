import type { DiscountInput } from './types'

/**
 * Two discounts stack iff each one's `combinesWith` contains the other's target. Two shipping
 * discounts never do (shipping can only be waived once).
 */
export function areCompatible(a: DiscountInput, b: DiscountInput): boolean {
  if (a.target === 'shipping' && b.target === 'shipping') return false
  return !!a.combinesWith?.[b.target] && !!b.combinesWith?.[a.target]
}

/**
 * Greedy pick: walk `candidates` in order and take each one compatible with everything taken so
 * far (`seed` first — the code discount of the code set).
 */
export function pickCompatible(candidates: DiscountInput[], seed: DiscountInput[] = []): DiscountInput[] {
  const taken = [...seed]
  for (const candidate of candidates) {
    if (taken.every(t => areCompatible(t, candidate))) taken.push(candidate)
  }
  return taken
}

/** Automatic discounts by saving alone (desc), ties by `_id` — the greedy order. */
export function sortBySaving(discounts: DiscountInput[], saving: (d: DiscountInput) => number): DiscountInput[] {
  const savings = new Map(discounts.map(d => [d._id, saving(d)]))
  return [...discounts].sort((a, b) => savings.get(b._id)! - savings.get(a._id)! || (a._id < b._id ? -1 : a._id > b._id ? 1 : 0))
}
