# Templates, CSS, images & client JS

For the Nunjucks **filters & shortcodes** available in templates, see
[filters-and-shortcodes.md](filters-and-shortcodes.md).

## Template system (`src/config/templates.ts`)

Core templates in `src/templates/` are added to the Nunjucks search path by `setupTemplates` /
`loadTemplates`. The search order is **customer `src/_includes` first, then core** — so a customer
file at the *same relative path* shadows the core template. That's the whole override mechanism:

```
# customer project
src/_includes/overridable/product/card.njk     # overrides core templates/overridable/product/card.njk
```

**Protected (build throws on conflict):**
- `core/` templates — a customer file at `src/_includes/core/<same path>` throws
  "not allowed to override the core template".
- `layouts/` — a customer file with the same layout name throws.
So `core/` and layouts are intentionally non-overridable; `overridable/`, and the top-level `pages/` /
`macros/` are the customer surface.

In debug mode, `setNunjucksEnvironmentOptions({ throwOnUndefined: true })` makes any undefined
template variable fail the build.

```
src/templates/
├── layouts/       # base Nunjucks layouts
├── pages/         # page templates: standard/ · preview/ · maintenance/
├── macros/        # reusable Nunjucks macros
├── core/          # NON-overridable core: components/ · head/ · modules/ · partials/
├── overridable/   # customer-overridable: category/ · gallery/ · modules/ · page/ · post/ · product/ · partials/
└── misc/          # utility templates (Netlify redirects etc.) — PROTECTED: build throws on override conflict
```

Rule of thumb: `core/`, `misc/`, and `layouts/` are internal/protected (see above); `overridable/`
and the top-level `pages/` / `macros/` are the customer surface. `pages/` is split by `buildMode`
(`standard` / `preview` / `maintenance`).

**Menu-rendering overrides** (customer `header.njk`/`footer.njk`/menu partials) branch on
`item.linkType` and must handle all four types. `system` (fixed core routes such as the withdrawal
form, see data-layer.md → "Menus & system links") renders like an internal link: `href="{{ item.url }}"`,
no `rel`, `{{ item.url | linkActiveState | safe }}` for `aria-current`. An override without that
branch silently omits the link, including the guaranteed Widerruf footer link. Don't hardcode that
link in footers; core adds it.

**Core-shipped static files:** `src/assets/legal/` → `dist/assets/legal/` (tsup `onSuccess`) →
passed through to `/assets/legal/` by `setupAssets` (official legal graphics, also linked from the
order email). Legal modules/partials: `core/modules/withdrawalPolicyModule.njk`,
`core/modules/shippingInfoModule.njk`, `core/components/partials/legal-guarantee-notice.njk` —
see `commerce-and-netlify.md` → "Legal texts".

**System pages have no `pageDoc`** (withdrawal, login, checkout, 404, newsletter/user flows in
`pages/standard/`). Each sets `titleKey: staticPages.<name>.title` in its front matter (the same
key as its `<h1>`); `core/head/seo.njk` falls back to `titleKey | trans` for `<title>`, and
header overrides should do the same wherever they show `pageDoc.title`. A new system page must
set `titleKey` too, or it gets only the site name as its title.
These pages are also `noindex: true`, which gives them a **minimal head**: no canonical, hreflang,
og/twitter tags or WebSite/Organization JSON-LD (only the page's own flag counts, not site-wide
`doIndexPages`). Why: `decisions/noindex-pages-minimal-head.md`.

`npm run dev` runs `scripts/watch-templates.mjs` alongside tsup so template edits propagate to
linked consumers without a full rebuild.

## CSS / Tailwind (`src/config/css.ts`, `src/config/tailwind/`)

`cssConfig(ctx)` registers a hoisted `css` bundle and a `.css` Eleventy extension (skipped entirely
in preview). Compilation:
- **The global entry** — `config.css.cssPath` or the default `src/assets/css/global/global.css` — is
  run through PostCSS: `postcss-import-ext-glob` → `postcss-import` → `postcss-custom-media` →
  `postcss-nesting` → **tailwindcss** → autoprefixer. Everything else is skipped except…
- files under **`src/assets/css/bundle/`**, which pass through **as-is** (no PostCSS) — escape hatch
  for pre-built/third-party CSS.

### Token-driven Tailwind (`src/config/tailwind/`)
`getTailwindConfig(overrides)` (built to `dist/tailwind.js`) merges the core **design tokens**
(`design-tokens/{colors,fonts,spacing,text-sizes}.ts`) with the customer's token arrays passed via
`config.css` — `colors`, `fontFamilies`, `textSizes`, `spacings`, `screens`, `viewport`. The
`css-utils/` helpers turn tokens into the Tailwind theme (`tokens-to-tailwind.ts`) and generate fluid
`clamp()` sizes (`clamp-generator.ts`). So a customer themes the shop by supplying token arrays in
`itsshops.config.mts` (Jurtschitsch keeps them in `src/_config/{colors,fonts,text-sizes,spacing}.mts`),
not by rewriting CSS. The token → CSS-custom-property system also powers the shared form system and
CSS-mask cart icons.

Customer CSS entry: `src/assets/css/global/global.css` (or `config.css.cssPath`).
`config.css.minify`/`inline` control output.

**`src/_includes/css/global.css` is a generated build artifact — never edit it** (customers gitignore
it). After compiling the entry, `css.ts` *writes* the result there so `core/head/css.njk` can
`{% include "css/global.css" %}` it (inline `<style>` or the hoisted `css` bundle). It's overwritten
on every build; edit the entry and its imports (`src/assets/css/global/**`) instead. When grepping a
customer repo for CSS, exclude it — it's a compiled copy of everything.

### Importable core CSS files

Core ships ready-made stylesheets that customers `@import` into their `global.css` entry (resolved by
`postcss-import`). Source is `src/assets/css/*.css`, copied to `dist/*.css` by the tsup `onSuccess`
step; most are also exposed via `package.json` `exports`:

| File | Contains |
|---|---|
| `reset.css` | CSS reset / base normalize |
| `core.css` | core shop/layout styles |
| `form.css` | the shared token-driven form system |
| `checkout.css` | checkout UI |
| `lightbox.css` | gallery lightbox |
| `product-filter-price.css` | product-list price-range filter |
| `search.css` | search UI |
| `age-gate.css` | age-gate overlay |

Customers compose the ones they need, by **feature** — e.g. `checkout.css` only with checkout,
`search.css` with search, `age-gate.css` with the age gate, `lightbox.css` with galleries. Import via
the package path:

```css
/* src/assets/css/global/global.css (customer) */
@import '@itsapps/itsshops-core-front/dist/reset.css';
@import '@itsapps/itsshops-core-front/dist/core.css';
@import '@itsapps/itsshops-core-front/dist/form.css';
@import '@itsapps/itsshops-core-front/dist/checkout.css';
@import '@itsapps/itsshops-core-front/dist/lightbox.css';
/* …then the project's own tokens/blocks/utilities… */
```

**The `dist/<name>.css` path is required — do NOT switch to the export subpath form.** Verified
(2026-10-02) against core's `postcss-import` v16.1.1: `postcss-import` does **not** honor the package
`exports` map; it resolves physically. There is no root-level `core.css` (only `dist/core.css`), so:
- `@import '@itsapps/itsshops-core-front/dist/core.css'` → **resolves** ✓
- `@import '@itsapps/itsshops-core-front/core.css'` (the export subpath) → **fails** ✗
  (`Failed to find …`)

So the `dist/` imports in `global.css` are correct for this Eleventy/PostCSS pipeline — `files`
includes `dist/`, and that's what makes them resolvable (independent of `exports`).

The CSS files have **no `exports` subpaths** — the 7 that existed (`./core.css`, …) were removed
2026-10-02 after confirming no project in the ecosystem imported them (all 7 customer frontends use
the `dist/` form; `postcss-import` ignores `exports` anyway). Always `@import` the `dist/<name>.css`
path. If you ever move a customer to a bundler that honors `exports`, you'd re-add subpaths then.

## Images (`src/image/`, `src/gallery/`)

`src/image/index.ts` exports the responsive-image toolkit (all re-exported from `src/index.ts`):
`image`, `preload`, `staticImage`, `staticPreload`, `preGenerateStaticImages`, `imageUrl`,
`imageSizeUrl`, `imageSizes`, `imageSrcsetData`, plus vinofact variants. Types `PictureSize` /
`PictureOptions`. `imageSizes` defaults merge with `config.imageSizes`.

`src/gallery/render.ts` renders gallery markup; the interactive lightbox is `src/scripts/lightbox.ts`
+ `src/scripts/gallery.ts`.

The embla gallery partials `overridable/gallery/main.njk` + `thumbs.njk` are driven by `_gallery*`
template variables set by the including template (`_galleryImages`, `_galleryImage`,
`_galleryImageSize`, `_galleryThumbSize`, …; each partial's header lists them). Thumbs render only
from `_galleryThumbsMin` images up (default 2; set 1 to show a thumb for a single image).

## Client-side JS (`src/scripts/`, `src/config/js.ts`)

`setupJs` registers a `.ts` Eleventy extension that **esbuild-bundles the deferred entry** to
`dist/assets/scripts/` (ESM, `es2020`, code-splitting, `config.js.minify`). The entry is the
customer's `src/assets/scripts/index.ts` **if it exists**, else core's default (shipped as
`dist/scripts/index.ts` via a tsup `onSuccess` copy). Any change under `src/assets/scripts/` triggers
a full rebuild from that entry. Skipped in preview. So a customer can **override the whole client
bundle** by providing its own `assets/scripts/index.ts` (typically re-exporting/extending core's).

The browser modules in `src/scripts/`, grouped by feature:

- **cart**: `cart-store.ts`, `cart-ui.ts`, `variant-select.ts`
- **checkout**: `checkout*.ts` (api, coupon, express, form, shipping, stripe, summary)
- **users**: `user-*.ts` (login, register, recover, reset, confirm, withdraw), `user-store.ts`
- **newsletter**: `newsletter-*.ts`
- **browse**: `product-filter.ts`, `search.ts`, `carousel.ts`, `menu.ts`, `gallery.ts`,
  `lightbox.ts`
- **order thanks** (flow in [commerce-and-netlify.md](commerce-and-netlify.md)): `order-thanks.ts`,
  `order-snapshot.ts` (sessionStorage summary), `order-status.ts` (order-number lookup),
  `pending-payment.ts` (cart cleanup marker)
- **misc**: `age-gate.ts`, `captcha.ts`, `order-withdraw.ts`, `inert-lock.ts`
- **shared rendering**: `template-utils.ts` (clone `<template>`, fill `data-slot`s),
  `price.ts` (`createPriceFormatter` — the one cents → string formatter for cart, checkout, search),
  `cart-item-render.ts` (`fillCartItem`), `order-totals.ts` (`renderTotals` / `renderSubtotal`).

**Cart lines & totals** are client-rendered from `<template>`s whose markup comes from
`macros/cart.njk`: `cartItem({ editable, stockNote })` (editable = qty −/+ and remove; read-only =
quantity as text) and `totalsRow()` (a `<dt>/<dd>` pair inside `<dl class="checkout-totals">`).
Import them `with context` — `trans` needs `page.lang`, otherwise labels fall back to the default
locale. Cart sidebar (`cart-item-template`) and checkout (`checkout-item-template`,
`checkout-totals-row-template`) share them; don't add another hand-written copy. Values are filled
via `textContent` only (coupon codes, titles are user/editor input).

**Product filter panel** (`product-filter.ts`): `[data-toggle-products-filter]` toggles `is-open` on
`[data-filter-panel]` and syncs `aria-expanded` — by default a plain inline disclosure (tinhof,
grass-art). Adding `data-filter-panel-modal` opts the panel into a **modal dialog** for layouts where
it's a full-screen overlay (jurtschitsch, small screens only): while open it gets `role="dialog"`
`aria-modal`, `aria-labelledby` from `data-filter-panel-labelledby`, the rest of the page is inerted
(`lockInertOutside([panel], { deep: true })`), `html.has-filter-panel-open` locks scroll (`core.css`),
Escape / any `[data-filter-panel-close]` closes it and focus returns to the toggle. It closes itself
(without moving focus) on resize once the toggle is no longer rendered — so a customer that shows the
panel as an inline sidebar on desktop must **hide the toggle** at that breakpoint. Modal is opt-in so
the inline-disclosure customers are unaffected. Opening/closing animation is customer CSS.

`inert-lock.ts` — `lockInertOutside(keep)` inerts only `<body>`'s other children (fine for overlays
mounted at the top level: menu, cart). Pass `{ deep: true }` when the kept element lives deep inside
the page (e.g. inside `<main>`) so the siblings of each ancestor are inerted too.

The deferred entry `src/scripts/index.ts` runs eagerly on every page and **lazy-loads** feature
modules on demand, guarded by DOM markers (e.g. `if (document.querySelector('[data-checkout]'))
import('./checkout')…`). A new feature module must be wired in here (with its `data-*` guard) to ship.

## Adding a CSS / JS asset to core — what to update

The build wiring is split across `tsup.config.ts` (entries + `onSuccess` copies) and
`src/config/{css,js}.ts` (runtime). When adding an asset, touch **all** the listed places or it won't
ship.

### A new importable CSS file
1. Create `src/assets/css/<name>.css`.
2. Add a `copySync('src/assets/css/<name>.css', 'dist/<name>.css', …)` line to `tsup.config.ts`
   `onSuccess` (that copy is what publishes it — the CSS is **not** otherwise bundled).
3. **No `package.json` `exports` entry** — CSS has no export subpaths (postcss-import ignores
   `exports`; see the CSS section above).
4. Customers `@import '@itsapps/itsshops-core-front/dist/<name>.css'` and you add it to the
   **Importable core CSS files** table above.

### A new deferred (browser) script
1. Add `src/scripts/<name>.ts` exporting an `init…()`.
2. Wire it into `src/scripts/index.ts` with a `data-*` DOM guard + lazy `import()`.
3. That's it for shipping — `onSuccess` copies `src/scripts` → `dist/scripts` (the fallback default
   entry), and esbuild bundles the entry on the customer build. No tsup entry / no `exports` needed.
4. If it needs styles, add a CSS file per above.

### A new inline (head) script — in core
Inline scripts run in `<head>` before paint (e.g. no-FOUC theme, age gate) and must satisfy the
strict CSP via per-file sha256 hashes (see [csp-and-headers.md](csp-and-headers.md)).
1. Add `src/scripts/inline/<name>.ts`.
2. Add it to the esbuild `entryPoints` array in `tsup.config.ts` `onSuccess` (builds an IIFE to
   `dist/templates/scripts/inline/<name>.js`).
3. Include it in `src/templates/core/head/js-inline.njk` as its **own** `<script>` tag
   (`<script>{% include "scripts/inline/<name>.js" %}</script>`) — never concatenate inline scripts
   into one tag, that breaks the hashes. Add a conditional if it should only load sometimes.
4. The hash is picked up automatically by `getInlineScriptHashes` (it reads
   `dist/templates/scripts/inline/`). No CSP edit needed.

### Inline scripts in a customer project
Core auto-includes only `theme.js` / `age-gate.js`. A customer can **override** those or add new
inline scripts, but mind the two-directory split (see csp-and-headers.md):
- The **hash** is read from `src/assets/scripts/inline/<name>.js`.
- The **`{% include %}`** resolves from `src/_includes/scripts/inline/<name>.js` (or, for a brand-new
  script, whatever head override you add) — a *different* directory.
So place the **same built `.js`** in both locations, or the CSP hash won't match the served script and
the browser blocks it. A new (non-theme/age-gate) inline script also needs its own `<script>…include…`
in a head-template override, since `js-inline.njk` only emits the two core ones. (No current itsshops
customer uses custom inline scripts — this path works but is lightly trodden; verify the hash matches.)

(For a new **Netlify function**, see the checklist in
[commerce-and-netlify.md](commerce-and-netlify.md) — functions *do* need a tsup `entry` **and** a
`package.json` `exports` subpath.)

`src/scripts/inline/` (`age-gate.ts`, `theme.ts`) are built as **separate tsup entries** and inlined
into `<head>` by the head template to run before paint (no-FOUC theme, age gate) — not part of the
deferred bundle. `src/shared/` holds code shared between client scripts and Netlify functions
(`validation.ts`, `*-api.ts` typed API clients).

## Static assets (`src/config/assets.ts`)

`setupAssets` passthrough-copies (skipped in preview): `src/assets/fonts/` → `/assets/fonts/`,
`src/assets/images/static/*` → `/assets/images/`, and `src/assets/images/favicon/*` → `/`.

## Template API (filters, shortcodes, schema.org)

`createFilters(ctx)` / `createShortcodes(ctx)` register the Nunjucks template API — including the
image shortcodes/filters that wrap `src/image/`, and `src/schema/` schema.org output. Full catalog:
[filters-and-shortcodes.md](filters-and-shortcodes.md).
