# Plan — locale regions (`og:locale`, optional regional formatting)

Status: **planned** 2026-11-18, not refined yet. core-front only (no core-back, no schema).
Trigger: Hotel Ploberger prospect review; applies to every customer.

## Problem

Core uses the bare language (`de`, `en`) everywhere. That is correct almost everywhere, with two
exceptions:

1. **`og:locale` is invalid.** Open Graph wants `language_TERRITORY` with an underscore
   (`de_AT`, `en_GB`). `src/templates/core/head/seo.njk:45` prints `de` / `en`; Facebook and
   LinkedIn then fall back to `en_US`.
2. **Formatting has no region.** `Intl.*` gets `de` / `en`, so English dates are US style
   ("Jan 5, 2027"), and an Austrian shop cannot opt into Austrian formats ("Jänner").

## Language vs. region — the rule (keep in `i18n.md`)

| Language only (`de`, `en`) — correct today, do **not** change | Language + region |
|---|---|
| `<html lang>`, `lang`/`hreflang` on links (core + customer header overrides) | `og:locale` (`de_AT`, underscore) |
| `hreflang` in `<head>` and sitemaps — `de` targets all German speakers (AT, DE, CH); `de-AT` would narrow it to Austria | `Intl` formatting of dates, numbers, prices (opt-in, phase 2) |
| schema.org `inLanguage` (BCP 47; `de` is valid) | |
| URL prefixes `/de/`, `/en/`, locale switcher, translations | |

The region says **which variant of the language** the site writes in (spelling, formats) — a
**site setting**, not a visitor choice. For German it is where the business is (an Austrian
business writes Austrian German → `de_AT`; a German one `de_DE`). For English there is no home
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
- **Phase 2 (formatting) is optional** and visible, so it is opt-in per locale, never derived
  automatically from the region. German `de-AT` changes "1.234,50 €" → "€ 1.234,50", numbers to
  "1 234,5" (U+202F narrow no-break space) and "Januar" → "Jänner"; `de-CH` uses
  "1’234.50". Each shop decides.

## Phase 1 — `og:locale`

**Config** (`src/types/config.ts`, resolved in `src/config/config.ts`):

```ts
/** Region per locale (ISO 3166-1 alpha-2), used where a region is required (og:locale). */
localeRegions?: Partial<Record<Locale, string>>
```

- Resolved `CoreConfig.localeRegions: Record<Locale, string>` with defaults
  `{ de: 'AT', en: 'GB' }` (all current customers are Austrian; British English fits a European
  audience). Validate: two uppercase letters, else warn and use the default.
- No env var.

**Filter** `ogLocale` (in `src/filters/index.ts`, pure helper exported for tests):

```ts
export function ogLocale(locale: string, regions: Record<string, string>): string
// ogLocale('de', { de: 'AT' }) → 'de_AT'; unknown locale without region → locale as is
```

**Template** `src/templates/core/head/seo.njk:45`:

```njk
<meta property="og:locale" content="{{ _locale | ogLocale }}" />
```

(The filter reads `config.localeRegions`, like `formatDate` reads `config.defaultLocale`.)

**Tests:** `src/filters/__tests__/og-locale.test.ts` — default regions, override, missing region,
invalid region falls back.

**Customer side:** nothing required; the defaults fit every active customer. A non-Austrian shop
sets `localeRegions: { de: 'DE' }` in `itsshops.config.mts`.

## Phase 2 — regional formatting (optional, decide before building)

**Config:**

```ts
/** BCP 47 tag for Intl formatting per locale. Default: the bare locale (today's behaviour). */
formatLocales?: Partial<Record<Locale, string>>   // e.g. { en: 'en-GB' } or { de: 'de-AT', en: 'en-GB' }
```

Resolved helper `intlLocale(locale)` → `formatLocales[locale] ?? locale`.

**Call sites to switch to `intlLocale(...)`** (all currently pass `page.lang` / order locale):

- Build: `src/filters/index.ts` (`formatPrice`, `formatNumber`, `formatVolumeList`, `formatDate`,
  `formatDateRange`, the `formatUpdated` date at ~l.407; leave `Intl.DisplayNames` on the bare
  locale — country names do not change with region), `src/shared/format-volume.ts`.
- Browser: `src/scripts/price.ts` callers — `cart-ui.ts`, `checkout-summary.ts`, `search.ts`,
  `order-thanks.ts`. They need the resolved tag from the page (e.g. a `data-format-locale` on
  `<html>` or the existing script config) — **check how they get `locale` today** during refine.
- Functions: `src/netlify/utils/i18n.ts` (`formatPrice`, `formatShopDate`) and their users
  (`simple-email.tsx`, `order-notifier.tsx`, `order-withdraw-notifier.tsx`, `InvoicePdf.tsx`,
  `OrderEmail.tsx`, `ShopOrderEmail.tsx`, `MailFooter.tsx`). Functions do not see the Eleventy
  config — **decide how the mapping reaches them** (env var like `SHOP_FORMAT_LOCALES`, or the
  function factory options) during refine.
- Leave alone: `src/netlify/functions/wc-api.ts` (fixed `en-GB`, internal ERP format).

**Risks:** the U+202F separator breaks tests/parsers that expect "1.234"; build and browser must
use the same tag or prices flicker between SSR and client render; Safari/Node ICU versions can
differ in edge cases.

**Tests:** extend filter tests and `price.ts` tests for `en-GB` and `de-AT`; one email/PDF snapshot
per tag.

## Docs and release

- `.claude/architecture/configuration.md`: `localeRegions` (+ `formatLocales` in phase 2).
- `.claude/architecture/i18n.md`: the "language vs. region" rule above.
- `CHANGELOG.md`: phase 1 = patch/minor ("`og:locale` now `de_AT`/`en_GB`"), no customer action.
  Phase 2 = minor, opt-in.
- After release: re-test a share preview (Facebook Sharing Debugger / LinkedIn Post Inspector) on
  one live customer (Tinhof or fem).

## Open questions

1. ~~Default regions — config or Studio setting?~~ **Config** (owner, 2026-11-18): set once at
   setup, needed at build, in the browser and in functions, and editors must not change formats.
   Not derived from `settings.company.address.country` (often empty on content sites; meaningless
   for English).
2. Phase 2: build it now, or wait until a customer asks? If now: default `en` → `en-GB` for all
   (English dates become "5 Jan 2027") or strictly opt-in?
