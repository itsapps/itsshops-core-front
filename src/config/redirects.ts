import type { Redirect, ResolvedRedirect } from '../types'

const STATUSES = [301, 302, 307, 308]

/**
 * Validates `config.redirects` and fills defaults. Throws on a rule Netlify would misread
 * (a space splits the line into fields) or that would break core's own rules.
 */
export function resolveRedirects(input: Redirect[] | undefined): ResolvedRedirect[] {
  const seen = new Set<string>()
  return (input ?? []).map((r, i) => {
    const fail = (msg: string) => {
      throw new Error(`[itsshops] config.redirects[${i}] (${r.from} → ${r.to}): ${msg}`)
    }
    if (typeof r.from !== 'string' || !r.from.startsWith('/')) fail('`from` must start with "/"')
    if (r.from === '/') fail('`from` must not be "/" — core redirects "/" to the default locale')
    if (/\s/.test(r.from)) fail('`from` must not contain whitespace')
    if (typeof r.to !== 'string' || !/^(\/|https?:\/\/)/.test(r.to)) fail('`to` must start with "/" or "http(s)://"')
    if (/\s/.test(r.to)) fail('`to` must not contain whitespace')
    const status = r.status ?? 301
    if (!STATUSES.includes(status)) fail(`\`status\` must be one of ${STATUSES.join(', ')}`)
    if (seen.has(r.from)) fail('duplicate `from` — only the first rule would apply')
    seen.add(r.from)
    return { from: r.from, to: r.to, status, force: r.force ?? false }
  })
}
