# CSP & security headers

Core generates a Netlify **`_headers`** file at build with a strict Content-Security-Policy plus
security headers. Built in `src/config/headers.ts`; customers extend it via `config.headers`.

## How it's emitted

- `setupHeaders(ctx)` registers a `buildNetlifyHeaders` shortcode (skipped in preview).
- `src/templates/misc/netlify_headers.njk` has `permalink: /_headers` and calls
  `{%- buildNetlifyHeaders cms -%}` — so the whole `_headers` file is produced at build time from the
  resolved config + the `cms` data.
- Netlify applies `_headers` per route pattern.

## Base CSP (`buildNetlifyHeaders` → `base`)

Default `default-src 'self'` and `frame-ancestors 'none'`, then per-directive defaults, several of
which are **feature-driven**:

| Directive | Always | Conditionally added |
|---|---|---|
| `script-src` | `'self'` + inline-script hashes | GTM (`https://www.googletagmanager.com`) when a `settings.gtmId` exists |
| `connect-src` | `'self'` | GTM + Google-Analytics hosts when `gtmId` |
| `img-src` | `'self' data: https://cdn.sanity.io` | `https://i.vinofact.com` when vinofact; GTM/GA when `gtmId` |
| `media-src` | `'self' https://cdn.sanity.io` | — |
| `style-src` | `'self' 'unsafe-inline'` | — |
| `frame-src` | `'self'` | — |

Then `mergeExtra(base, config.headers.extra)` appends the customer's site-wide sources (below).

## Security headers (`securityHeaders`)

Added to every route: `X-Content-Type-Options: nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin`, `Strict-Transport-Security` (HSTS, 2y + preload), and a
`Permissions-Policy` that disables autoplay/camera/gyroscope/magnetometer/microphone and sets
`payment=(self + Stripe)` **only on the checkout route** (every other route, and no-checkout sites,
get `payment=()`). Stripe express pay is mounted only on the checkout page, so the grant is scoped
there (least privilege) via `securityHeaders(allowPayment)`. If express pay is ever added elsewhere
(e.g. the cart overlay), widen the grant to that route. See the ADR
[payment-permissions-policy-checkout-only](../decisions/payment-permissions-policy-checkout-only.md).

## Per-route CSP

`_headers` gets multiple route blocks, most specific wins:
1. **`/*`** — base CSP (+ hCaptcha site-wide when `newsletter` and `captchaSiteKey` are both set,
   because the newsletter widget is usually in the footer).
2. **Checkout routes** `/<locale>/<checkout>/*` (when `shop.checkout`) — adds Stripe origins to
   `script-src`/`connect-src`/`style-src`/`frame-src`.
3. **Captcha routes** — auth `register`/`recover` (when `users`) and the withdrawal page (when shop +
   `captchaSiteKey`) get hCaptcha origins.
4. **Customer custom routes** — one block per `config.headers.routes[]` entry (base + that route's
   `extra`).

## Inline-script hashing

Head inline scripts run under the strict CSP **without** `'unsafe-inline'` for scripts — each is
sha256-hashed and the `'sha256-…'` is added to `script-src`. `getInlineScriptHashes` (`headers.ts`)
builds the list:
- `theme.js` — only when `manifest.colorScheme !== 'light'`
- `age-gate.js` — only when `ageGate.enabled` and not in preview
- **every other `.js`** in the customer's `src/assets/scripts/inline/` (anything not in the
  `CONDITIONAL_CORE_SCRIPTS` set) — hashed unconditionally.

For `theme.js`/`age-gate.js` the **customer's copy wins**: it hashes
`src/assets/scripts/inline/<name>.js` if present, else core's `dist/templates/scripts/inline/<name>.js`.

**One `<script>` per file.** `templates/core/head/js-inline.njk` emits each inline script in its own
`<script>` tag — concatenating them would change the bytes the browser hashes and the CSP would block
them. Don't merge inline scripts into one tag.

⚠️ **Two-directory split (matters for customer inline scripts).** Hashing reads
`src/assets/scripts/inline/`, but the template `{% include "scripts/inline/<name>.js" %}` resolves
through the Nunjucks search path — `src/_includes/scripts/inline/` (customer) then the package's
`dist/templates/scripts/inline/` (core). So the *served* script and the *hashed* script can come from
different places. Core is self-consistent (both sides use `dist/templates/scripts/inline/`), but a
customer override/addition must keep the **same built `.js` in both** `src/assets/scripts/inline/`
(for the hash) and the include location, or the hash won't match the served script and CSP blocks it.
See the authoring guide in [templates-and-assets.md](templates-and-assets.md).

## Customer extension (`config.headers`)

```ts
headers?: {
  extra?:  CspDirectives                              // appended to the base /* CSP (site-wide)
  routes?: Array<{ path: string; extra: CspDirectives }>  // extra CSP for a specific route pattern
}
```
`CspDirectives` keys (all optional, arrays of origins): `script-src`, `connect-src`, `img-src`,
`media-src`, `style-src`, `frame-src`. Pick the directive by *how* the resource loads:
- external **`<img>` / CSS background / tiles** → `img-src`
- **`fetch`/XHR/WebSocket/`EventSource`** → `connect-src`
- external **`<script>`** → `script-src`
- **`<iframe>`** → `frame-src`
- external **stylesheet / `@font-face` CSS** → `style-src`

### Example — Leaflet + OpenStreetMap tiles (Tinhof)

Leaflet pulls OSM raster tiles as `<img>`, so only `img-src` needs the tile host:

```ts
// itsshops.config.mts (tinhof)
headers: {
  extra: {
    'img-src': ['https://tile.openstreetmap.org'],
  },
},
```
(If a library also did `fetch`/WebSocket calls you'd add `connect-src`; if it injected an iframe,
`frame-src`; etc.) For a map only on one page, scope it with `routes: [{ path: '/en/map/*', extra: {…} }]`
instead of site-wide `extra`.

> CSP failures are silent in the browser console (blocked, not thrown). When a third-party asset
> doesn't load, check the console for a CSP violation and add the host to the right directive here.
