# CLAUDE.md — itsshops-core-front

Entry point for any Claude session in this repo. Read this fully first, then load the
`.claude/` file that matches what you're working on. `.claude/` content is loaded on demand —
this file stays the always-loaded router.

| Working on… | Read next |
|---|---|
| Plugin wiring, config resolution, env vars, feature flags, build modes | `.claude/architecture/plugin-and-config.md` |
| Configuring the plugin — full `Config` field reference + env-var map | `.claude/architecture/configuration.md` |
| Translations (UI strings + URL segments) and how to override them / add a locale | `.claude/architecture/i18n.md` |
| Extending for custom schemas/fields/modules — `config.extensions`, resolve hooks, portable text, search | `.claude/architecture/extending.md` |
| GROQ queries, projections, locale resolution, slug generation, extension *internals*, vinofact | `.claude/architecture/data-layer.md` |
| Templates (core vs overridable), CSS/Tailwind, images, gallery, client JS | `.claude/architecture/templates-and-assets.md` |
| Nunjucks filters & shortcodes available in templates (catalog) | `.claude/architecture/filters-and-shortcodes.md` |
| CSP / security headers — how `_headers` is built, adding allowed hosts (e.g. map tiles) | `.claude/architecture/csp-and-headers.md` |
| Checkout/Stripe, users/Supabase, newsletter, email, orders/tax/shipping/coupons (Netlify functions + client scripts) | `.claude/architecture/commerce-and-netlify.md` |
| Releasing a new version / relinking into a customer project | `.claude/workflows/relink-and-release.md` |
| How customers consume core (git dep + lockfile pin) and deploy (Netlify branches) | `.claude/workflows/consuming-core-and-deploy.md` |
| Why a non-obvious choice was made | `.claude/decisions/` |

Keep these docs current: run `/update-docs` after any change that moves a path, adds a subsystem,
or establishes a rule. See `~/.claude/commands/update-docs.md`.

---

## What this is

`@itsapps/itsshops-core-front` (package v1.4.1) — a shared npm **library + Eleventy plugin** consumed
by customer Eleventy shop frontends. It provides the full frontend: data layer (Sanity → resolved
`cms` global), templates, CSS/Tailwind, client-side JS, and a Netlify-function commerce/users backend.

Consumers register it in `eleventy.config.mts`:

```ts
import { shopCoreFrontendPlugin } from '@itsapps/itsshops-core-front'
eleventyConfig.addPlugin(shopCoreFrontendPlugin, config)   // config: type Config
```

## Commands

```bash
npm run build   # tsup → dist/
npm run dev     # tsup --watch + watch-templates.mjs (consumers npm link this)
npm run test    # vitest (netlify commerce logic has real unit tests)
```

No dev server here — develop against a consumer project that has `npm link`ed this package.
**Do not use yalc** to push/publish.

## Entry point (`src/index.ts`)

`shopCoreFrontendPlugin(eleventyConfig, config)`:
1. `resolveConfig(config)` → `CoreConfig` (merges config + env, resolves features/permalinks/CSP)
2. creates Sanity client + image builder, sets up translation, builds a `CoreContext`
3. wires setup modules: ignores, plugins, css, filters, shortcodes, assets, js, headers, templates
4. registers global data: `cms` (lazy, cached unless `serve.refetchData`), `coreConfig`, `imageSizes`, `pageDoc`

`cms` is produced by `buildCmsData()` (async) — see data-layer doc.

## Config (`src/types/config.ts`) & resolution (`src/config/config.ts`)

Customer passes a `Config`; `resolveConfig()` merges it with env vars into `CoreConfig`. Most values
fall back to env, a few (`SANITY_PROJECT_ID`, `SANITY_DATASET`) hard-fail if missing. Feature flags
live under `config.features` (`shop{checkout,manufacturer,stock,category,coupons,vinofact,...}`,
`blog`, `users`, `newsletter`). `buildMode` is `preview` | `maintenance` | `normal`. Full field list
and env mapping: `.claude/architecture/plugin-and-config.md`.

## `cms` global data shape

Templates read `cms[locale]` (per-locale `CmsLocaleData`) and `cms.products/categories/pages/posts`
(flat, locale-stamped, for pagination). All localized fields are pre-resolved to plain strings — no
locale filters in templates. `CmsLocaleData` carries `products`, `categories`, `filterGroups`,
`pages`, `posts`, `menus`, `settings`, `shopSettings`, `urlMap`, `docMap`, `searchIndex`, a large set
of well-known page URLs (`shopUrl`, `checkoutUrl`, `loginUrl`, …), plus any extension query results.
Canonical type: `src/types/data.ts`.

## Source layout

```
src/
├── index.ts             # plugin entry + public re-exports
├── config/              # resolveConfig, feature resolution, setup modules, tailwind/
├── data/                # queries, projections, resolve/ (per-type resolvers), slug, portableText, vinofact, search
├── i18n/                # permalinks + translations (de/en, 11ty/server/shared)
├── image/ · gallery/    # responsive image URLs/srcset + lightbox render
├── filters/ · shortcodes/ · schema/ · shared/   # Eleventy filters, shortcodes, schema.org, shared validation/API clients
├── scripts/             # client-side JS (cart, checkout, user auth, newsletter, filters, search); scripts/inline/ = head-inlined
├── netlify/             # commerce/users backend: functions/, lib/, services/, utils/, types/ (+ __tests__)
├── templates/           # Nunjucks: core/ (protected) + overridable/ + layouts/ + pages/ + macros/ + misc/
├── types/               # Config, data shapes, netlify, vinofact, generated sanity.types
└── bin/                 # itsshops CLI
```

## Build outputs (tsup)

| Entry | Output | Purpose |
|---|---|---|
| `src/index.ts` | `dist/index.js` | Main plugin + all public exports/types |
| `src/core/index.ts` | `dist/core.js` | Sanity client only |
| `src/bin/itsshops.ts` | `dist/itsshops.js` | CLI binary |
| `src/config/tailwind/tailwind.config.ts` | `dist/tailwind.js` | Tailwind config |
| `src/netlify/functions/preview.ts` | `dist/preview.js` | Netlify preview function |

`src/templates/` and `src/assets/` are copied to `dist/` post-build.

## Ecosystem (canonical map — customer repos link here)

| Repo | Path | Role |
|---|---|---|
| core-front | `/Users/kampfgnu/Documents/programming/jamstack/itsshops-core-front` | this repo — Eleventy plugin/library |
| core-back | `/Users/kampfgnu/Documents/programming/jamstack/itsshops-core-back` | Sanity Studio plugin (`createItsshopsWorkspaces`) |
| Jurtschitsch | `/Users/kampfgnu/Documents/programming/web/jurtschitsch/{webshop-backend,webshop-frontend}` | active customer (wine) |
| Tinhof | `/Users/kampfgnu/Documents/programming/web/tinhof/{webshop-backend,webshop-frontend}` | customer (wine) |
| itsapps | `/Users/kampfgnu/Documents/programming/web/itsapps/{webpage_backend,webpage_frontend}` | customer (webpage) |
| grass-art | `/Users/kampfgnu/Documents/programming/web/grass-art/{webshop-backend,webshop-frontend}` | customer |
| others | `/Users/kampfgnu/Documents/programming/web/{fem_innenarchitektur,yogamax,rosi_schuster,…}` | customers (varying feature sets) |

Customers consume core via `npm link`. A customer frontend registers the plugin in
`eleventy.config.mts` and configures it via `itsshops.config.mts` (type `Config`).
