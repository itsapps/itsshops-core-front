# Configuration reference (`Config`)

The object a customer passes to `shopCoreFrontendPlugin` (in `itsshops.config.mts`). Canonical type:
`src/types/config.ts` (`Config`). Resolution order is **config value ?? env var ?? default**;
`resolveConfig` (`src/config/config.ts`) produces the internal `CoreConfig`. For the resolution
mechanics / feature-flag normalization see [plugin-and-config.md](plugin-and-config.md); this file is
the field reference.

```ts
// itsshops.config.mts
import { type Config } from '@itsapps/itsshops-core-front'
export const projectConfig: Config = { /* … */ }
```

## Fields

### Project identity & locales
- `locales?: Locale[]` — default `['de','en']`. **Core ships UI translations for de/en only** — any
  other locale needs full `translations` (see [i18n.md](i18n.md)) or the build throws on missing keys.
- `defaultLocale?: Locale` — default `'de'`.
- `sanity?: SanityClientConfig` — `{ projectId, dataset, token?, studioUrl?, … }`. `projectId` and
  `dataset` are **required** (hard-fail) and usually come from env (`SANITY_PROJECT_ID`,
  `SANITY_DATASET`); `token`/`studioUrl` from `SANITY_TOKEN`/`SANITY_STUDIO_URL`.

### Features (`features?: ItsshopsFeatures`)
Omitting `shop` disables the shop; sub-flags default to `false`.
```ts
features: {
  shop?: { checkout?, manufacturer?, stock?, category?, coupons?, checkoutAgeConfirmation?,
           vinofact?: { enabled, fields?, integration? } },
  blog?: boolean,
  users?: boolean | { registrationFields?: UserRegistrationField[] },
  newsletter?: boolean,
}
```
`checkout` is frontend-only (Stripe flow). `vinofact.fields` lists extra wine fields to fetch;
`integration` falls back to `VINOFACT_API_*` env. Backend feature flags are a superset — keep both
repos' configs aligned.

### i18n & URLs
- `translations?: Record<string, any>` — per-locale overrides deep-merged over core (`common` /
  `shared` namespaces). See [i18n.md](i18n.md).
- `permalinks?: Partial<Record<Locale, PermalinkTranslations>>` — per-locale URL **segments** for
  content types (product/category/blog/page). (User/account/newsletter/withdraw segments live in
  `translations.<locale>.shared.urlPaths` instead — see [i18n.md](i18n.md).)

### Data extensions
- `extensions?: Extensions` — custom GROQ fields/queries/modules, resolve hooks, portable-text sets,
  search. Full guide: [extending.md](extending.md).
- `imageSizes?: Record<string, PictureSize>` — responsive-image presets, merged with core defaults.
- `imagePlaceholders?: Record<string, string>`.

### Presentation / CSS / JS
- `css?: Css` — `{ cssPath?, minify?, inline?, viewport?{min,max}, screens?, colors?, fontFamilies?,
  textSizes?, spacings? }`. `cssPath` points at the exported Tailwind config; the token arrays drive
  the design-token system (see [templates-and-assets.md](templates-and-assets.md)).
- `js?: Js` — `{ minify? }`.
- `manifest?` — PWA `{ themeBgColor '#ffffff', themeColor '#000000', colorScheme 'light' }`.
- `menu?: { maxDepth? }` — menu nesting depth, default `1`.
- `units?: { volume?, price?: { currency?, currencyLabel? } }` — `price.currency` default `'EUR'`;
  `currencyLabel` replaces the Intl symbol. ⚠️ `units.volume` **defaults to `'l'` in
  `resolveConfig`**, though the `Config` JSDoc says `'ml'` — code wins; verify if it matters.
- `ageGate?: { enabled? (false), minAge? (16) }`.
- `developer?: { name?, website? }` — also from `PUBLIC_DEVELOPER_*` env.

### Headers / CSP
- `headers?: { extra?: CspDirectives, routes?: [{ path, extra }] }` — extra CSP sources appended to
  every route (and per-route). Directive keys: `script-src`, `connect-src`, `frame-src`, `img-src`,
  `media-src`, `style-src`. Payment CSP is auto-managed when checkout is enabled. Full mechanism +
  when to use which directive (e.g. map tiles): [csp-and-headers.md](csp-and-headers.md).

### Env-overridable runtime flags
Each has an env default; the config value wins when set:
`baseUrl` (`URL`), `doIndexPages` (`DO_INDEX_PAGES`), `maxProducts` (`MAX_PRODUCTS`),
`debug.enabled` (`ITSSHOPS_DEBUG`), `serve.{port,liveReload,refetchData}` (`SERVE_*`),
`preview.{documentType,documentId,locale}` (`PREVIEW_*`), `css/js.minify` (`MINIFY`), `css.inline`
(`INLINE_CSS`), `stripe.publishableApiKey` (`STRIPE_PUBLISHABLE_API_KEY`), `captchaSiteKey`
(`CAPTCHA_SITE_KEY`), `supportEmail` (`SUPPORT_EMAIL`). Build mode: `IS_PREVIEW`→preview,
`MAINTENANCE`→maintenance, else normal.

## Env var → config field map
The authoritative list is the comment block in `src/types/config.ts` (above `Config`). Env is the
fallback; the matching `Config` field overrides it. `SANITY_PROJECT_ID` / `SANITY_DATASET` are the
only ones with no safe default — missing → the build throws.

See the live example in `jurtschitsch/webshop-frontend/itsshops.config.mts` (+ `src/_config/`).
