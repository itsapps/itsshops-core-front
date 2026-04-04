type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

function threshold(): number {
  return LEVELS[(process.env.LOG_LEVEL as LogLevel)] ?? LEVELS.info
}

function emit(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  if (LEVELS[level] < threshold()) return
  const entry = { ts: new Date().toISOString(), level, message, ...data && { data } }
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  fn(JSON.stringify(entry))
}

export const log = {
  debug: (message: string, data?: Record<string, unknown>) => emit('debug', message, data),
  info: (message: string, data?: Record<string, unknown>) => emit('info', message, data),
  warn: (message: string, data?: Record<string, unknown>) => emit('warn', message, data),
  error: (message: string, data?: Record<string, unknown>) => emit('error', message, data),
}
