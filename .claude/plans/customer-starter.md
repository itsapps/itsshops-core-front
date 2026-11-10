# Plan — new customer projects: UI contracts, core CSS split, starter repo with variants

Status: **Planned** (2026-11-10, owner discussion in the itsapps session; refined once, then
reworked the same day from "one starter + `itsshops init` generator" to "starter repo with a
variant library, assembled by the command"). Nothing built yet. Parts A + B verified against the
code 2026-11-10; parts C–E refined once the same day (wrappers, default header/footer, itsapps
modules, intake limits checked; A.3 added from it). A.3 refined 2026-11-10 against `menu.ts`,
core's `header.njk`/`footer.njk` in full and every active customer header (resize fix made
concrete and widened to the itsapps/rosi_schuster overlay bug; four header/footer a11y fixes
added). Open question 7 decided the same day (two datasets; owner created `development-shop`).

**Goal:** `/itsshops-new-customer` asks the owner a few basic questions (site or shop, features,
which header/menu/cart/footer style, layout, modules) and assembles a working project from
**tested parts** — clean, easy-to-scan structure, plain good defaults, every part core renders for
the chosen features working and styled, nothing unused. The customer project stays **free**:
everything copied in belongs to the customer; core never reads it.

**Why:** new customers were copied from siblings (itsapps from Tinhof/fem_innenarchitektur) and
carried leftovers for months. Core's JS toggles states no core CSS styles (cart `is-open`,
overlay `is-visible`, menu `is-open`), core's default header renders submenu buttons no script
opens, `core.css` ships shop CSS to content sites, and the markup/JS contract each part must keep
is written down nowhere — every customer re-derived it from the code.

When this ships, delete this file. Durable parts go to the new `architecture/ui-contracts.md`,
`architecture/templates-and-assets.md` (CSS split, layers, role contract), the starter repo's own
`CLAUDE.md`, `workflows/new-customer.md` (rewritten), the core-front `CHANGELOG.md`, and decision
records (why the starter is copied, not imported; why variants live outside core).

## Decided (owner, 2026-11-10)

- **Three layers, each in one place:**
  1. **Contracts in core** (part A): per UI part, the hooks, states and a11y behaviour core's
     JS relies on. Core owns them because core's JS defines them.
  2. **Core CSS, split by feature** (part B); `core.css` is deleted.
  3. **A separate starter repo `itsshops-starter`** (part C) with a base skeleton, a **variant
     library** per part, feature and module packages, and a manifest. Core repos carry no
     starter files.
- **The command assembles** (part D): intake → copy base + chosen variants + features + modules
  per the manifest → fill tokens → checks. **No generator script** (`itsshops init` keeps doing
  only `netlify.toml`); add one later on top of the same manifest only if manual assembly proves
  error-prone.
- **Wishes outside the library** are built by Claude **from the part's contract**; a variant that
  proves itself in a project may be added back to the library.
- **Copied, not imported:** default styling (look and the CSS the JS states need) lands in the
  customer repo as customer-owned files, so nothing ships twice and nothing is unused.
- **One CSS file per module** under `blocks/modules/`, named like its template.
- **Colour roles** are the starter's vocabulary; core documents the roles it uses and gets
  fallbacks.
- **`core.css` removed** (B.4): the four active customers (tinhof, jurtschitsch, rosi_schuster,
  itsapps) switch imports in the same release → core-front **major** (3.x → 4.0.0). Dormant
  customers (fem_innenarchitektur, grass-art, yogamax, …) pin old tags; not edited (global
  rule) — they follow the CHANGELOG "Upgrading" note when work resumes.
- Everything else in core is additive or opt-in.

## Part A — UI contracts (core-front)

New doc `.claude/architecture/ui-contracts.md` (+ routing row in `CLAUDE.md`). One section per
part core's JS drives, each with: **required markup hooks**, **states the JS sets**, **what the
CSS must do with them**, **a11y the markup must provide** (the JS supplies the rest). Verified
against `src/scripts/` 2026-11-10:

- **Menu** (`menu.ts`, every `[data-menu-toggle]` button): target = `data-menu-toggle` value or
  `aria-controls` id. Open: removes `hidden` (only if the target started `hidden`), adds
  `is-open`, `aria-hidden="false"`, removes `inert`, `aria-expanded="true"` on the button,
  inerts the rest of the page (`lockInertOutside([el, btn])`, **not** `deep` — so only
  `<body>` children that contain neither the target nor the button; in core's default header,
  where button and `#site-nav` share `<header>`, the logo and actions stay reachable — the
  starter's overlay CSS must leave them visible, not cover them), focuses the first focusable.
  Close (button, `[data-menu-close]` inside, Escape): the reverse, `data-closing` on the button
  for 300 ms (for a closing animation; tinhof/rosi style the burger with it), focus back to the
  button. After A.3 also: when the button stops being rendered (resize), the menu closes without
  moving focus and the target gets its initial `hidden`/`inert`/`aria-hidden` back. CSS:
  show/hide/animate on `.is-open`; a target that is visible inline on large screens must **not**
  start `hidden` or `inert` there.
- **Submenus:** core's default header renders `.site-nav__submenu-toggle` /
  `.site-nav__trigger` buttons with `aria-expanded` + `aria-controls` — **no core script handles
  them** (no customer script does either: jurtschitsch's `src/assets/scripts/nav.ts` only syncs
  header state, `[data-nav-close]` and hover previews; its menu has no submenu buttons). That's a bug in core's
  default markup (a control that does nothing). Fix in core (A.2).
- **Cart** (`cart-ui.ts`): `#cart-sidebar` containing `[data-cart-items]`, `[data-cart-total]`,
  `[data-cart-empty]`, `[data-cart-close]`; any number of `[data-cart-toggle]` buttons
  (`aria-expanded` kept in sync) and `[data-cart-count]` elements (text set to the count;
  with `data-cart-count-hide` also `display: none` at 0 — tinhof); optional `[data-cart-overlay]`.
  The sidebar is rendered only with `shop.checkout` (`layouts/base.njk:34`), so a toggle must be too.
  States: `.cart-sidebar.is-open`, overlay `.is-visible`, `[data-cart-empty]` `hidden`, Escape
  closes. Lines come from the `cartItem` macro template (`[data-cart-item]`,
  `[data-qty-decrease|value|increase]`, `[data-cart-remove]`). Add to cart:
  `[data-add-to-cart]` inside `[data-product-actions]` or `.product-card__actions`, with an
  optional `[data-qty-control]`; the button gets `.is-added` briefly. **No cart page exists in
  core** — the sidebar is the only cart UI.
- **Newsletter dialog** (`newsletter-dialog.ts`): `[data-newsletter-dialog]` containing
  `[data-newsletter-open]`, a `<dialog>`, `[data-newsletter-backdrop]` (toggled `hidden`),
  `[data-newsletter-subscribe]`, `[data-newsletter-close]`; sets `html.newsletter-dialog-open`
  while open — **no core CSS styles it**, the customer CSS must lock scroll.
- **Product filter panel:** already documented in `templates-and-assets.md` → "Product filter
  panel" — move/link it here (`is-open`, modal opt-in, `html.has-filter-panel-open`,
  `[data-product-list][data-view]`).
- **Carousel, gallery, lightbox, search, age gate, checkout:** hooks listed (`[data-carousel]`,
  `[data-gallery]`, `[data-gallery-open]`, `[data-search]`, …); their states are styled by core
  CSS already — note which file.
- **Global rule for all parts:** core shows/hides almost everything with the `hidden` attribute,
  and any author `display` rule beats the UA's `[hidden]` style; core patches this only per
  component. Customer base CSS must set `[hidden] { display: none !important; }`.

**A.2 — submenu disclosure in core** (core-front, `src/scripts/menu.ts` or a new
`submenu.ts` wired in `src/scripts/index.ts` with a DOM guard): any button with
`aria-expanded` + `aria-controls` inside `.site-nav` (better: a hook `[data-submenu-toggle]`,
added to core's default header) toggles its list (`hidden` + `aria-expanded`), Escape closes the
open one and returns focus, opening one closes its siblings. Justified for core: core's own
default header renders these buttons. No customer header renders `.site-nav__submenu-toggle` /
`.site-nav__trigger` or the new hook (checked 2026-11-10: tinhof, jurtschitsch, rosi_schuster,
itsapps), so nothing else binds them. Unit test (jsdom, like the other script tests).

**A.3 — fixes in `menu.ts` and core's default header/footer** (found in the refine rounds
2026-11-10; the starter's `inline` header and both footer variants use core's default markup,
see part C, so these must be right). `overridable/header.njk` and `footer.njk` read in full,
plus every active customer header with `[data-menu-toggle]`:
- **Menu state survives a resize (`menu.ts`)** — two failures, one fix:
  - *Core default header:* one `#site-nav` is both the inline desktop menu and the mobile
    overlay. `close()` sets `aria-hidden="true"` + `inert` on it for good; open → close on a
    phone, then widen the window (or rotate a tablet) and the desktop menu is unreachable for
    keyboard and screen readers.
  - *itsapps and rosi_schuster today:* their burger is `display: none` from `sm` / `tablet`, the
    overlay (`.site-nav-overlay`, starts `aria-hidden` + `inert`) is shown by opacity only. Open
    it on a phone, widen past the breakpoint → the overlay stays open over the page, the rest of
    the page stays inert (lock never released) and no visible control closes it (only Escape).
    tinhof (burger at every size) and jurtschitsch (overlay starts `hidden`, `display: none`;
    burger hidden only on the home page from `md`) are affected only marginally or not at all.
  - **Fix:** at init record the target's initial `hidden`, `inert` and `aria-hidden`
    (`startsHidden` exists; add `startsInert`, `startsAriaHidden`). Give `close` a parameter
    `close({ focus = true } = {})`; only focus the button when `focus`. Add
    `const isRendered = () => btn.getClientRects().length > 0` (**not** `offsetParent`: it is
    `null` for a `position: fixed` button, which a sticky header's burger may be) and one
    `window.addEventListener('resize', …)` per toggle, as in `product-filter.ts:292`: when
    `!isRendered()` → if open, `close({ focus: false })`; then restore the three initial
    attributes on the target (set or remove each to match its start value). So core's default
    `#site-nav` (starts with none) becomes reachable inline again; overlays that start
    `inert`/`aria-hidden`/`hidden` keep them. No breakpoint attribute — the button's own CSS
    visibility is the single source. Behaviour while the button is rendered is unchanged.
  - **Tests** `src/scripts/__tests__/menu.test.ts` (`// @vitest-environment jsdom`; jsdom has no
    layout, so stub `btn.getClientRects` to return `[]` / one rect, then
    `window.dispatchEvent(new Event('resize'))`): (1) core-default target (no initial attrs):
    open → close → hide button → resize → no `inert`/`aria-hidden`; (2) overlay starting
    `inert aria-hidden`: open → hide button → resize → `is-open` gone, `aria-expanded="false"`,
    target `inert` + `aria-hidden="true"`, body siblings no longer inert, focus not moved to the
    button; (3) target starting `hidden` gets `hidden` back; (4) resize while button rendered:
    no change.
  - No customer change needed; itsapps + rosi_schuster get the fix with the 4.0 pin.
- **Burger without a menu:** the default header renders the `[data-menu-toggle]` button
  unconditionally but `#site-nav` only `{% if _settings and _settings.mainMenus.length %}` →
  a dead button (`menu.ts` finds no target and returns). Move the button inside the same `if`.
- **Logo name (WCAG 2.5.3 Label in Name, level A):** the logo link shows `siteTitle` but has
  `aria-label="{{ 'navigation.ariaGoHome' | trans }}"` ("Zur Startseite"), so the accessible
  name doesn't contain the visible text (voice control "click <site title>" fails). Drop the
  `aria-label` — the visible title is the name (tinhof and itsapps use the site title as label).
- **`aria-current` missing:** `linkActiveState` is applied to the header's top-level internal
  links and to `system` links, but not to internal sub-links (`site-nav__sublink`, both
  branches) nor to the footer's internal links. Add `{{ child.internal._id | pageUrl |
  linkActiveState | safe }}` / `{{ item.internal._id | pageUrl | linkActiveState | safe }}`
  there.
- **Untranslated footer label:** `overridable/footer.njk:8` has `aria-label="Footer navigation"`
  hard-coded (English on a German site). New key `navigation.footerMenu` in
  `src/i18n/translations/de_11ty.ts` ("Fußzeilenmenü") and `en_11ty.ts` ("Footer menu"), next to
  `mainMenu`; no entry in `de_11ty.informal.ts` (it holds only keys whose text differs).
- **Cart button as a partial** `overridable/partials/cart-toggle.njk` (included from the default
  header like `overridable/partials/product-filters.njk` is from core components), with three
  fixes in it:
  - rendered only `{% if coreConfig.features.shop.checkout and page.url !=
    cms[_locale].checkoutUrl %}` — today the header checks `shop.enabled`, but the sidebar exists
    only with `shop.checkout`, so a catalog-only shop gets a button controlling nothing; on the
    checkout page tinhof and jurtschitsch already hide it.
  - the count reaches screen readers: today `aria-label="Zum Warenkorb"` replaces the content
    and the count is `aria-hidden`, so the number is never announced. New markup, no
    `aria-label`: `<span class="sr-only">{{ 'navigation.ariaOpenCart' | trans }}, </span>`
    `<span class="cart-toggle__count" data-cart-count>0</span>` (name: "Zum Warenkorb, 2").
  - classes `cart-toggle`, `cart-toggle__count` and the hooks (`data-cart-toggle`,
    `aria-expanded="false"`, `aria-controls="cart-sidebar"`) unchanged.
  Additive for customers with their own header (all four active ones).

## Part B — core CSS (core-front)

1. **Boilerplate into core.** `tailwind/{base,components,utilities}.css` are one `@tailwind …`
   line each and byte-identical in every customer; `utilities/flow.css` + `region.css` are
   identical in tinhof/jurtschitsch/rosi_schuster; `wrapper.css` differs only by its default
   width (a variable). Core ships `src/assets/css/utilities.css` → `dist/utilities.css` (flow,
   region, wrapper with `--wrapper-max-width`; `copySync` line in `tsup.config.ts` `onSuccess`,
   row in the "Importable core CSS files" table). Customer entries keep the three `@tailwind`
   directives inline — they must be in the entry, and `@tailwind components` is also where
   core's Tailwind plugin emits the palette/space/size/font custom properties
   (`addComponents({':root': …})` in `tailwind.config.ts`), so without it no `--color-*` exists.
   Customers `@apply wrapper` (15×), `flow`, `region` today — keeps working, `@apply` resolves
   classes from any imported file.
2. **Cascade layers for core CSS.** Starter entries import core files into a layer:
   `@layer reset, core;` then `@import '…/dist/reset.css' layer(reset);`,
   `@import '…/dist/base.css' layer(core);` (and `carousel`/`shop`/`form`/`checkout`/…
   likewise). Unlayered customer CSS then always wins over core, whatever the import order or
   specificity (today tinhof/jurtschitsch/rosi import `core.css` *after* their globals).
   **Spike (2026-11-10, postcss-import 16 + tailwindcss 3.4, scratch test):** `layer()` imports
   pass through Tailwind intact; plain customer rules stay unlayered; relative `@import`s inside a
   package file resolve and inherit the layer. **Gotcha:** a customer rule that `@apply`s a class
   defined inside a layered file is emitted *inside that layer* (`.page2 { @apply wrapper }` →
   `@layer core { .page2 {…} }`) and silently loses to every unlayered rule. Hence
   `utilities.css` is imported **unlayered**, and starter CSS never `@apply`s a class from a
   layered core file (one customer `@apply btn` from `form.css` today — the starter defines its
   own button). Step 1 re-checks through the real pipeline (`src/config/css.ts`: ext-glob →
   import → custom-media → nesting → tailwind nesting → tailwind → nesting → autoprefixer,
   optional cssnano — cssnano must keep the `@layer` order statement).
3. **Colour-role contract.**
   - Document in `templates-and-assets.md` the roles core's CSS uses: `--color-bg`,
     `--color-text` (skip link — `base.css` after B.4 —, `form.css`), `--color-error`
     (`form.css`). The starter's `variables.css` defines a fixed role set: `bg`, `text`,
     `muted`, `primary`, `on-primary`, `surface`, `border`, `error` (itsapps' set — it already
     carries dark mode and bands), mapped from the palette in `src/_config/colors.mts`.
   - **Fallbacks** in core CSS for every role it uses (`var(--color-error, <AA red>)` etc.).
   - **Build warning** in `src/config/css.ts`, after `postcss(plugins).process()` (before the
     write to `_includes/css/global.css`): collect every `--color-*` *defined* in `result.css`
     and every `var(--color-x)` *used without a fallback*; warn once per build with the undefined
     names (`console.warn`, no failure — a template may define a property inline). Unit test with
     a small CSS string. Catches a renamed/removed palette colour (today: silent fallback to
     inherited/initial). Customer `colors` *replace* core's default palette (no merge —
     `tailwind.config.ts`), so only the customer's names exist.
4. **Split `core.css` by feature, then delete it.** Today `core.css` (172 lines) is imported by
   every customer, ~110 lines of it shop-only:

   | Section in `core.css` today | Needed by | Moves to |
   |---|---|---|
   | skip link (`layouts/base.njk`) | every site | `base.css` |
   | `.privacy-policy` spacing (shares selector lists with the two shop modules — split them) | every site | `base.css` |
   | carousel pause button (`core/modules/carousel.njk`) | sites with the carousel module | `carousel.css` |
   | cart close/remove icon | shop | `shop.css` |
   | `html.has-filter-panel-open` | shop | `shop.css` |
   | `.legal-guarantee-notice` (shipping module, checkout) | shop | `shop.css` |
   | `.withdrawal-instructions`, `.shipping-info*` | shop | `shop.css` |
   | `.legal-guarantee-compact*` (only `core/components/checkout.njk`) | checkout | `checkout.css` |

   - New `src/assets/css/{base,carousel,shop}.css`, one `copySync` each; **delete**
     `src/assets/css/core.css` and its `copySync` line (`tsup.config.ts:46`).
   - **Customer switch, in the same release as the core pin** (an import of the deleted file
     fails with "Failed to find"). Replace the one `core.css` line in
     `src/assets/css/global/global.css`, same position:

     | Customer | Replace `dist/core.css` with |
     |---|---|
     | itsapps (content site; `carousel` in `page.modules`) | `base.css`, `carousel.css` |
     | tinhof | `base.css`, `carousel.css`, `shop.css` |
     | jurtschitsch | `base.css`, `shop.css` (+ `carousel.css` if its backend `page.modules` lists `carousel` — check) |
     | rosi_schuster | `base.css`, `carousel.css`, `shop.css` (catalog without checkout still renders the shop modules) |

     Check each against its backend's `page.modules` before writing it.
   - Import each core file once — postcss-import deduplicates only identical imports, so the
     same file imported in two layers (or with and without one) ships twice.
   - `form`, `checkout`, `search`, `lightbox`, `age-gate`, `product-filter-price.css` are
     already per feature — unchanged.
   - Docs naming `core.css` that must change: `templates-and-assets.md` (table, the
     `global.css` example, the `dist/` path explanation — use `base.css`),
     `decisions/css-shipped-via-dist-no-exports.md` (example paths), `workflows/new-customer.md`.

## Part C — the starter repo `itsshops-starter`

New repo `~/Documents/programming/jamstack/itsshops-starter` (GitHub `itsapps/itsshops-starter`,
**private** — owner, 2026-11-10; own GitHub user, `main`, like core). The command always reads
the local checkout; nothing installs the starter as a dependency, so private needs no token
anywhere except a fresh clone on another machine. It is a **parts library**, not a
runnable project by itself:

```
itsshops-starter/
  CLAUDE.md                      how the library works, rules for adding a variant
  manifest.json                  every package: id, kind, needs (features), files → target
                                 paths, inserts (see below), intake label + ASCII preview
  base/                          always copied
    frontend/   package.json  eleventy.config.mts  itsshops.config.mts  netlify.toml
                tsconfig.json  vitest.config.ts  .gitignore  .env-sample  CLAUDE.md
                netlify/functions/preview.mts
                src/_config/{colors,fonts,text-sizes,extensions}.mts
                src/assets/css/global/global.css + global/{fonts,variables,base}.css
                src/assets/css/global/blocks/{page,buttons,locale-switcher,error-page,maintenance}.css
                src/assets/css/global/blocks/modules/_shared.css
                src/assets/scripts/index.ts   (imports core's scripts + a commented guarded
                                               lazy-import example)
                src/assets/images/favicon/*   (names core's head links: favicon.ico,
                                               favicon.svg, favicon-96x96.png,
                                               apple-touch-icon.png,
                                               web-app-manifest-192x192.png, -512x512.png)
                src/assets/fonts/preload/     (empty)
                tests/ setup.ts utils/sanity.ts dataset/menu.test.ts unit/eleventy-run.test.ts
    backend/    package.json  sanity.config.ts  sanity.cli.ts (dedupe)  netlify.toml
                .env-sample  .gitignore  tsconfig.json  vitest.config.ts  CLAUDE.md
                src/schema/{index,extensions}.ts  src/structure/index.ts
                src/translation/{index,de,en}.ts  src/assets/icons.ts
  variants/                        a variant = CSS, plus a template override only where needed
    header/inline/       blocks/header.css + blocks/nav.css (core's default markup)
    cart-button/count/   blocks/cart-toggle.css
    cart-button/text-count/  overridable/partials/cart-toggle.njk + blocks/cart-toggle.css
    footer/simple/       blocks/footer.css
    footer/columns/      blocks/footer.css
  features/
    shop/  checkout/  category/  blog/  users/  newsletter/  search/  age-gate/  gallery/  dark/
                       each: function wrappers, block CSS, page templates' CSS, core CSS
                       imports, config + .env-sample inserts, backend feature flags
  modules/
    <type>/            backend schema object(s) + frontend projection snippet + template
                       + blocks/modules/<type>.css + de/en labels
```

**Inserts** (how packages extend shared files without a generator): base files carry marker
comments, e.g. `/* starter:core-imports */` in `global.css`, `// starter:features` in
`itsshops.config.mts` and the backend `sanity.config.ts`, `// starter:page-modules` in
`schema/extensions.ts`, `// starter:schema-objects` in `schema/index.ts`,
`// starter:module-projections` in `extensions.mts`, `# starter:env` in both `.env-sample`s.
Each package's manifest entry lists the lines it inserts at which marker; the command inserts
them and removes the markers at the end. **Block and module CSS need no inserts:** the base
`global.css` globs `blocks/*.css` and `blocks/modules/*.css` (`@import-glob`, as every customer
entry does today), so a package's CSS file is picked up by being copied.

**Variant library v1** — verified 2026-11-10: core's default `overridable/header.njk` already
is the "inline" header (logo, `#site-nav` with submenu buttons, burger toggle, actions with
locale switcher + count-only cart toggle) and core's default `overridable/footer.njk` renders
one group per footer menu + company block. So v1 variants are **CSS on core's default markup**
(no template override → the customer gets core's markup fixes for free), except where noted:

| Part | Variants v1 | Implementation |
|---|---|---|
| Header + menu | `inline` only (owner, 2026-11-10): one row on wide screens, dropdown submenus (A.2), burger + overlay of the same `#site-nav` below the breakpoint (A.3 resize fix). Later candidates: `two-row` (itsapps), burger on every size, centred logo | `blocks/header.css` + `blocks/nav.css`, no override. Mobile hiding via `display`/`visibility`, never off-screen transform alone (keeps it out of the a11y tree before the first toggle) |
| Cart button | `count` (core default after A.3: count badge + sr-only label, like tinhof) · `text-count` ("Warenkorb 2", like jurtschitsch: visible text `aria-hidden` + sr-only text with `aria-live` count) | `count`: CSS only; `text-count`: overrides `partials/cart-toggle.njk` (A.3) |
| Footer | `simple` (groups in a row, company below) · `columns` (groups + company as columns) | CSS only on core's footer |
| Cart | sidebar only (core has no cart page; a page is out of scope — open question 5) | `blocks/cart.css` (feature `shop`) |

**Layout** is intake values, not variants: content width (`--wrapper-max-width`), text measure,
section spacing → written into `variables.css`.

**Modules v1:** `stdContent` (text), `hero`, `teaser` (image + text), `faq` — plus the core
modules a feature brings (`carousel`, `youtube`, `privacyPolicyModule` always; shop:
`productList`, `productVariantList`, `withdrawalPolicyModule`, `shippingInfoModule`;
`shop.category`: `categoryList` — core-back gates them by `feature:` in
`src/schemas/modules/*.ts`; the module package only adds the CSS file). Sources: itsapps (`hero`,
`teaser`, `faq`), Rosi Schuster / itsapps `stdContent` (`stdContent.ts` byte-identical there;
needs `standardContent.ts`, `builders.ts` `standardBlock`, icons, `localizedFieldTypes:
['standardContent']`; frontend projection `p.i18nStandardContentField('text')`, template
`<div class="std-content">{{ module.text | portableText | safe }}</div>`). Taken over as
**plain** versions — the source customers' looks (itsapps "Poster" etc.) stay with them.
Concretely (itsapps schemas checked 2026-11-10): `hero` = `headline` (`i18nText`), `subline`
(`i18nText`), `image` (`localeAltImage`) — **drop** `illustration` (itsapps' own drawings,
`illustrations.ts`); `teaser` = `eyebrow`, `headline`, `text` (`i18nStandardContent`), `image`,
`layout` — drop `illustration`, keep `video` optional only if its template part (native
`<video controls>`, poster = image, `aria-label` from the alt) comes along, else drop; `faq` =
`headline` + `items[]` (`question`, `answer`), native `<details>`, as is. Templates rewritten
without itsapps' bands/`theme`, illustration and reveal markup; each module's icon from the
backend `src/assets/icons.ts` (itsapps' `HeroIcon`, `TeaserIcon`, `FaqIcon`,
`StandardContentIcon`).

**Feature packages** — function wrappers with file names and `config.path` matching core's
fixed `/api/…` routes (`commerce-and-netlify.md`). Verified 2026-11-10:
- **checkout** — copy jurtschitsch's set (identical names in tinhof): `payment_create`
  (`/api/payment/create`), `payment_webhooks` (`/api/payment/webhooks`), `payment_refund`
  (`/api/payment/refund`), `order_notify` (`/api/order/notify`), `order_status`
  (`/api/order/status`, `rateLimit`), `order_withdraw` (`/api/order/withdraw`, `rateLimit`),
  `order_withdraw_notify` (`/api/order/withdraw-notify`), `order_meta_cleanup`
  (`schedule: '@daily'`).
- **newsletter** — jurtschitsch's `newsletter-subscribe|confirm|unsubscribe`
  (`/api/newsletter/<name>`); with `captcha: false` take rosi_schuster's subscribe wrapper
  (`rateLimit`, `captcha: false` passed to the handler).
- **users** — **no active customer wires them on current core** (rosi_schuster removed its
  user wrappers; the old `jurtschitsch/jurtschitsch_frontend` is a legacy checkout). Paths from
  core's client code (`src/shared/user-api.ts`): `user-register|login|confirm|recover|reset` →
  `/api/user/<name>`; `user-logout` has no caller in core's scripts/templates — check before
  adding it; `supabase-keep-alive` (scheduled; its doc comment suggests
  `schedule: '0 9 * * 1,4'`). Mark the users package **untested** in the manifest until a real
  project uses it.
- Not in the library: `wc-api` (Winenet only), `auth-webhooks` (removed at rosi_schuster). Scheduled
functions run only on the production deploy (not `staging` branch deploys) — the feature
package's `CLAUDE.md` snippet says so. Core CSS per feature: `base` + `carousel` always, `shop`
(shop), `form` (shop, users, newsletter), `checkout` (checkout), `search`, `lightbox` (gallery),
`age-gate`, `product-filter-price` (shop). Non-feature switches: search → `search: {…}` stub
(shop only), age gate → `ageGate: { enabled: true }`, gallery → `lightbox.css`, dark →
`manifest.colorScheme: 'light dark'` + a dark role block (system preference; the theme toggle
stays itsapps-only until a second customer needs it).

**Default CSS rules (all packages):** plain on purpose (system font stack, neutral palette);
only colour roles, never palette names or literal colours; AA contrast for every role pairing
that carries text; `:focus-visible` inset dotted outline (itsapps/jurtschitsch pattern);
motion only under `prefers-reduced-motion: no-preference`; every state from the part's contract
styled; base CSS has the `[hidden]` rule. Files: `.env-sample` (not `.env.example` — the
customers' `.gitignore` ignores `.env*` except `!.env-sample`).

## Part D — the command `/itsshops-new-customer`

Rewrite `~/.claude/commands/itsshops-new-customer.md` and `workflows/new-customer.md`:

1. **Intake**, with `AskUserQuestion` — limits: 1–4 questions per call, **2–4 options per
   question** (an "Other" free-text option is added automatically), previews only on
   single-select questions. So a long feature list is split into several multi-select
   questions, and **a part with only one variant is not asked** (v1: the header). Rounds:
   - Round 1 — basics: kind (site / shop); locales (de / de + en / other); form of address
     (Sie / Du); extras, multi-select (newsletter, users, blog, dark mode).
   - Round 2 — only for a shop: shop features, multi-select (checkout, category, coupons,
     vinofact); more shop, multi-select (stock, manufacturer, search, age gate).
   - Round 3 — look: footer (`simple` / `columns`, with previews); cart button (`count` /
     `text-count`, shop only); content width (narrow / medium / wide → `--wrapper-max-width`).
   - Round 4 — content: modules, multi-select (stdContent, hero, teaser, faq); gallery
     (yes / no).
   - Names (folder, repo, domain, company) as free text in the plan step.
   The manifest carries each question's label and each option's description/preview, so
   adding a variant later needs no command change.
2. **Plan + go-ahead:** the package list resolved from the manifest (with `needs` checked,
   e.g. a package requiring `shop`), paths, owner steps.
3. **Assemble:** copy `base/` → `web/<customer>/<…>-frontend|backend`, then each package's
   files; apply the inserts; remove the markers; set name/locales/tokens.
4. **Wishes outside the library:** build from `ui-contracts.md` for that part, same CSS rules;
   note in the customer `CLAUDE.md` that it isn't a library variant.
5. **Design pass:** `frontend-design` skill for palette/fonts/details on top of the plain
   defaults.
6. Accounts, Sanity, Netlify, first content, remotes, first staging deploy — as in today's
   `new-customer.md` sections 1, 4, 6, 7 (kept).
7. **Checks** (below) and the "Done when" list.

## Part E — checks

- **In the starter repo** (vitest; the repo's own `package.json` has
  `@itsapps/itsshops-core-front` as a devDependency — git dep, `npm link` while core's 4.0
  branch is unreleased): manifest integrity (every file exists, every insert marker exists in
  base, `needs` names real features, every intake option points to a package); **contract
  test** — every template the library ships (v1: `cart-toggle` partial, module templates)
  contains its part's required hooks (`[data-cart-toggle]` with `aria-controls` +
  `aria-expanded`, `[data-cart-count]`, …); **drift test** — every class selector in the
  library's CSS occurs in core's `dist/templates/**/*.njk`, `dist/scripts/**` or the library's
  own templates.
- **Assembly smoke** (starter repo script, run before a library release and by the command at
  the end): assemble a content site (all modules, each footer variant once) and a shop
  (checkout, newsletter, search; no vinofact) into a scratch dir, `npm link` core, build
  against its demo dataset — content site → `development`, shop → `development-shop` (open
  questions 2, 7; `SANITY_DATASET` set per build) — also checks every package's inserts land.
- **Demo content:** create it once per dataset in the assembled Studio (content-site Studio →
  `development`, shop Studio → `development-shop`), then `npx sanity dataset export` per
  dataset → `seed/development.tar.gz` + `seed/development-shop.tar.gz` in the starter repo (commands:
  core-back `workflows/datasets.md`); restore with `dataset import`. Simpler and more robust
  than a seed script: core-back's product/variant/tax/shipping documents are many and
  linked, and an export carries them as they are. Contents — both datasets: home + text pages
  using each v1 module, main + footer menus, settings (company name/address/email, home +
  privacy page); `development-shop` also: shop settings, a tax category/country, two shipping
  methods, a few products with variants, two categories, the withdrawal/shipping pages.
- **Per new project:** `npm run build`, `npm test`, Lighthouse accessibility on every page type
  (go-live checklist → "Tests"), cart/menu by keyboard.

## Steps

1. B.2 spike through the real pipeline (decides whether starter entries use `layer()`).
2. Core-front on `feature/customer-starter`: A (contracts doc), A.2 (submenu disclosure),
   A.3 (menu resize fix, burger/logo/`aria-current` fixes, footer label, cart-toggle partial),
   B.1–B.4 + tests.
3. Switch the four active customers (B.4 table) against the linked core: diff each one's
   compiled `src/_includes/css/global.css` before/after — same rules, only the former
   `core.css` sections moved (itsapps: minus the shop section and the compact warranty notice).
   Commit each on `main` with the core pin at release (step 9).
4. ~~Refine parts C–E~~ — done 2026-11-10 (one round; see Status).
5. Starter repo: base, manifest, inserts; feature packages; modules v1; demo content + export
   (needs the owner's Sanity project, dataset and tokens).
6. Variant library v1, each against its contract.
7. Starter checks (manifest, contract, drift) + assembly smoke.
8. Part D: command + `new-customer.md`; `/itsshops-update-docs` (core-front, starter).
9. Release: CHANGELOG core-front **4.0.0** — "Upgrading": replace `dist/core.css` with
   `base.css` + `carousel.css` (if the carousel module is used) + `shop.css` (shops); compact
   warranty notice now in `checkout.css`. "Added": submenu disclosure, `partials/cart-toggle.njk`,
   `utilities.css`, role fallbacks, the `--color-*` build warning. "Fixed": menu state after a
   resize (default menu stayed inert; an overlay whose burger disappears stayed open with the
   page inert — itsapps, rosi_schuster); default header: no burger without a main menu, logo
   name = visible title, cart button only with checkout + count announced, `aria-current` on
   sub-links and footer links; translated footer-menu label. "Changed" (default header only):
   cart toggle markup (no `aria-label`, sr-only label) — customers styling `.cart-toggle`
   from core's markup check it. Push core before any customer
   pins it; the four customers pin it with their step-3 change (`release <customer>` flow).
   Starter repo: tag `1.0.0`, its `CLAUDE.md` names the core major it fits.
10. Optional, separate: split itsapps' 899-line `blocks/modules.css` into
    `blocks/modules/*.css`.

## Open questions

1. ~~Backend starter location~~ — resolved by the starter repo (frontend + backend in one).
2. ~~Dataset for the assembly smoke~~ — decided (owner, 2026-11-10): a **new Sanity project in
   the itsapps account** with a dataset **`development`** (owner creates both). Demo content
   only, no personal data → public dataset, Free plan is fine. Needs: project id + a read token
   for the smoke builds and an Editor token (or the owner in the Studio) to seed it, both in the
   starter repo's gitignored `.env`. Content: created once in the Studio, kept as a dataset
   export in the starter repo (part E → "Demo content"). Second dataset `development-shop`: question 7.
   The smoke shop runs **without vinofact** (its build
   fetches the live API and fails without credentials — `decisions/vinofact-failure-fails-build.md`).
3. ~~Gallery CSS~~ — resolved: the inline product gallery (`overridable/gallery/*`, embla) has
   no core CSS → `features/gallery` ships it (jurtschitsch's `embla-gallery.css` as reference);
   core's `lightbox.css` covers only the lightbox dialog.
4. ~~`stdContent` in core?~~ — decided (owner, 2026-11-10): **stays customer-owned, no move
   to core.** The module shell is shared, but what editors may do in the text is a per-customer
   choice: Tinhof adds AI translate + system-page links, itsapps blockquotes, Rosi Schuster
   drops blockquotes and h1, Jurtschitsch has its own `richContent` (with footnotes) instead.
   The library's `modules/stdContent` is a plain default (standard block styles, no h1 — the
   page renders its own) that each project adjusts.
5. ~~Cart as its own page~~ — decided (owner, 2026-11-10): **not in v1**, sidebar only. If a
   customer wants one, it's a core feature (template + `cartUrl` + `cart-ui.ts` page mode) in
   its own plan.
6. ~~Variant sources~~ — resolved in the refine round: v1 header = core's default markup;
   cart button `count` = core default (as tinhof), `text-count` = jurtschitsch's markup
   (`jurtschitsch/webshop-frontend/src/_includes/overridable/header.njk`, the `cart-toggle`
   button); footers = CSS on core's default footer.
7. ~~One dataset for both smoke builds?~~ — decided (owner, 2026-11-10): **two datasets** in
   the same project — `development` (content site) and `development-shop` (shop; created by
   the owner). Each has its own `settings` singleton, home page and menus, so the content-site
   smoke never renders shop pages. Confirmed (owner, 2026-11-10): same project (one project
   id), **both datasets public** (builds read without a token). Tokens: a read and an Editor
   token, created **at project level when step 5 starts** (they cover both datasets), stored
   only in the starter repo's gitignored `.env` — the read token is for draft/preview reads,
   the Editor token for seeding/import.
