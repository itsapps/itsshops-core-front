/**
 * Same-origin redirect target from untrusted input (e.g. a `?next=` param). Returns
 * `pathname + search + hash` when `next` resolves to `origin` over http(s), else `fallback`.
 * Pass the value from `searchParams.get` as is — it's decoded already; decoding twice would let
 * `%2F%2Fevil.com` become `//evil.com`.
 */
export function safeRedirectPath(next: string | null | undefined, origin: string, fallback: string): string {
  if (!next) return fallback
  try {
    const url = new URL(next, origin)
    if (url.origin !== origin || (url.protocol !== 'https:' && url.protocol !== 'http:')) return fallback
    return url.pathname + url.search + url.hash
  } catch {
    return fallback
  }
}
