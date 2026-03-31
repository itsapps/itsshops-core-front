type LogLevel = 'info' | 'warn' | 'error'

type LogEntry = {
  level: LogLevel
  phase: string
  requestId: string
  message: string
  duration?: number
  data?: Record<string, unknown>
}

function sanitize(data: Record<string, unknown>): Record<string, unknown> {
  const redacted = { ...data }
  const sensitiveKeys = ['cardNumber', 'cvc', 'cvv', 'password', 'secret', 'token', 'apiKey']
  for (const key of Object.keys(redacted)) {
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s.toLowerCase()))) {
      redacted[key] = '[REDACTED]'
    }
  }
  return redacted
}

function emit(entry: LogEntry): void {
  const line = {
    ts: new Date().toISOString(),
    ...entry,
    ...(entry.data && { data: sanitize(entry.data) }),
  }
  const fn = entry.level === 'error' ? console.error : entry.level === 'warn' ? console.warn : console.log
  fn(JSON.stringify(line))
}

export type Logger = {
  info: (message: string, data?: Record<string, unknown>) => void
  warn: (message: string, data?: Record<string, unknown>) => void
  error: (message: string, data?: Record<string, unknown>) => void
  timed: <T>(message: string, fn: () => Promise<T>) => Promise<T>
}

export function createLogger(phase: string, requestId: string): Logger {
  const log = (level: LogLevel) => (message: string, data?: Record<string, unknown>) => {
    emit({ level, phase, requestId, message, data })
  }

  return {
    info: log('info'),
    warn: log('warn'),
    error: log('error'),
    async timed<T>(message: string, fn: () => Promise<T>): Promise<T> {
      const start = Date.now()
      try {
        const result = await fn()
        emit({ level: 'info', phase, requestId, message, duration: Date.now() - start })
        return result
      } catch (err) {
        emit({
          level: 'error',
          phase,
          requestId,
          message: `${message} (failed)`,
          duration: Date.now() - start,
          data: { error: err instanceof Error ? err.message : String(err) },
        })
        throw err
      }
    },
  }
}

let counter = 0
export function generateRequestId(): string {
  return `req_${Date.now()}_${++counter}`
}
