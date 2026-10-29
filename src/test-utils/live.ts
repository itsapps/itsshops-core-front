import { describe } from 'vitest'

/**
 * Tests with side effects outside the test run — real mails, Stripe test payments, orders /
 * withdrawals / users written to the `.env` dataset — only run with `TEST_LIVE=1`. A plain
 * `npm test` then only does read-only checks and requests that are rejected before any write.
 */
export const isLive = !!process.env.TEST_LIVE

export function describeLive(name: string, fn: () => void): void {
  describe.skipIf(!isLive)(name, fn)
}
