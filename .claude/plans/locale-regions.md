# Plan — locale regions (`og:locale`, opt-in regional formatting)

Status: **planned** 2026-11-18; refined 2026-11-19 (round 1, 86/100); owner decisions 2026-11-19 (default `de_DE`, build both
phases, phase 2 via env var); refined 2026-11-19 (round 2, 93/100). **Built 2026-11-19** (both phases,
released in core-front `5.3.0`) — checked in a Tinhof build: `og:locale` `de_DE`/`en_GB`
on all 222 pages; with `SHOP_FORMAT_LOCALES=de:de-AT,en:en-GB` only prices/dates/lists change
(`en-GB` also drops the Oxford comma in `formatVolumeList`). Open: share-preview re-test. core-front only (no
core-back, no schema, no customer change required).
Trigger: Hotel Ploberger prospect review; applies to every customer.

## Problem

Core uses the bare language (`de`, `en`) everywhere. That is correct almost everywhere, with two
exceptions:

1. **`og:locale` is invalid.** Open Graph wants `language_TERRITORY` with an underscore
   (`de_AT`, `en_GB`). `src/templates/core/head/seo.njk:45` prints `_locale` (`de` / `en`);
   Facebook and LinkedIn then fall back to `en_US`.
2. **Formatting has no region.** `Intl.*` gets `de` / `en`, so English dates are US style
   ("Jan 5, 2027"), and an Austrian shop cannot opt into Austrian formats ("Jänner").

## Language vs. region — the rule (keep in `i18n.md`)

| Language only (`de`, `en`) — correct today, do **not** change | Language + region |
|---|---|
| `<html lang>`, `lang`/`hreflang` on links (core + customer header overrides) | `og:locale` (`de_AT`, underscore) |
| `hreflang` in `<head>` and sitemaps — `de` targets all German speakers (AT, DE, CH); `de-AT` would narrow it to Austria | `Intl` formatting of dates, numbers, prices (opt-in, phase 2) |
| schema.org `inLanguage` (BCP 47; `de` is valid) | |
| URL prefixes `/de/`, `/en/`, locale switcher, translations | |
| `locale` sent to the API / Stripe (`checkout.ts`), order `locale`, translations in mails | |
| `Intl.DisplayNames` (country/language names) | |

The region says **which variant of the language** the site writes in (spelling, formats) — a
**site setting**, not a visitor choice. For German it is where the business is (an Austrian
business writes Austrian German → `de_AT`; a German one `de_DE`) — in principle; core's
default is still `de_DE` for safety (see Decisions). For English there is no home
variant: it is a choice, and `GB` is the default for European businesses. Not `en_AT`: Intl
formats English with German separators ("€ 1.234,50"), and Facebook's `og:locale` list only has
`en_GB`/`en_US` (no `en_AT`, no `en_150`). No `de-AT`/`de-DE` or `en-GB`/`en-US` picker: content
is the same, so separate versions would only duplicate pages.
Real per-country versions (own prices/currency/legal text, `/de-ch/`) are a different feature,
not in scope. Spelling (British vs. American) is a content decision, not code.

## Decisions (owner, 2026-11-18)

- **Phase 1 is needed:** fix `og:locale`.
- **No `og:locale:alternate`:** it only works when one URL serves several languages via
  `fb_locale`; core has one URL per language, and other platforms ignore the tag.
- **Phase 2 (formatting) is opt-in** and visible, so it is set per locale, never derived
  automatically from the region. Measured (Node 22, ICU 77 / CLDR 47): `de-AT` turns prices
  "1.234,50 €" → "€ 1.234,50" (dot kept), plain numbers "1.234.567,5" → "1 234 567,5" (U+00A0
  no-break space; may differ between ICU versions) and "Januar" → "Jänner"; `de-CH` gives
  "1’234’567.5" / "EUR 1’234.50"; `en-GB` changes dates only ("5 January 2027"), numbers and
  prices are the same as `en`. Each shop decides.
- **Regions are config, not a Studio setting** (open question 1, answered).
- **Default regions `{ de: 'DE', en: 'GB' }`** (owner, 2026-11-19): `de_DE` is certainly on
  Facebook's locale list (`de_AT` is unverified), and platforms only use the language anyway. An
  Austrian shop may set `localeRegions: { de: 'AT' }`; nobody has to.
- **Build phase 2 now, with phase 1** (owner, 2026-11-19), although no shop uses it yet: without
  `SHOP_FORMAT_LOCALES` every output stays exactly as today (bare `de`/`en`).
- **Phase 2 is configured by env var `SHOP_FORMAT_LOCALES`** (owner, 2026-11-19), not a config
  field — reason in Phase 2.

## Phase 1 — `og:locale`

All of it is build-side; `og:locale` is only printed in `seo.njk` (checked 2026-11-19: every
active customer renders core's `seo.njk` via `layouts/base.njk:7`; no active customer prints its
own `og:locale` — only old/dormant repos like `jurtschitsch/jurtschitsch_frontend`, `ffmh`,
`rosswildalm`, `vrs` have their own `meta-info.njk`; leave them).

1. **Config type** — `src/types/config.ts`, next to `locales`/`defaultLocale` in `Config`
   (~l.401):

   ```ts
   /** Region per locale (ISO 3166-1 alpha-2), used where a region is required (og:locale).
    *  Default `{ de: 'DE', en: 'GB' }`. */
   localeRegions?: Partial<Record<Locale, string>>
   ```

   and in `CoreConfig` (~l.520): `localeRegions: Record<Locale, string>`. (`Locale` is
   `'de' | 'en'` in `src/types/localization.ts`, so the record is complete.)
2. **Resolve** — `src/config/config.ts`: exported pure helper, called in `resolveConfig` as
   `localeRegions: resolveLocaleRegions(config.localeRegions)`:

   ```ts
   const DEFAULT_LOCALE_REGIONS: Record<Locale, string> = { de: 'DE', en: 'GB' }
   export function resolveLocaleRegions(input?: Partial<Record<Locale, string>>): Record<Locale, string>
   // per locale: trim + toUpperCase; /^[A-Z]{2}$/ → use it; otherwise
   // console.warn(`[itsshops] Invalid localeRegions.${locale} "${value}", using "${default}"`)
   // and use the default. Missing key → default, no warning.
   ```

   No env var (build-only; nothing on the function side needs it).
3. **Filter** — `src/filters/index.ts`: exported pure helper + registration in `createFilters`
   (closure over the resolved `config`, like the other filters):

   ```ts
   export function ogLocale(locale: string, regions: Partial<Record<string, string>>): string {
     const region = regions[locale]
     return region ? `${locale}_${region}` : locale
   }
   // in createFilters:
   eleventyConfig.addFilter('ogLocale', (locale: string) => ogLocale(locale, config.localeRegions))
   ```

4. **Template** — `src/templates/core/head/seo.njk:45`:

   ```njk
   <meta property="og:locale" content="{{ _locale | ogLocale }}" />
   ```

5. **Tests**
   - `src/filters/__tests__/og-locale.test.ts` (imports `ogLocale` from `../index`, like
     `variants.test.ts`): `de` + `{ de: 'AT' }` → `de_AT`; `en` + `{ en: 'GB' }` → `en_GB`;
     locale without region → locale as is.
   - `src/config/__tests__/locale-regions.test.ts`: no input → `{ de: 'DE', en: 'GB' }`;
     `{ de: 'AT' }` → `{ de: 'AT', en: 'GB' }`; `{ de: 'at' }` → `AT` (normalised);
     `{ de: 'AUT' }` / `''` → default + one `console.warn` (spy).

**Customer side:** nothing required — no config, no env var, no function parameter, nothing in
the backend. Every shop gets `og:locale` `de_DE` / `en_GB`. `localeRegions` exists for a shop
that wants another region (e.g. `{ de: 'AT' }` — only after checking that Facebook accepts
`de_AT`). The starter (`itsshops-starter`) needs no change.

## Phase 2 — regional formatting (built now, opt-in by env var)

**One source for build, browser and functions: env var `SHOP_FORMAT_LOCALES`** (decided), e.g. `en:en-GB` or `de:de-AT,en:en-GB`. Why not a config
field: functions never see `itsshops.config` — each wrapper passes its own hand-copied options
(Tinhof's `payment_create.mts` repeats `defaultLocale`), and prices/dates are formatted in at
least 6 function entry points (notify, withdraw notify, webhooks, status, refund, newsletter/auth
mails). A config field would need copying into each wrapper, and a mismatch shows different
formats on the site and in the mail. `SHOP_FORMALITY` already works this way (`readFormality()` in
`src/i18n/formality.ts`, read by `resolveConfig` at build **and** by `netlify/utils/i18n.ts` at
runtime). (`SHOP_TIMEZONE` is env-only too, but read by the functions alone — `shopTimeZone()`.)

1. **Helper** — new `src/i18n/format-locale.ts` (mirrors `formality.ts`):

   ```ts
   /** `SHOP_FORMAT_LOCALES` → { de?: 'de-AT', en?: 'en-GB' }. Invalid entries (not
    *  `Intl.getCanonicalLocales`-valid, or a tag whose language ≠ the key) warn once and are
    *  skipped — never fail a build or a mail. */
   export function readFormatLocales(value = process.env.SHOP_FORMAT_LOCALES): Partial<Record<string, string>>
   /** The Intl tag for a locale: formatLocales[locale] ?? locale. */
   export function intlLocale(locale: string, map = readFormatLocales()): string
   ```

   Parsing: split on `,`, each entry on the first `:`, trim both sides; the key must be a
   `Locale` (`de`/`en`), the tag canonicalised via `Intl.getCanonicalLocales(tag)[0]` (throws →
   invalid) and its language (`new Intl.Locale(tag).language`) must equal the key — so `en:de-AT`
   or `fr:fr-FR` warn and are skipped. Warn once per raw value (a module-level `Set`, as
   `readFormality`), and memoise the parsed map per raw string (`Map<string, …>`), because
   `intlLocale()` is called per mail line / per variant. Empty/unset → `{}`.

   `resolveConfig` adds `formatLocales: readFormatLocales()` to `CoreConfig` (type
   `Partial<Record<Locale, string>>`, doc comment like `formality`'s at ~l.527). In
   `src/types/config.ts` add `SHOP_FORMAT_LOCALES` to the `EnvVars` type (next to
   `SHOP_FORMALITY`, ~l.61) and to the env-map comment (~l.397, "env only — the functions read it
   too").
2. **Build call sites.** The pure helpers (`formatPrice`, `formatVolumeMl` — exported to
   customers via `src/index.ts`, `formatVolumeList`, `formatNumber`, `formatDate`,
   `formatDateRange`) stay unchanged; wrap the **resolved** locale where they are called:
   - `src/filters/index.ts` registrations: `formatPrice`, `formatVolume`, `formatVolumeList`,
     `formatDate`, `formatNumber`, `formatDateRange`, and `formatUpdated` inside the
     `privacyPolicy` filter (use `intlLocale(locale, …)` for the `Intl.DateTimeFormat`, keep the
     filter's `locale` bare for `translate`/`countryName`). Wrap the whole fallback chain —
     `formatPrice` gets an explicit locale from templates (`formatPrice(product.locale)` in
     `macros/product.njk:28–50` and Jurtschitsch's `product/container.njk`):

     ```ts
     const fmt = (locale: string | undefined, page?: { lang?: string }) =>
       intlLocale(locale || page?.lang || config.defaultLocale, config.formatLocales)
     // formatPrice: formatPrice(price, fmt(locale, this.page), currency, currencyLabel)
     // formatVolume / formatVolumeList / formatDate / formatNumber / formatDateRange:
     //   fmt(undefined, this.page)
     ```

     **Not** `countryName`/`countryList`/`trans`/`portableText`/schema.
   - Data layer: `src/data/resolver.ts:221` (`formatVolume` passed to the search extension) →
     `formatVolumeMl(ml, config.units.volume, intlLocale(locale, config.formatLocales))`.
     `src/data/resolve/filters.ts:102` (volume filter labels) and
     `src/data/resolve/variants.ts:22` (variant subtitle parts) → `intlLocale(ctx.locale)`
     (default map = `readFormatLocales()`, memoised). **Do not** change `ctx.locale` itself
     (`makeCtx` in `src/data/resolve/context.ts`) — it feeds `resolveString`/`translate`, which
     need the bare locale.
3. **Browser** — `src/templates/layouts/base.njk:2`: `<html lang="{{ page.lang }}"
   {%- if coreConfig.formatLocales[page.lang] %} data-format-locale="{{ coreConfig.formatLocales[page.lang] }}"{% endif %}>`.
   (`maintenance.njk`'s own `<html>` needs nothing — no prices.)
   `src/scripts/price.ts` gets `export function pageFormatLocale(): string | undefined` →
   `document.documentElement.dataset.formatLocale || document.documentElement.lang || undefined`.
   Use it for the formatter only, at: `cart-ui.ts:103`, `search.ts:144`, `order-thanks.ts:43`,
   and `checkout.ts:157` (the `CheckoutSummary` locale argument only — `checkout.ts`'s `locale`
   also goes to `calculatePayment`, Stripe `initElements` and the order: keep that bare).
   Leave `Intl.DisplayNames` in `checkout-fulfillment.ts:141` / `checkout.ts:397`.
4. **Functions** — apply `intlLocale()` **inside** the helpers, so callers stay unchanged:
   `src/netlify/utils/i18n.ts` `formatPrice` and `formatShopDate` (covers `simple-email.tsx`,
   `order-notifier.tsx`, `order-withdraw-notifier.tsx`, `newsletter-notifier.tsx`,
   `auth-notifier.tsx`, `templates/email/mail-keys.ts`, `OrderEmail.tsx`, `ShopOrderEmail.tsx`,
   `InvoicePdf.tsx`), and `src/netlify/lib/order-item-display.ts:33` (`formatVolumeMl` for
   composed subtitles). Leave alone: `Intl.DisplayNames` in `OrderEmail.tsx`,
   `ShopOrderEmail.tsx`, `MailFooter.tsx`, `InvoicePdf.tsx:76`; `wc-api.ts` (fixed `en-GB`,
   ERP format); `src/shared/pickup.ts` (`en-CA`, an internal date key).
5. **Rollout per shop:** set `SHOP_FORMAT_LOCALES` in the frontend Netlify project (scopes
   Builds **and** Functions) for staging and production, then rebuild. Unset = today's output.

**Risks:** the no-break-space separator (U+00A0 in current ICU) breaks tests/parsers that expect "1.234"; build and browser use
the same tag by construction (`data-format-locale` comes from the build) — SSR/client flicker
only if a script bypasses `pageFormatLocale()`; Safari/Node ICU versions can differ in edge
cases. Volumes (`0,75l`) are identical for `de`/`de-AT` and `en`/`en-GB` below 1000, so cart
subtitles composed at checkout still match `addToCartButton`'s.

**Tests:** `src/i18n/__tests__/format-locale.test.ts` (parse, invalid entry skipped + warn,
`intlLocale` fallback); extend `src/scripts/__tests__/price.test.ts` for `en-GB` / `de-AT`
(`de-AT`: `€ 1.234,50`, `1\u00a0234,5`; `en-GB`: unchanged price); the netlify `formatPrice`/`formatShopDate` with
`SHOP_FORMAT_LOCALES` stubbed (`vi.stubEnv`, `vi.unstubAllEnvs` in `afterEach`) in the same
`format-locale.test.ts` (existing `formatShopDate` tests live in
`src/i18n/__tests__/formality.test.ts`, not `src/netlify/__tests__/`); `composeSubtitle` in
`order-item-display.test.ts` with `de-AT` → same "0,75l" as `de`. No email/PDF snapshots — the helper tests cover the
one place that changes.

## Docs and release

- `.claude/architecture/configuration.md`: `localeRegions` field (+ `SHOP_FORMAT_LOCALES` in the
  env-var map, phase 2).
- `.claude/architecture/i18n.md`: the "language vs. region" rule above (+ phase 2:
  `SHOP_FORMAT_LOCALES`, next to `SHOP_FORMALITY`).
- `.claude/architecture/templates-and-assets.md` (SEO/share-tag section, ~l.78): `og:locale` =
  locale + region via `ogLocale`; `filters-and-shortcodes.md`: add `ogLocale`.
- `CHANGELOG.md`: one **minor** entry for both phases — "`og:locale` now `de_DE`/`en_GB`
  (override: `localeRegions`)" and "opt-in regional formats via `SHOP_FORMAT_LOCALES`"; no
  customer action.
- Release: core-front only → `npm run build`, push, then each customer picks it up with its next
  release (core-front `consuming-core-and-deploy.md` → "Release flow"; production pins the tag).
  No backend release.
- After release: re-test a share preview (Facebook Sharing Debugger / LinkedIn Post Inspector) on
  one live customer (Tinhof or fem): `og:locale` `de_DE` accepted, no warning.

## Open questions

1. ~~Default regions — config or Studio setting?~~ **Config** (owner, 2026-11-18): set once at
   setup, needed at build, in the browser and in functions, and editors must not change formats.
   Not derived from `settings.company.address.country` (often empty on content sites; meaningless
   for English).
2. ~~Phase 2: build it now or wait?~~ **Build now, strictly opt-in** (owner, 2026-11-19); no
   default `en-GB`.
3. ~~Phase 2 mechanism?~~ **Env var `SHOP_FORMAT_LOCALES`** (owner, 2026-11-19), as
   `SHOP_FORMALITY`. Phase 1's `localeRegions` stays config (build-only).
4. ~~Default region for `de`?~~ **`DE`** (owner, 2026-11-19), see Decisions.
