/**
 * @type {object} RetryStatus
 * Retry-status object type.
 *
 * @param {number} RetryStatus.index
 * Retry overall duration, in milliseconds.
 *
 * @param {number} RetryStatus.duration
 * Retry overall duration, in milliseconds.
 *
 * @param {Error} [error]
 * Last error, if available;
 * It is undefined only when "retryAsync" calls "func" with index = 0.
 *
 * @param {any} [data]
 * Extra data for status handlers, if specified.
 */

/**
 * @function retryAsync
 * Retries async operation returned from `func` callback, according to `options`.
 *
 * @param {(s:RetryStatus) => Promise} func
 * Function that returns a Promise - result of the async operation to be retried.
 *
 * @param {object} [options]
 * Retry Options object.
 *
 * @param {number|((s:RetryStatus)=>number)} [options.retry]
 * Maximum number of retries (infinite by default),
 * or a callback to indicate the need for another retry.
 *
 * @param {number|((s:RetryStatus)=>number)} [options.delay]
 * Retry delays, in milliseconds (no delay by default),
 * or a callback that returns the delays.
 *
 * @param {(s:RetryStatus)=>void} [options.error]
 * Error notifications.
 *
 * @param {any} [options.data]
 * Extra data for status handlers.
 *
 * @returns {Promise}
 * Async result from the callback function.
 *
 * @example
 *
 * const {retryAsync} = require('./retry-async');
 *
 * // try making async request up to 3 times:
 * retryAsync(makeAsyncRequestFunc, {retry: 3})
 *     .then(console.log)
 *     .catch(console.error);
 */
type RetryState<T = unknown> = {
  index: number
  duration: number
  error?: unknown
  data?: T
}

type RetryOptions<T = unknown> = {
  retry?: number | ((state: RetryState<T>) => boolean)
  delay?: number | ((state: RetryState<T>) => number)
  error?: (state: RetryState<T>) => void
  data?: T
}

export const retryAsync = async <R, T = unknown>(
  func: (state: RetryState<T>) => Promise<R>,
  options?: RetryOptions<T>
): Promise<R> => {
  const start = Date.now()
  let index = 0
  let e: unknown
  let { retry = Number.POSITIVE_INFINITY, delay = -1, error, data } = options ?? {}

  const s = (): RetryState<T> => ({ index, duration: Date.now() - start, error: e, data })

  const c = (): Promise<R> =>
    func(s()).catch(async (err: Error) => {
      e = err
      if (typeof error === 'function') error(s())

      const shouldRetry =
        typeof retry === 'function' ? retry(s()) : retry-- > 0

      if (!shouldRetry) {
        return Promise.reject(e)
      }

      const d = typeof delay === 'function' ? delay(s()) : delay
      index++

      if (d >= 0) {
        await new Promise((resolve) => setTimeout(resolve, d))
      }

      return c()
    })

  return c()
}

export const defaultRetry = async <R, T = unknown>(
  func: (state: RetryState<T>) => Promise<R>,
  options: RetryOptions<T> = {}
) => {
  return retryAsync(func, {
    retry: 2,
    delay: 1000,
    ...options,
  })
}

export const clientRetry = async <R, T = unknown>(
  func: (state: RetryState<T>) => Promise<R>,
  options: RetryOptions<T> = {}
) => {
  return retryAsync(func, {
    retry: 1,
    delay: 500,
    ...options,
  })
}

export const expRetry = async <R, T = unknown>(
  func: (state: RetryState<T>) => Promise<R>,
  options: RetryOptions<T> = {}
) => {
  return retryAsync(func, {
    retry: 2,
    delay: (s) => 1000 * 2 ** s.index,
    ...options,
  })
}