import { createHash } from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type { CoreConfig, CoreContext, ResolvedCspDirectives } from '../types'
import type { CmsData, CmsLocaleData } from '../types/data'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const coreInlineDir = path.join(__dirname, 'templates/scripts/inline')

// ─── Inline script hashing ────────────────────────────────────────────────────

function hashDir(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.js'))
    .map(f => {
      const content = fs.readFileSync(path.join(dir, f), 'utf8')
      const hash = createHash('sha256').update(content, 'utf8').digest('base64')
      return `'sha256-${hash}'`
    })
}

const CONDITIONAL_CORE_SCRIPTS = new Set(['theme.js', 'age-gate.js'])

function hashFile(dir: string, filename: string): string | null {
  const filePath = path.join(dir, filename)
  if (!fs.existsSync(filePath)) return null
  const content = fs.readFileSync(filePath, 'utf8')
  return `'sha256-${createHash('sha256').update(content, 'utf8').digest('base64')}'`
}

function getInlineScriptHashes(config: CoreConfig): string[] {
  const customerInlineDir = path.join(process.cwd(), 'src/assets/scripts/inline')
  const hashes: string[] = []

  if (config.manifest.colorScheme !== 'light') {
    const h = hashFile(customerInlineDir, 'theme.js') ?? hashFile(coreInlineDir, 'theme.js')
    if (h) hashes.push(h)
  }
  if (config.ageGate.enabled && !config.preview.enabled) {
    const h = hashFile(customerInlineDir, 'age-gate.js') ?? hashFile(coreInlineDir, 'age-gate.js')
    if (h) hashes.push(h)
  }

  // Any extra customer inline scripts not managed by core conditions
  if (fs.existsSync(customerInlineDir)) {
    for (const file of fs.readdirSync(customerInlineDir).filter(f => f.endsWith('.js') && !CONDITIONAL_CORE_SCRIPTS.has(f))) {
      const h = hashFile(customerInlineDir, file)
      if (h) hashes.push(h)
    }
  }

  return hashes
}

// ─── CSP / headers building ───────────────────────────────────────────────────

type CspSources = {
  scriptSrc:  string[]
  connectSrc: string[]
  imgSrc:     string[]
  mediaSrc:   string[]
  styleSrc:   string[]
  frameSrc:   string[]
}

function buildCsp(s: CspSources): string {
  return [
    "default-src 'self'",
    `script-src ${s.scriptSrc.join(' ')}`,
    `connect-src ${s.connectSrc.join(' ')}`,
    `img-src ${s.imgSrc.join(' ')}`,
    `media-src ${s.mediaSrc.join(' ')}`,
    `style-src ${s.styleSrc.join(' ')}`,
    `frame-src ${s.frameSrc.join(' ')}`,
    "frame-ancestors 'none'",
  ].join('; ')
}

const SECURITY_HEADERS = [
  'X-Content-Type-Options: nosniff',
  'Referrer-Policy: strict-origin-when-cross-origin',
  'Permissions-Policy: autoplay=(), camera=(), gyroscope=(), magnetometer=(), microphone=(), payment=*',
  'Strict-Transport-Security: max-age=63072000; includeSubDomains; preload',
]

function buildRoute(routePath: string, csp: string): string {
  return [routePath, `  Content-Security-Policy: ${csp}`, ...SECURITY_HEADERS.map(h => `  ${h}`)].join('\n')
}

function mergeExtra(base: CspSources, extra: ResolvedCspDirectives): CspSources {
  return {
    scriptSrc:  [...base.scriptSrc,  ...extra['script-src']],
    connectSrc: [...base.connectSrc, ...extra['connect-src']],
    imgSrc:     [...base.imgSrc,     ...extra['img-src']],
    mediaSrc:   [...base.mediaSrc,   ...extra['media-src']],
    styleSrc:   [...base.styleSrc,   ...extra['style-src']],
    frameSrc:   [...base.frameSrc,   ...extra['frame-src']],
  }
}

function buildNetlifyHeaders(cms: CmsData, config: CoreConfig): string {
  const gtmId = (cms[config.defaultLocale] as CmsLocaleData | undefined)?.settings?.gtmId
  const inlineScriptHashes = getInlineScriptHashes(config)

  const base: CspSources = {
    scriptSrc:  ["'self'", ...inlineScriptHashes,                      ...(gtmId ? ['https://www.googletagmanager.com'] : [])],
    connectSrc: ["'self'",                                              ...(gtmId ? ['https://www.googletagmanager.com', 'https://*.google-analytics.com', 'https://*.analytics.google.com'] : [])],
    imgSrc:     ["'self'", 'data:', 'https://cdn.sanity.io',           ...(gtmId ? ['https://www.googletagmanager.com', 'https://*.google-analytics.com'] : [])],
    mediaSrc:   ["'self'", 'https://cdn.sanity.io'],
    styleSrc:   ["'self'", "'unsafe-inline'"],
    frameSrc:   ["'self'"],
  }

  const merged = mergeExtra(base, config.headers.extra)
  const routes: string[] = [buildRoute('/*', buildCsp(merged))]

  if (config.features.shop.checkout) {
    const checkoutSrc = mergeExtra(merged, {
      'script-src':  ['https://js.stripe.com', 'https://*.js.stripe.com'],
      'connect-src': ['https://api.stripe.com'],
      'img-src':     [],
      'media-src':   [],
      'style-src':   ['https://m.stripe.network'],
      'frame-src':   ['https://js.stripe.com', 'https://*.js.stripe.com', 'https://hooks.stripe.com'],
    })
    for (const locale of config.locales) {
      routes.push(buildRoute(`/${locale}/${config.resolvedPermalinks[locale].checkout}/*`, buildCsp(checkoutSrc)))
    }
  }

  if (config.features.users.enabled) {
    const captcha = ['https://hcaptcha.com', 'https://*.hcaptcha.com']
    const usersSrc = mergeExtra(merged, {
      'script-src':  captcha,
      'connect-src': captcha,
      'img-src':     [],
      'media-src':   [],
      'style-src':   captcha,
      'frame-src':   captcha,
    })
    const usersCsp = buildCsp(usersSrc)
    for (const locale of config.locales) {
      routes.push(buildRoute(`/${locale}/${config.userPaths[locale].userRegistration}/*`, usersCsp))
      routes.push(buildRoute(`/${locale}/${config.userPaths[locale].userRecover}/*`, usersCsp))
    }
  }

  for (const route of config.headers.routes) {
    routes.push(buildRoute(route.path, buildCsp(mergeExtra(merged, route.extra))))
  }

  return routes.join('\n\n')
}

// ─── Setup ────────────────────────────────────────────────────────────────────

export const setupHeaders = (ctx: CoreContext) => {
  const { eleventyConfig, config } = ctx
  if (config.preview.enabled) return
  eleventyConfig.addShortcode('buildNetlifyHeaders', (cms: CmsData) => buildNetlifyHeaders(cms, config))
}
