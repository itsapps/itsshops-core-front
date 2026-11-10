# Plan — customer starter: `itsshops init` generates a new project

Status: **Parked** (2026-11-10, owner discussion in the itsapps session; not yet reviewed with
`/itsshops-refine-plan`). Nothing built yet. Resume with `/itsshops-refine-plan customer-starter`,
then step 1.

**Goal:** a new customer project (website or webshop) starts from a clean, feature-trimmed starter
instead of a copy of another customer. The file structure is easy to scan and logical. CSS and JS
start with good, plain defaults. Every part core renders for the chosen features works and is
styled — nothing missing, nothing unused. The customer project stays **free and unopinionated**:
everything the starter writes belongs to the customer and can be changed or deleted; core never
reads it.

**Why:** new customers were copied from siblings (itsapps from Tinhof/fem_innenarchitektur) and
carried leftovers for months. Core's JS toggles states that no core CSS styles (cart `is-open`,
overlay `is-visible`, menu `is-open`), so a project without hand-written CSS has a broken cart and
menu. Core also uses colour roles (`--color-bg/text/error`) it never defines.

When this ships, delete this file. Durable parts go to `workflows/new-customer.md` (rewritten),
`architecture/cli.md` (`init`), `architecture/templates-and-assets.md` (CSS: layers, role
contract, boilerplate, starter layout), the core-front `CHANGELOG.md`, and a decision record (why
the starter is copied into the customer instead of imported from core).

## Decided (owner, 2026-11-10)

- **The starter is copied, not imported.** All default styling (look *and* the CSS core's JS
  needs to work) lands in the customer repo as customer-owned files. Reason: CSS imported from
  core and then overridden ships twice; customer-owned files are edited in place, so nothing is
  unused. No new design CSS in core.
- **Feature-trimmed:** a project gets only the files for its features (no `cart.css` on a content
  site, no user-page CSS without `users`).
- **The CSS mechanism stays** (one entry `global.css`, PostCSS + Tailwind 3, core's per-feature
  importable files). Only small, opt-in simplifications (part B).
- **One CSS file per module** under `blocks/modules/`, named like its template.
- **Colour roles** are the starter's vocabulary; core documents the roles it uses and gets
  fallbacks.
- **Existing customers change nothing** — every core change here is additive or opt-in.

## Part A — the starter (frontend)

Lives in core-front `src/starter/` (shipped as `dist/starter/` via a tsup `onSuccess` copy, like
`src/templates`). Generated tree for a project (★ = only with the named feature):

```
<project>/
  CLAUDE.md                          thin, customer-only (pattern: itsapps/tinhof)
  package.json  eleventy.config.mts  itsshops.config.mts  netlify.toml
  tsconfig.json  vitest.config.ts  .gitignore  .env.example
  netlify/functions/
    preview.mts
    ★checkout: payment_create, payment_webhooks, payment_refund, order_notify,
               order_status, order_withdraw, order_withdraw_notify, order_meta_cleanup
    ★users: user_* wrappers   ★newsletter: newsletter-* wrappers
  src/
    _config/  colors.mts  fonts.mts  text-sizes.mts  extensions.mts  (stdContent projection)
    _includes/overridable/modules/stdContent.njk   the one text module (see below)
    assets/
      css/global/
        global.css                   the entry (short; part B)
        global/  fonts.css  variables.css (spacing, radius, motion + colour roles)  base.css
        blocks/
          header.css  nav.css  footer.css  locale-switcher.css  buttons.css  page.css
          static-page.css  error-page.css  maintenance.css  carousel.css  youtube.css
          ★shop: cart.css  product-card.css  product-list.css  product.css  category.css
                 product-filters.css  order-thanks.css
          ★newsletter: newsletter.css   ★users: user-pages.css   ★gallery: gallery.css
          modules/
            _shared.css              spacing between modules, .module wrapper
            stdContent.css  privacyPolicyModule.css  carousel.css  youtube.css
            ★shop: productList.css  productVariantList.css  categoryList.css
                   withdrawalPolicyModule.css  shippingInfoModule.css
      scripts/index.ts               imports core's scripts + a commented example of a
                                     guarded lazy import for customer code
      fonts/preload/                 empty (+ README line: only above-the-fold fonts)
      images/favicon/                placeholder set
  tests/  setup.ts  utils/sanity.ts  dataset/menu.test.ts  unit/eleventy-run.test.ts
```

Rules for the default CSS:
- **Plain on purpose:** system font stack, neutral palette, readable spacing — works on day one
  and doesn't make every site look alike. The real design starts with the `frontend-design`
  skill.
- **Only roles, never palette names or literal colours** (part B.3), so restyling = palette +
  one mapping.
- **Accessible:** AA contrast for every role pairing that carries text, `:focus-visible` outline
  (the itsapps/jurtschitsch inset dotted pattern), `prefers-reduced-motion` respected, menu/cart
  states keyboard-reachable as core's JS expects.
- **Covers every state core's JS sets**, inventoried from `src/scripts/` (cart `is-open`, overlay
  `is-visible`, menu `is-open`/`hidden`, `is-added`, newsletter backdrop + scroll-lock class,
  filter panel `is-open`, carousel icons) and every class core's templates render that no core
  CSS styles (inventory 2026-11-10: `site-header`, `site-nav`, `site-footer`, `footer-nav`,
  `locale-switcher`, `cart-sidebar`/`cart-overlay`/`cart-item`/`qty-control`/`cart-toggle`,
  `product-card`, `product-list`, `product*`, `category*`, `newsletter-dialog`/`-signup`,
  `static-page`, `page-title`, `error-page`, `maintenance`, `youtube-embed`, `post*`). Each lands
  in the block file of its part.

**The one text module:** core has no generic text module (its page modules are carousel,
youtube, category/product lists and the generated legal ones). The starter ships `stdContent`
(portable text) — schema in the backend starter, projection in `extensions.mts`, template + CSS
in the frontend — so a fresh page can show content. Same shape as itsapps' `stdContent`.

## Part B — CSS simplifications (core-front, opt-in)

1. **Boilerplate into core.** `tailwind/{base,components,utilities}.css` are one `@tailwind …`
   line each and byte-identical in every customer; `utilities/flow.css` + `region.css` are
   identical in tinhof/jurtschitsch/rosi_schuster; `wrapper.css` differs only by its default
   width (a variable). Core ships `dist/utilities.css` (flow, region, wrapper with
   `--wrapper-max-width`). The starter's `global.css` keeps the three `@tailwind` directives
   inline (they must stay in the customer entry — Tailwind processes the entry) and imports the
   utilities from core. Existing customers may switch; their copies keep working.
2. **Cascade layers for core CSS.** The starter imports core files into a layer:
   `@import '@itsapps/itsshops-core-front/dist/core.css' layer(core);` (reset into
   `layer(reset)`, declared first: `@layer reset, core;`). Unlayered customer CSS then always
   wins over core, whatever the import order or specificity (today tinhof/jurtschitsch/rosi
   import `core.css` *after* their globals, so core can win at equal specificity). **Verify
   first:** `postcss-import` 16 supports `layer()`; check that Tailwind 3 (preflight is already
   off — `tailwind.config.ts` `corePlugins.preflight: false`, so `@tailwind base` emits no reset)
   and `postcss-nesting` leave the layer blocks intact and the output order is right, with a
   built test page.
3. **Colour-role contract.**
   - Document in `templates-and-assets.md` the roles core's own CSS uses: today `--color-bg`,
     `--color-text` (`core.css` skip link, `form.css`), `--color-error` (`form.css`). The
     starter's `variables.css` defines a fixed role set: `bg`, `text`, `muted`, `primary`,
     `on-primary`, `surface`, `border`, `error` (itsapps' set — it already carries dark mode and
     bands), mapped from the palette in `src/_config/colors.mts`.
   - **Fallbacks** in core CSS for every role it uses (`var(--color-error, <AA red>)` etc.), so
     core parts render correctly without customer roles.
   - **Build warning** in `src/config/css.ts`: after compiling, list every `var(--color-…)`
     used without a fallback whose custom property is defined nowhere in the output → warn with
     the names. Catches a renamed/removed palette colour (today: no error, the property silently
     falls back to inherited/initial). Note: customer `colors` *replace* core's default palette
     (no merge — `tailwind.config.ts`), so only the customer's names exist.

## Part C — `itsshops init` generates the project (core-front CLI)

Today `init` only writes `netlify.toml`. New:

```
itsshops init [dir] --kind site|shop [--features checkout,users,newsletter,search,gallery,vinofact,age-gate]
              [--name <slug>] [--locales de,en] [--force]
```

- Reads `dist/starter/` + a **manifest** (`src/starter/manifest.ts`): each file → the condition
  it's written under (`always`, `kind: shop`, `feature: checkout`, …), and which lines of
  `global.css`, `itsshops.config.mts` `features`, `.env.example` keys and `package.json` deps a
  feature adds. Template placeholders (`{{name}}`, locales) filled by simple string replacement
  — no template engine dependency.
- Skips existing files unless `--force` (as today); prints the list written and the next steps
  (npm install core as git dep, `npm link`, `.env`, run).
- `netlify.toml`: Rosi Schuster's `!node_modules/…` excludes for the preview function become the
  default (keeps the function small).
- Feature → core CSS imports: `form.css` (shop/users/newsletter), `checkout.css` (checkout),
  `search.css` (search), `lightbox.css` (gallery), `age-gate.css` (age-gate),
  `product-filter-price.css` (shop).

**Backend starter — open question (see below):** the Studio side needs `package.json`,
`sanity.config.ts` (features mirrored from the frontend flags — the backend set is a superset),
`sanity.cli.ts` (dedupe), `src/schema/{index,extensions}.ts` (page modules incl. `stdContent` and
the feature's core modules), `src/schema/objects/stdContent.ts`, `src/structure/index.ts`,
`src/translation/*`, `netlify.toml`, `.env.example`, `CLAUDE.md`.

## Part D — command & docs

- Rewrite `workflows/new-customer.md`: intake → `itsshops init` (frontend + backend) → tokens,
  `.env` → accounts/Sanity/Netlify (owner steps) → first content → checks. Drop the
  copy-a-sibling tables; siblings stay as *design* references only.
- `~/.claude/commands/itsshops-new-customer.md`: map the intake answers to the `init` flags.
- Customer `CLAUDE.md` template in the starter; the module rule there names all four parts
  (schema, projection, template, `blocks/modules/<type>.css`).

## Part E — checks

- **Generator test** (vitest in core-front): `init` into a temp dir for `--kind site` and
  `--kind shop --features checkout,newsletter,search` → assert the file list per manifest, no
  shop files on a site, every `@import` target exists.
- **Class drift test:** every class selector in `src/starter/**/*.css` must occur in core's
  `src/templates/`, `src/scripts/` or the starter's own templates — fails when core renames a
  class the starter styles.
- **Build smoke:** a generated site and shop build against a real dataset (`npm link` core) — see
  open question 2. Then Lighthouse accessibility on home, a text page, 404, and for the shop
  product list, product page, cart open, checkout.

## Steps

1. Part B.2 spike: verify cascade layers through the PostCSS/Tailwind 3 pipeline (decides
   whether the starter uses `layer()`).
2. Part B.1 + B.3 in core-front (utilities file, fallbacks, role docs, build warning) + tests.
3. Part A starter files (frontend) + the manifest; class drift test.
4. Part C `init` + generator test.
5. Backend starter (per open question 1).
6. Build smoke + a11y for a generated site and shop.
7. Part D docs + command; `/itsshops-update-docs`; CHANGELOG (minor: new CLI behaviour + opt-in
   CSS; no customer must change anything).
8. Optional, separate: split itsapps' 899-line `blocks/modules.css` into `blocks/modules/*.css`.

## Open questions

1. **Backend starter delivery:** core-back has no CLI. (a) core-front's `itsshops init --backend
   <dir>` also writes the Studio from templates in core-front, or (b) core-back ships
   `starter/` + a tiny bin, or (c) core-back ships `starter/` and the command copies it.
   Recommendation: (b) — the Studio files belong with core-back's knowledge and versions; one
   shared manifest format.
2. **Dataset for the build smoke:** a dedicated `starter` dataset (e.g. in the itsapps Sanity
   project) seeded with demo pages, menus, settings and a few products, so generated site and
   shop render real content. Recommendation: yes — also usable as a demo for new customers.
3. **Gallery/lightbox block CSS:** customers style embla themselves (`blocks/embla-gallery.css`
   at jurtschitsch) on top of core's `lightbox.css` — check during step 3 whether core's file
   already makes the gallery usable or the starter needs `gallery.css`.
