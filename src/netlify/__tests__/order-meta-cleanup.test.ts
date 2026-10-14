import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../services/sanity', () => ({ deleteOrderMetaUpdatedBefore: vi.fn() }))
vi.mock('../utils/logger', () => ({ log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() } }))

import { deleteOrderMetaUpdatedBefore } from '../services/sanity'
import { createOrderMetaCleanupHandler } from '../functions/order-meta-cleanup'

const deleteMock = vi.mocked(deleteOrderMetaUpdatedBefore)
const handler = createOrderMetaCleanupHandler()

describe('order-meta-cleanup', () => {
  beforeEach(() => {
    deleteMock.mockReset()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-14T03:00:00.000Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('deletes orderMeta not updated for 30 days', async () => {
    deleteMock.mockResolvedValue(3)
    const res = await handler()
    expect(res.status).toBe(200)
    expect(deleteMock).toHaveBeenCalledWith('2026-09-14T03:00:00.000Z')
  })

  it('500 when the deletion fails', async () => {
    deleteMock.mockRejectedValueOnce(new Error('sanity down'))
    expect((await handler()).status).toBe(500)
  })
})
