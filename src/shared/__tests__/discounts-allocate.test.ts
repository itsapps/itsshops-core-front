import { describe, it, expect } from 'vitest'
import { allocateLargestRemainder, allocateToChildren } from '../discounts/allocate'

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

describe('allocateLargestRemainder', () => {
  it('splits proportionally and sums exactly', () => {
    expect(allocateLargestRemainder(100, [1000, 1000])).toEqual([50, 50])
    const shares = allocateLargestRemainder(1000, [333, 333, 334])
    expect(sum(shares)).toBe(1000)
  })

  it('gives leftover cents to the largest remainders', () => {
    // 10 over 3 equal weights → 3.33 each → one extra cent, to the earliest (tie)
    expect(allocateLargestRemainder(10, [1, 1, 1])).toEqual([4, 3, 3])
    // 1 cent over 3 lines → to the one with the largest fractional part
    expect(allocateLargestRemainder(1, [100, 300, 200])).toEqual([0, 1, 0])
  })

  it('ties go to the earlier line (deterministic)', () => {
    expect(allocateLargestRemainder(1, [500, 500])).toEqual([1, 0])
    expect(allocateLargestRemainder(1, [500, 500])).toEqual(allocateLargestRemainder(1, [500, 500]))
  })

  it('zero-weight (excluded) lines get 0', () => {
    expect(allocateLargestRemainder(99, [0, 1000, 0, 500])).toEqual([0, 66, 0, 33])
  })

  it('never exceeds a weight nor goes negative when total ≤ Σw', () => {
    for (const total of [0, 1, 7, 99, 1234, 2999]) {
      const weights = [1, 999, 2000]
      const shares = allocateLargestRemainder(total, weights)
      expect(sum(shares)).toBe(total)
      shares.forEach((s, i) => {
        expect(s).toBeGreaterThanOrEqual(0)
        expect(s).toBeLessThanOrEqual(weights[i])
      })
    }
  })

  it('returns zeros for a zero total or all-zero weights', () => {
    expect(allocateLargestRemainder(0, [5, 5])).toEqual([0, 0])
    expect(allocateLargestRemainder(5, [0, 0])).toEqual([0, 0])
    expect(allocateLargestRemainder(5, [])).toEqual([])
  })
})

describe('allocateToChildren', () => {
  it('splits a bundle line discount over the item shares, exact sum', () => {
    // bundle 4990 = 2× wine 1795 share 3590 + juice 1400 share
    const children = allocateToChildren(499, [3590, 1400])
    expect(sum(children)).toBe(499)
    expect(children).toEqual([359, 140])
  })

  it('a 1-cent discount lands on one child', () => {
    expect(allocateToChildren(1, [3590, 1400])).toEqual([1, 0])
  })
})
