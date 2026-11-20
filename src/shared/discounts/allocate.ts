/**
 * Split `total` integer cents over `weights` by largest remainder: each share is
 * `floor(total × w / Σw)`, the cents left over go one each to the largest fractional parts, ties
 * to the earlier index (deterministic). The shares add up to `total` exactly; with
 * `0 ≤ total ≤ Σw` none is negative or above its weight. All-zero weights → all zeros (and
 * `total` must then be 0).
 */
export function allocateLargestRemainder(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((acc, w) => acc + Math.max(0, w), 0)
  if (total <= 0 || sum <= 0) return weights.map(() => 0)
  // Integer arithmetic: share = floor(total × w / sum), remainder = (total × w) mod sum.
  const shares = weights.map(w => Math.floor((total * Math.max(0, w)) / sum))
  let left = total - shares.reduce((acc, s) => acc + s, 0)
  const order = weights
    .map((w, i) => ({ i, rest: (total * Math.max(0, w)) % sum }))
    .filter(entry => weights[entry.i] > 0)
    .sort((a, b) => b.rest - a.rest || a.i - b.i)
  for (let k = 0; left > 0 && order.length > 0; k = (k + 1) % order.length) {
    shares[order[k].i] += 1
    left -= 1
  }
  return shares
}

/**
 * A bundle line's discount split over its items by their gross price shares (`childPrices`, one
 * bundle). The weights are the same ratio for every line quantity, so `× quantity` is left out.
 */
export function allocateToChildren(lineDiscount: number, childPrices: readonly number[]): number[] {
  return allocateLargestRemainder(lineDiscount, childPrices)
}
