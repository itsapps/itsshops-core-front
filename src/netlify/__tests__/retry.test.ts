import { describe, it, expect, vi } from 'vitest'
import { withRetry } from '../utils/retry'

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on network error and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('network timeout'))
      .mockResolvedValue('ok')
    const result = await withRetry(fn, { baseDelay: 1 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('retries on 5xx status code', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('server error'), { statusCode: 503 }))
      .mockResolvedValue('ok')
    const result = await withRetry(fn, { baseDelay: 1 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('retries on 429 rate limit', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('rate limited'), { statusCode: 429 }))
      .mockResolvedValue('ok')
    const result = await withRetry(fn, { baseDelay: 1 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('does not retry on 4xx client errors', async () => {
    const fn = vi.fn()
      .mockRejectedValue(Object.assign(new Error('bad request'), { statusCode: 400 }))
    await expect(withRetry(fn, { baseDelay: 1 })).rejects.toThrow('bad request')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('does not retry non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('validation failed'))
    await expect(withRetry(fn, { baseDelay: 1 })).rejects.toThrow('validation failed')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('gives up after maxAttempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('network timeout'))
    await expect(withRetry(fn, { maxAttempts: 3, baseDelay: 1 })).rejects.toThrow('network timeout')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('calls onRetry callback', async () => {
    const onRetry = vi.fn()
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValue('ok')
    await withRetry(fn, { baseDelay: 1, onRetry })
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error))
  })
})
