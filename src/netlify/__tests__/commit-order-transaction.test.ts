import { describe, it, expect, vi, beforeEach } from 'vitest'

// A fake Sanity client recording the transaction (discount increments, discounts model).
const calls = vi.hoisted(() => ({
  fetch: vi.fn(),
  patches: [] as { id: string; ops: string[] }[],
  creates: [] as unknown[],
  committed: 0,
}))
vi.mock('@sanity/client', () => ({
  createClient: () => ({
    fetch: calls.fetch,
    transaction: () => {
      const tx = {
        create: (doc: unknown) => { calls.creates.push(doc); return tx },
        patch: (id: string, build: (p: unknown) => unknown) => {
          const ops: string[] = []
          const p = {
            dec: (o: object) => { ops.push(`dec ${JSON.stringify(o)}`); return p },
            inc: (o: object) => { ops.push(`inc ${JSON.stringify(o)}`); return p },
            setIfMissing: (o: object) => { ops.push(`setIfMissing ${JSON.stringify(o)}`); return p },
          }
          build(p)
          calls.patches.push({ id, ops })
          return tx
        },
        commit: async () => { calls.committed++ },
      }
      return tx
    },
  }),
}))

import { commitOrderTransaction } from '../services/sanity'

describe('commitOrderTransaction — discount increments', () => {
  beforeEach(() => {
    process.env.SANITY_PROJECT_ID = 'p'
    process.env.SANITY_DATASET = 'd'
    process.env.SANITY_TOKEN = 't'
    calls.fetch.mockReset()
    calls.patches.length = 0
    calls.creates.length = 0
    calls.committed = 0
  })

  it('increments existing published + draft docs, skips deleted ids, raw perspective', async () => {
    calls.fetch.mockResolvedValue(['discount-a', 'drafts.discount-a', 'discount-b'])
    await commitOrderTransaction({
      doc: { _type: 'order' } as never,
      stockDecrements: [{ variantId: 'v1', quantity: 2 }],
      discountIncrements: [{ discountId: 'discount-a', by: 1 }, { discountId: 'discount-b', by: 1 }, { discountId: 'discount-gone', by: 1 }],
    })
    const [query, params, options] = calls.fetch.mock.calls[0]
    expect(query).toBe('*[_id in $ids]._id')
    expect(params.ids).toEqual([
      'discount-a', 'drafts.discount-a', 'discount-b', 'drafts.discount-b', 'discount-gone', 'drafts.discount-gone',
    ])
    expect(options).toEqual({ perspective: 'raw' })
    expect(calls.patches).toEqual([
      { id: 'v1', ops: ['dec {"stock":2}'] },
      { id: 'discount-a', ops: ['setIfMissing {"redemptionCount":0}', 'inc {"redemptionCount":1}'] },
      { id: 'drafts.discount-a', ops: ['setIfMissing {"redemptionCount":0}', 'inc {"redemptionCount":1}'] },
      { id: 'discount-b', ops: ['setIfMissing {"redemptionCount":0}', 'inc {"redemptionCount":1}'] },
    ])
    expect(calls.committed).toBe(1)
  })

  it('no discounts → no existence query', async () => {
    await commitOrderTransaction({ doc: { _type: 'order' } as never, stockDecrements: [], discountIncrements: [] })
    expect(calls.fetch).not.toHaveBeenCalled()
    expect(calls.committed).toBe(1)
  })
})
