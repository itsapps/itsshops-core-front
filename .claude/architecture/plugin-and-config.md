# Plugin wiring & config

## Setup flow (`src/index.ts`)

`shopCoreFrontendPlugin(eleventyConfig, itsshopsConfig)`:

1. `resolveConfig(itsshopsConfig)` → `CoreConfig` (`src/config/config.ts`)
2. `createSanityClient(config.sanity)` + `createImageBuilder(client)` (`src/core/`)
3. `setupTranslation(config)` → `translate` (`src/i18n/translations/frontTranslation.ts`)
4. builds `CoreContext` = `{ eleventyConfig, config, translate, imageBuilder, imageSizes }`
   — `imageSizes` = core defaults merged with `itsshopsConfig.imageSizes`
5. runs setup modules in order: `setupDev`, `setupIgnores`, `setupPlugins`, `cssConfig`,
   `createFilters`, `createShortcodes`, `setupAssets`, `setupJs`, `setupHeaders`, `setupTemplates`
6. registers global data: `cms` (lazy; cached in `cmsCache` unless `config.serve.refetchData`),
   `coreConfig`, `imageSizes`, `pageDoc` (empty default, overridden per-page)

`createEleventyConfig(projectConfig, extra?)` is a convenience wrapper returning the full Eleventy
config object (dir `src`→`dist`, `njk` engines) with the plugin pre-registered.

Each setup module lives in `src/config/<name>.ts` and takes the `CoreContext`. When adding a new
cross-cutting concern, add a `setupX` module and call it from `index.ts` — don't inline into it.

## Config resolution (`src/config/config.ts`)

`resolveConfig(config: Config): CoreConfig` merges the customer `Config` with environment variables.
Precedence is **config value ?? env value ?? default**.

- **Hard-fail if missing:** `SANITY_PROJECT_ID`, `SANITY_DATASET` (via `requireVar`)
- **Env-only / env-primary:** `URL` (→ `baseUrl`, default `http://localhost:8080`), `MINIFY`,
  `INLINE_CSS`, `MAINTENANCE`, `DO_INDEX_PAGES`, `MAX_PRODUCTS`, `ITSSHOPS_DEBUG`, `SERVE_*`,
  `PREVIEW_*`, `SANITY_TOKEN`/`SANITY_STUDIO_URL`, `VINOFACT_API_*`, `STRIPE_PUBLISHABLE_API_KEY`,
  `CAPTCHA_SITE_KEY`, `SUPPORT_EMAIL`, `PUBLIC_DEVELOPER_*`
- `parseBool` treats only the literal string `"true"` as true.

`buildMode` (derived): `preview` if `IS_PREVIEW`, else `maintenance` if `MAINTENANCE`, else `normal`.
The perspective is `drafts` (or `PREVIEW_PERSPECTIVE`) in preview, `published` otherwise.

## Feature flags (`resolveFeatures`)

`config.features` is normalized to a `Features` object. Frontend feature set:

```
shop: { enabled, checkout, manufacturer, stock, category, coupons, checkoutAgeConfirmation,
        vinofact: { enabled, fields, integration } }
blog
users: { enabled, registrationFields }
newsletter
```

- `shop.enabled` = truthiness of `config.features.shop`; sub-flags default `false`.
- `shop.vinofact.integration` falls back to env (`VINOFACT_API_URL` + `_TOKEN` + `PROFILE_SLUG`) when
  not given in config — all three must be present or it's `undefined`.
- `users` and `shop` accept either a boolean or an object (object form carries extra fields like
  `registrationFields`).

The backend (`itsshops-core-back`) has a **superset** of these flags — keep the two in mind when a
feature spans both repos.

## CSP / headers

`config.headers.extra` and per-route `config.headers.routes[].extra` are `CspDirectives` merged by
`resolveCspDirectives` into a fixed set of keys (`script-src`, `connect-src`, `frame-src`, `img-src`,
`media-src`, `style-src`). `setupHeaders` (`src/config/headers.ts`) emits them; payment/CSP behavior
is tied to whether checkout is enabled.

## Other resolved config of note

`units.volume` (`'l'`), `units.price.currency` (`'EUR'`), `menu.maxDepth` (default 1),
`manifest` (PWA theme colors), `ageGate` (`{enabled, minAge: 16}`), `imagePlaceholders`,
`resolvedPermalinks` (see data-layer / i18n), `userPaths`.
