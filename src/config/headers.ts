import { createHash } from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type { CoreConfig, CoreContext, ResolvedCspDirectives } from '../types'

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

function getInlineScriptHashes(): string[] {
  const customerInlineDir = path.join(process.cwd(), 'src/assets/scripts/inline')
  return [...hashDir(coreInlineDir), ...hashDir(customerInlineDir)]
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

function buildNetlifyHeaders(
  cms: Record<string, any>,
  config: CoreConfig,
  inlineScriptHashes: string[],
): string {
  const gtmId = cms[config.defaultLocale]?.settings?.gtmId

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
      'style-src':   captcha,
      'frame-src':   captcha,
    })
    const usersCsp = buildCsp(usersSrc)
    for (const locale of config.locales) {
      routes.push(buildRoute(`/${locale}/${config.resolvedPermalinks[locale].register}/*`, usersCsp))
      routes.push(buildRoute(`/${locale}/${config.resolvedPermalinks[locale].recover}/*`, usersCsp))
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
  eleventyConfig.addGlobalData('inlineScriptHashes', getInlineScriptHashes)
  eleventyConfig.addShortcode('buildNetlifyHeaders', buildNetlifyHeaders)
}
