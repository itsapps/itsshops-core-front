/**
 * Minimal config for server functions.
 * Accepts the full Config or a partial subset — extracts only what server functions need.
 */
export type ServerConfig = {
  defaultLocale?: string
  features?: {
    shop?: {
      stock?: boolean
    }
  }
}

export function resolveServerConfig(config: ServerConfig = {}) {
  return {
    defaultLocale: config.defaultLocale ?? 'de',
    hasStock: config.features?.shop?.stock !== false,
  }
}
