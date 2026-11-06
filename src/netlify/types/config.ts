/**
 * Minimal config for server functions.
 * Accepts the full Config or a partial subset — extracts only what server functions need.
 */
export type ServerConfig = {
  defaultLocale?: string
  /** Same as `units.volume` in `itsshops.config` (default `l`) — composed order subtitles use it. */
  units?: { volume?: string }
  features?: {
    shop?: {
      stock?: boolean
      coupons?: boolean
    }
  }
}

export function resolveServerConfig(config: ServerConfig = {}) {
  return {
    defaultLocale: config.defaultLocale ?? 'de',
    hasStock: config.features?.shop?.stock !== false,
    hasCoupons: !!config.features?.shop?.coupons,
    volumeUnit: config.units?.volume ?? 'l',
  }
}
