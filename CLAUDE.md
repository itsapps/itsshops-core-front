# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build   # build to dist/ (also runs on pre-commit)
npm run dev     # build in watch mode
```

No test suite. Consumer projects use `npm link` — run `npm run dev` (tsup watch) and changes are picked up directly.

## Architecture

`@itsapps/itsshops-core-front` — shared npm library consumed by customer Eleventy-based shop frontends.

### Entry point

`src/index.ts` exports `shopCoreFrontendPlugin` — an Eleventy plugin customers register in `eleventy.config.mts`:

```ts
import { shopCoreFrontendPlugin } from '@itsapps/itsshops-core-front'
eleventyConfig.addPlugin(shopCoreFrontendPlugin, config)
```

The plugin wires up: templates, filters, CSS, Sanity client, and the `cms` global data object.

### Config (`src/types/index.ts`)

```ts
type Config = {
  sanity: SanityClientConfig       // Sanity credentials
  locales: Locale[]                // ['de', 'en']
  defaultLocale: Locale
  features?: {
    shop?: boolean
    blog?: boolean
    users?: boolean
  }
  permalinks?: Partial<Record<Locale, PermalinkTranslations>>  // override URL segments
  extensions?: {
    queries?:  Record<string, string>              // custom document GROQ → cms[locale].key
    fields?:   Record<string, string>              // extra fields on core types (variant, menuItem, ...)
    modules?:  Record<string, Record<string, string>> // custom module projections per doc type (page, post, category, ...)
  }
  tailwind?: { cssPath?: string }
  preview?: { enabled?: boolean }
}
```

### Data flow

```
Config
  → buildPermalinkTranslations()    src/i18n/permalinks.ts
  → createSanityClient()            src/core/clients/sanity.ts
  → buildCmsData()                  src/data/resolver.ts
      ├── buildProductQuery()       src/data/queries.ts  (dynamic GROQ with extension injection)
      ├── buildVariantQuery()
      ├── buildCategoryQuery()
      ├── buildPageQuery()
      ├── buildPostQuery()
      ├── buildMenuQuery()
      └── buildSettingsQuery()
      → resolveString/Image/Seo()   src/data/locale.ts   (locale resolution)
      → generateVariantSlug()       src/data/resolver.ts (kind-aware slug: wine/physical/digital/bundle)
      → deduplicateSlug()
  → cms global data: { de: CmsLocaleData, en: CmsLocaleData }
```

### CMS global data shape

Templates access `cms[locale].products`, `cms[locale].categories` etc. All localized fields are pre-resolved plain strings — no locale filters needed in templates.

```ts
CmsLocaleData = {
  products:   ResolvedVariant[]    // one per variant, with product fallbacks applied
  categories: ResolvedCategory[]
  pages:      ResolvedPage[]
  posts:      ResolvedPost[]
  menus:      ResolvedMenu[]
  settings:   ResolvedSettings | null
  // + any extension query results (cms[locale].events, cms[locale].pinwall, ...)
}
```

### Variant slug generation (`src/data/resolver.ts`)

- **wine**: `slugify(title + volume + vintage?)`
- **physical/digital**: `slugify(title + option names)`
- **bundle**: `slugify(title)`
- Collision-safe: tracked per locale via a `Set`, appends `-2`, `-3` etc.

### Extension injection (`src/data/queries.ts`)

Three extension points injected into GROQ queries at build time:
- `extensions.fields.variant` → appended to variant projection
- `extensions.fields.menuItem` → appended to menuItem projection (both levels)
- `extensions.modules.page` → conditional projections in `page.modules[]`
- `extensions.queries.events` → runs as separate query, merged into `cms[locale].events`

### Template system (`src/config/templates.ts`)

Core templates in `src/templates/` registered as virtual Eleventy templates. Customer overrides by placing files at matching paths in their project. `misc/` templates are protected (throws on conflict).

Template structure:
- `layouts/` — base Nunjucks layouts
- `pages/` — page templates (organized by feature)
- `components/` — reusable components
- `core/components/` — non-overridable core components
- `misc/` — utility templates (Netlify redirects etc.)

### Permalink translations (`src/i18n/permalinks.ts`)

Core defaults (de/en). Customers override per-locale segments via `config.permalinks`.

| Segment | de | en |
|---------|----|----|
| product | produkte | products |
| category | kategorien | categories |
| blog | blog | blog |
| page | seiten | pages |

### Sanity types

Core-front does not carry a copy of the generated Sanity schema types. The resolved shapes it actually consumes (`ResolvedVariant`, `ResolvedCategory`, etc.) live in `src/types/data.ts`. Customer projects generate their own full `sanity.types.ts` via `sanity typegen`.

### Build outputs (tsup)

| Entry | Output | Purpose |
|-------|--------|---------|
| `src/index.ts` | `dist/index.js` | Main plugin + all types |
| `src/core/index.ts` | `dist/core.js` | Sanity client only |
| `src/bin/itsshops.ts` | `dist/itsshops.js` | CLI binary |
| `tailwind.config.ts` | `dist/tailwind.js` | Tailwind config |
| `src/netlify/functions/preview.ts` | `dist/preview.js` | Netlify preview function |

`src/templates/` and `src/assets/` copied to `dist/` post-build.

### CLI (`itsshops` binary)

```bash
itsshops eleventy --serve    # dev server
itsshops eleventy --watch    # watch mode
itsshops eleventy --debug    # with Eleventy debug namespaces
itsshops netlify             # netlify dev
itsshops clean               # clean dist/, src/_includes/css, src/_includes/scripts
```

Uses `tsx` + `--import tsx` to run Eleventy with TypeScript. Always targets `eleventy.config.mts` in the consumer project.

---

## Ecosystem

### Core backend (`itsshops-core-back`)
`/Users/kampfgnu/Documents/programming/jamstack/itsshops-core-back`

Sanity Studio plugin. Customer projects call `createItsshopsWorkspaces(config)`. Schemas for: product, productVariant, category, page, post, blog, menu, settings, manufacturer, variantOption etc.

Feature flags (backend superset): `shop`, `shop.manufacturer`, `shop.stock`, `shop.category`, `shop.vinofact`, `shop.productKind.wine/physical/digital/bundle/options`, `blog`, `users`

### Customer backends
- Jurtschitsch: `/Users/kampfgnu/Documents/programming/web/jurtschitsch/webshop-backend`
- Tinhof: `/Users/kampfgnu/Documents/programming/web/tinhof/webshop-backend`

Extend core via `ItsshopsConfig`: `documents[]`, `objects[]`, `schemaExtensions`, `structure[]`, `i18n`.

### Customer frontend
- Jurtschitsch: `/Users/kampfgnu/Documents/programming/web/jurtschitsch/webshop-frontend`

Registers plugin in `eleventy.config.mts`, configures via `itsshops.config.mts` (type `Config`).

### Reference implementation
`/Users/kampfgnu/Documents/programming/jamstack/itsapps_ffmh_frontend` — standalone predecessor. Does not use this package. Gold standard for full feature set: checkout (Stripe), users (Supabase), search, i18n, Netlify functions, PDF, email.
