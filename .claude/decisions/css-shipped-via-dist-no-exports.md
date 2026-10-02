# CSS ships via `dist/` copies, not `exports` subpaths

**Status:** Active
**Date:** 2026-10-02

## Context

Core ships 8 stylesheets for customers to compose into their `global.css` (`reset`, `core`, `form`,
`checkout`, `lightbox`, `product-filter-price`, `search`, `age-gate`). They were also exposed as
`package.json` `exports` subpaths (`./core.css` → `./dist/core.css`, …), but every customer imports
them via the deep `dist/` path instead.

Verified 2026-10-02 against the actual pipeline resolver (`postcss-import` v16.1.1): **`postcss-import`
does not honor the package `exports` map — it resolves physically.** There is no root-level
`core.css` (only `dist/core.css`), so:
- `@import '@itsapps/itsshops-core-front/dist/core.css'` → resolves ✓
- `@import '@itsapps/itsshops-core-front/core.css'` (the subpath) → fails ✗

A grep across all 7 customer frontends + core + docs found **zero** uses of the subpath form;
`lightbox.css` never had a subpath at all.

## Decision

Ship the CSS as `dist/*.css` (copied by the tsup `onSuccess` step) and consume it via
`@import '@itsapps/itsshops-core-front/dist/<name>.css'`. The 7 CSS `exports` subpaths were **removed**
2026-10-02 — unused by the whole ecosystem and misleading (they imply a resolution that doesn't work
through PostCSS). `files: ["dist/"]` keeps the files published regardless.

This is CSS-only. All **JS** `exports` subpaths (`.`, `./core`, `./scripts`, `./test-utils`,
`./functions/*`) are load-bearing and stay — normal JS resolution does honor `exports`.

## Consequences

- Customers must use the `dist/<name>.css` path; the clean subpath form is intentionally gone.
- Adding a new importable CSS file = create `src/assets/css/<name>.css` + a `copySync` line in
  `tsup.config.ts` `onSuccess`; **no** `exports` entry. (See templates-and-assets.md.)
- If a customer is ever moved to an `exports`-aware bundler (Vite/esbuild for CSS), re-add subpaths
  then — but none exists today.
