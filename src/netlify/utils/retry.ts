export type RetryOptions = {
  maxAttempts?: number
  baseDelay?: number
  onRetry?: (attempt: number, error: unknown) => void
}

function isRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    if (message.includes('network') || message.includes('econnreset') || message.includes('timeout')) {
      return true
    }
  }
  // Stripe rate limit or server errors
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const status = (error as { statusCode: number }).statusCode
    return status === 429 || status >= 500
  }
  return false
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { maxAttempts = 3, baseDelay = 500, onRetry } = options
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt === maxAttempts || !isRetryable(error)) {
        throw error
      }
      const delay = baseDelay * Math.pow(2, attempt - 1)
      onRetry?.(attempt, error)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}
