import type { Config, CoreConfig, ItsshopsFeatures, Features, Locale, EnvVarName } from '../types'
import type { ClientPerspective } from '@sanity/client'

export function resolveConfig(config: Config): CoreConfig {
  const env = readEnv()
  const features = resolveFeatures(config.features)

  const previewEnabled = config.preview?.enabled ?? env.preview.enabled
  const perspective = (previewEnabled ? (env.preview.perspective || 'drafts') : 'published') as ClientPerspective
  const isMaintenanceMode = config.isMaintenanceMode ?? env.isMaintenanceMode

  // required — hard fail
  const sanityProjectId = requireVar('SANITY_PROJECT_ID', config.sanity?.projectId ?? env.sanity.projectId)
  const sanityDataset   = requireVar('SANITY_DATASET',   config.sanity?.dataset   ?? env.sanity.dataset)

  // optional but important — warn if absent
  const sanityToken = config.sanity?.token ?? env.sanity.token
  warnMissing({
    'SANITY_TOKEN':              sanityToken,
    'URL':                       env.rawUrl,
    'SUPPORT_EMAIL':             config.supportEmail             ?? env.supportEmail,
    'STRIPE_PUBLISHABLE_API_KEY': features.shop.checkout
      ? (config.stripe?.publishableApiKey ?? env.stripe.publishableApiKey)
      : 'skip',
    'CAPTCHA_SITE_KEY':          config.captchaSiteKey ?? env.captchaSiteKey,
  })

  const baseUrl = config.baseUrl ?? env.baseUrl
  const hostname = baseUrl ? new URL(baseUrl).hostname : ''

  const buildMode = previewEnabled
    ? 'preview'
    : isMaintenanceMode ? 'maintenance' : 'normal'

  return {
    buildMode,
    sanity: {
      ...config.sanity,
      projectId: sanityProjectId,
      dataset:   sanityDataset,
      token:     sanityToken,
      perspective,
    },
    locales:       config.locales || ['de', 'en'],
    defaultLocale: config.defaultLocale || 'de',
    features,
    permalinks:    config.permalinks    ?? {},
    translations:  config.translations  ?? {},
    extensions:    config.extensions    ?? {},
    baseUrl,
    hostname,
    isMaintenanceMode,
    doIndexPages:      config.doIndexPages      ?? env.doIndexPages,
    maxProducts:       config.maxProducts       ?? env.maxProducts,
    dev: {
      enabled:    config.dev?.enabled    ?? env.dev.enabled,
      liveReload: config.dev?.liveReload ?? env.dev.liveReload,
      serverPort: config.dev?.serverPort ?? env.dev.serverPort,
    },
    preview: {
      enabled:      previewEnabled,
      documentType: config.preview?.documentType ?? env.preview.documentType,
      documentId:   config.preview?.documentId   ?? env.preview.documentId,
      locale:       config.preview?.locale       ?? env.preview.locale,
    },
    css: {
      minify: config.css?.minify ?? env.minify,
      inline: config.css?.inline ?? env.inlineCss,
      ...config.css,
    },
    js: {
      minify: config.js?.minify ?? env.minify,
      ...config.js,
    },
    imagePlaceholders: config.imagePlaceholders ?? {},
    manifest: {
      themeBgColor: config.manifest?.themeBgColor ?? '#ffffff',
      themeColor:   config.manifest?.themeColor   ?? '#000000',
    },
    developer: {
      name:    config.developer?.name    ?? env.developer.name,
      website: config.developer?.website ?? env.developer.website,
    },
    stripe: {
      publishableApiKey: config.stripe?.publishableApiKey ?? env.stripe.publishableApiKey,
    },
    captchaSiteKey: config.captchaSiteKey ?? env.captchaSiteKey,
    supportEmail:   config.supportEmail   ?? env.supportEmail,
  }
}

// ─── Env ──────────────────────────────────────────────────────────────────────

function readEnv() {
  const stage   = process.env.STAGE ?? 'production'
  const rawUrl  = process.env.DEV_URL ?? process.env.URL
  const baseUrl = rawUrl ?? 'http://localhost:8080'
  const minify  = parseBool(process.env.MINIFY, stage !== 'development')
  const previewEnabled = parseBool(process.env.IS_PREVIEW, false)

  return {
    rawUrl,
    baseUrl,
    minify,
    inlineCss:        parseBool(process.env.INLINE_CSS, true),
    isMaintenanceMode: parseBool(process.env.MAINTENANCE, false),
    doIndexPages:      parseBool(process.env.DO_INDEX_PAGES, true),
    maxProducts:       parseNum(process.env.MAX_PRODUCTS, -1),
    dev: {
      enabled:    parseBool(process.env.ITSSHOPS_DEBUG, false),
      liveReload: parseBool(process.env.DEV_LIVE_RELOAD, true),
      serverPort: parseNum(process.env.DEV_SERVER_PORT, 8080),
    },
    preview: {
      enabled:      previewEnabled,
      documentType: process.env.PREVIEW_TYPE,
      documentId:   process.env.PREVIEW_ID,
      locale:       process.env.PREVIEW_LOCALE as Locale | undefined,
      perspective:  process.env.PREVIEW_PERSPECTIVE,
    },
    sanity: {
      projectId: process.env.SANITY_PROJECT_ID ?? process.env.SANITY_STUDIO_PROJECT,
      dataset:   process.env.SANITY_DATASET    ?? process.env.SANITY_STUDIO_DATASET,
      token:     process.env.SANITY_TOKEN,
    },
    stripe: {
      publishableApiKey: process.env.STRIPE_PUBLISHABLE_API_KEY,
    },
    captchaSiteKey: process.env.CAPTCHA_SITE_KEY,
    supportEmail:   process.env.SUPPORT_EMAIL,
    developer: {
      name:    process.env.PUBLIC_DEVELOPER_NAME,
      website: process.env.PUBLIC_DEVELOPER_WEBSITE,
    },
  }
}

function requireVar(name: EnvVarName, value: string | undefined): string {
  if (!value) throw new Error(`[itsshops] Missing required config: ${name}`)
  return value
}

/** Warn about missing optional-but-important vars. Pass 'skip' to suppress a check conditionally. */
function warnMissing(vars: Partial<Record<EnvVarName, string | undefined>>): void {
  const missing = Object.entries(vars)
    .filter(([, v]) => v !== 'skip' && !v)
    .map(([k]) => k)
  if (missing.length > 0) {
    console.warn(`[itsshops] Missing config (using defaults or disabled): ${missing.join(', ')}`)
  }
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback
  return value === 'true'
}

function parseNum(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback
  const n = Number(value)
  return isNaN(n) ? fallback : n
}

// ─── Features ─────────────────────────────────────────────────────────────────

function resolveFeatures(input?: ItsshopsFeatures): Features {
  return {
    shop: {
      enabled:      !!input?.shop,
      checkout:     input?.shop?.checkout     ?? false,
      manufacturer: input?.shop?.manufacturer ?? false,
      stock:        input?.shop?.stock        ?? false,
      category:     input?.shop?.category     ?? false,
      vinofact:     input?.shop?.vinofact     ?? { enabled: false },
    },
    blog:  input?.blog  ?? false,
    users: input?.users ?? false,
  }
}
