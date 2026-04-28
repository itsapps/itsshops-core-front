import type { Config, CoreConfig, ItsshopsFeatures, Features, Locale, EnvVarName, CspDirectives, ResolvedCspDirectives } from '../types'
import type { ClientPerspective } from '@sanity/client'
import { buildPermalinkTranslations, buildUserPaths } from '../i18n/permalinks'

export function resolveConfig(config: Config): CoreConfig {
  const env = readEnv()
  const features = resolveFeatures(config.features, env)

  const previewEnabled = env.preview.enabled
  const perspective = (previewEnabled ? (env.preview.perspective || 'drafts') : 'published') as ClientPerspective
  const isMaintenanceMode = env.isMaintenanceMode

  // required — hard fail
  const sanityProjectId = requireVar('SANITY_PROJECT_ID', config.sanity?.projectId ?? env.sanity.projectId)
  const sanityDataset   = requireVar('SANITY_DATASET',   config.sanity?.dataset   ?? env.sanity.dataset)

  // optional but important — warn if absent
  const sanityToken   = config.sanity?.token     ?? env.sanity.token
  const studioUrl     = config.sanity?.studioUrl ?? env.sanity.studioUrl

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
      studioUrl,
      perspective,
    },
    locales:       config.locales || ['de', 'en'],
    defaultLocale: config.defaultLocale || 'de',
    features,
    permalinks:         config.permalinks ?? {},
    resolvedPermalinks: buildPermalinkTranslations(config.permalinks),
    userPaths: buildUserPaths(),
    translations:       config.translations ?? {},
    headers: {
      extra:  resolveCspDirectives(config.headers?.extra),
      routes: (config.headers?.routes ?? []).map(r => ({
        path:  r.path,
        extra: resolveCspDirectives(r.extra),
      })),
    },
    extensions:    config.extensions    ?? {},
    menu:          { maxDepth: config.menu?.maxDepth ?? 1 },
    units:         { volume: config.units?.volume ?? 'l', price: { currency: config.units?.price?.currency ?? 'EUR', currencyLabel: config.units?.price?.currencyLabel } },
    baseUrl,
    hostname,
    doIndexPages: config.doIndexPages ?? env.doIndexPages,
    maxProducts:  config.maxProducts  ?? env.maxProducts,
    debug: {
      enabled: config.debug?.enabled ?? env.debug.enabled,
    },
    serve: {
      port:        config.serve?.port        ?? env.serve.port,
      liveReload:  config.serve?.liveReload  ?? env.serve.liveReload,
      refetchData: config.serve?.refetchData ?? env.serve.refetchData,
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
      colorScheme:  config.manifest?.colorScheme  ?? 'light',
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
    ageGate: {
      enabled: config.ageGate?.enabled ?? false,
      minAge:  config.ageGate?.minAge  ?? 16,
    },
  }
}

// ─── Env ──────────────────────────────────────────────────────────────────────

function readEnv() {
  const rawUrl  = process.env.URL
  const baseUrl = rawUrl ?? 'http://localhost:8080'
  const minify  = parseBool(process.env.MINIFY, true)
  const previewEnabled = parseBool(process.env.IS_PREVIEW, false)

  return {
    rawUrl,
    baseUrl,
    minify,
    inlineCss:         parseBool(process.env.INLINE_CSS, true),
    isMaintenanceMode: parseBool(process.env.MAINTENANCE, false),
    doIndexPages:      parseBool(process.env.DO_INDEX_PAGES, true),
    maxProducts:       parseNum(process.env.MAX_PRODUCTS, -1),
    debug: {
      enabled: parseBool(process.env.ITSSHOPS_DEBUG, false),
    },
    serve: {
      port:        parseNum(process.env.SERVE_PORT,         8080),
      liveReload:  parseBool(process.env.SERVE_LIVE_RELOAD, true),
      refetchData: parseBool(process.env.SERVE_REFETCH_DATA, true),
    },
    preview: {
      enabled:      previewEnabled,
      documentType: process.env.PREVIEW_TYPE,
      documentId:   process.env.PREVIEW_ID,
      locale:       process.env.PREVIEW_LOCALE as Locale | undefined,
      perspective:  process.env.PREVIEW_PERSPECTIVE,
    },
    sanity: {
      projectId: process.env.SANITY_PROJECT_ID,
      dataset:   process.env.SANITY_DATASET,
      token:     process.env.SANITY_TOKEN,
      studioUrl: process.env.SANITY_STUDIO_URL,
    },
    vinofact: {
      endpoint:     process.env.VINOFACT_API_URL,
      accessToken:  process.env.VINOFACT_API_TOKEN,
      profileSlug:  process.env.VINOFACT_PROFILE_SLUG,
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

function resolveCspDirectives(input: CspDirectives | undefined): ResolvedCspDirectives {
  return {
    'script-src':  input?.['script-src']  ?? [],
    'connect-src': input?.['connect-src'] ?? [],
    'frame-src':   input?.['frame-src']   ?? [],
    'img-src':     input?.['img-src']     ?? [],
    'media-src':   input?.['media-src']   ?? [],
    'style-src':   input?.['style-src']   ?? [],
  }
}

function resolveFeatures(input: ItsshopsFeatures | undefined, env: ReturnType<typeof readEnv>): Features {
  const vinofactInput = input?.shop?.vinofact
  const vinofactIntegration = vinofactInput?.integration ?? (
    env.vinofact.endpoint && env.vinofact.accessToken && env.vinofact.profileSlug
      ? { endpoint: env.vinofact.endpoint, accessToken: env.vinofact.accessToken, profileSlug: env.vinofact.profileSlug }
      : undefined
  )

  return {
    shop: {
      enabled:      !!input?.shop,
      checkout:     input?.shop?.checkout     ?? false,
      manufacturer: input?.shop?.manufacturer ?? false,
      stock:        input?.shop?.stock        ?? false,
      category:     input?.shop?.category     ?? false,
      coupons:      input?.shop?.coupons      ?? false,
      vinofact: {
        enabled:     vinofactInput?.enabled     ?? false,
        fields:      vinofactInput?.fields,
        integration: vinofactIntegration,
      },
    },
    blog: input?.blog ?? false,
    users: {
      enabled: !!input?.users,
      registrationFields:
        input?.users && typeof input.users === 'object'
          ? (input.users.registrationFields ?? [])
          : [],
    },
  }
}
