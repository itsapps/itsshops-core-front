# Language stays bare; region only for og:locale (config) and opt-in formatting (env)

Status: accepted
Date: 2026-11-19 (core-front after 5.2.0, unreleased at the time)

## Context

Core used the bare language (`de`, `en`) everywhere. Two places need a region: `og:locale` must be
`language_TERRITORY` (`de` was invalid; Facebook/LinkedIn fell back to `en_US`), and `Intl`
formatting without a region gives US-style English dates and no Austrian formats ("Jänner"). Prices
and dates are formatted at build time, in the browser and in at least six function entry points
(order, withdrawal, webhook, status, refund, newsletter/auth mails). Functions never see
`itsshops.config` — each wrapper passes hand-copied options. Plan: handbook `plans/locale-regions.md`.

## Decision

- `lang`, `hreflang`, `inLanguage`, URL prefixes, translations, the API/Stripe/order `locale` and
  `Intl.DisplayNames` stay bare. `hreflang="de"` targets every German speaker; `de-AT` would narrow
  it. No regional language picker (same content, duplicate pages).
- **`og:locale` from config `localeRegions`**, default `{ de: 'DE', en: 'GB' }` (owner). `de_DE` is
  certainly on Facebook's locale list, `de_AT` unverified, and platforms use only the language.
  Build-only, so a config field is enough. Not taken from `settings.company.address.country`
  (often empty, meaningless for English) and not a Studio setting (editors must not change it).
- **Regional formatting is opt-in via env var `SHOP_FORMAT_LOCALES`**, never derived from the
  region: the change is visible (`de-AT` → "€ 1.234,50", no-break-space thousands), so each shop
  decides. Env var, not a config field: build, browser (via `data-format-locale` from the build) and
  functions must use the same tag, and a config field would need copying into every function
  wrapper — a mismatch would show one format on the site and another in the mail. Same pattern as
  `SHOP_FORMALITY` (`formality-env-and-overlays.md`).
- No `og:locale:alternate` (only meaningful when one URL serves several languages via `fb_locale`).
- No `en_AT`: Intl formats it with German separators and it is not on Facebook's list.

## Consequences

- Every shop gets `de_DE` / `en_GB` with no action; an Austrian shop may set `{ de: 'AT' }`.
- Unset `SHOP_FORMAT_LOCALES` = byte-identical formatting to before. When set, it must be on the
  Netlify project for Builds **and** Functions.
- Pure helpers (`formatPrice`, `formatVolumeMl`, …) keep taking a locale; callers wrap it with
  `intlLocale()`. A new formatting call site must do the same (browser: `pageFormatLocale()`), or
  the site shows mixed formats.
- Real per-country versions (own prices, currency, legal texts) remain a separate feature.
