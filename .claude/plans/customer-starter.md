# Plan — new customer projects: UI contracts, core CSS split, starter repo with variants

Status: **In progress** (2026-11-10; step 1 spike done, `layer()` confirmed; **step 2 built** the same day on `feature/customer-starter` — A, A.2, A.3, B.1–B.4 + tests + docs; verified by itsapps + tinhof scratch builds against the linked core; owner discussion in the itsapps session; refined once, then
reworked the same day from "one starter + `itsshops init` generator" to "starter repo with a
variant library, assembled by the command"). Nothing built yet. Parts A + B verified against the
code 2026-11-10; parts C–E refined once the same day (wrappers, default header/footer, itsapps
modules, intake limits checked; A.3 added from it). A.3 refined 2026-11-10 against `menu.ts`,
core's `header.njk`/`footer.njk` in full and every active customer header (resize fix made
concrete and widened to the itsapps/rosi_schuster overlay bug; four header/footer a11y fixes
added). Open question 7 decided the same day (two datasets; owner created `development-shop`).
Part B + Part C's feature packages refined 2026-11-10 against `src/config/css.ts`,
`tsup.config.ts`, `core.css` in full, the four active customers' `global.css`, `utilities/`,
backend `page.modules` and every `netlify/functions` wrapper (B.4 customer table made concrete,
checkout/newsletter wrapper options and rate-limit count added). Part A "Classes the customer
must style" + A.3 button hierarchy + Part D intake refined 2026-11-10 against every `btn` in
`src/templates`, the form scripts' submit handling, `checkout.ts`/`checkout-coupon.ts`,
core-back's `FeatureConfig` (intake → manifest mapping made concrete; gallery moved to shop
with its product-container override; open questions 8 + 9 added, then decided by the owner the same day: own button classes, `product_image` block).

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
- **`btn` stays** as core's one button-look class (no rename — it would only cost customer
  edits); core adds **`btn--secondary`** for buttons that aren't the main action on their
  view (plain `btn` = primary). Documented as a contract, styled by the starter, checked by a
  test (A, A.3, C, E).
- **Every core button also has its own class** (owner, 2026-11-10): `btn` (+ `btn--secondary`)
  gives the site's shared button look, the button's own BEM class (`user-login__submit`, …)
  lets a site restyle one button without context selectors. The buttons that have only `btn`
  today get one in A.3. **Component controls** (`.add-to-cart`, `.age-gate__btn--*`, …) keep
  only their own class — no `btn` (open question 8).
- **Focus ring = starter, not core** (owner, 2026-11-11): the global `:focus-visible` rule
  is design (colour, style, offset, per-site exceptions), and a core rule would add no safety
  — without one the browser's own ring shows, and unlayered customer CSS beats layered core
  anyway. All four active customers now share one rule (tinhof aligned 2026-11-11); the
  starter's base ships it and a check keeps it there (C, E).
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
- **Look classes core emits but never styles** (section "Classes the customer must style"):
  `btn` and `btn--secondary` (after A.3). `btn` sits on 15 elements in core's templates
  (checkout submit + coupon buttons, order withdrawal, the five user forms + two user links,
  three newsletter views, the withdrawal module's link) and, after A.3, the cart sidebar's
  checkout link; core's only rule is `.form .btn { align-self }` in `form.css`. Both `<button>`
  and `<a>` carry it, so the customer rule must style both alike. States the CSS must cover:
  hover, `:focus-visible`, `:disabled`, and `hidden` (verified 2026-11-10):
  - user, newsletter and withdrawal forms: while submitting, the script sets `disabled` and
    swaps `[data-submit-text]` for `[data-submit-loading]` — both `<span>`s inside the button,
    toggled with `hidden` — so the button must not change size noticeably. `user-reset`'s button
    starts `disabled` in the markup and `user-reset.ts` enables it once the URL has a token (so
    without JS it stays disabled).
  - checkout submit (`[data-checkout-submit]`): no text swap; `checkout.ts` keeps it `disabled`
    while totals recalculate and while submitting (`setLoading`), progress is shown by
    `[data-checkout-progress]`, `aria-busy` + `data-checkout-state` sit on the container — so
    `:disabled` must look clearly inactive but stay readable (AA on its text is not required
    for disabled controls, but the label must stay legible).
  - coupon buttons: `checkout-coupon.ts` disables both while busy and swaps apply/remove via
    `hidden` (remove starts `hidden`) — a `display` on `.btn` would show both; covered by the
    global `[hidden]` rule below, which is why `buttons.css` relies on it instead of its own
    `[hidden]` patch.
  The list holds only shared look classes — a class core adds later for customers to style goes
  here in the same change. A BEM class of one component (`checkout__submit`) is not on the list.
  **Rule for the doc:** a button or button-like link in core's form and flow views carries
  `btn` (+ `btn--secondary` when it isn't the view's main action) **and** its own class
  (`<block>__<role>`); the shared look goes on `.btn`, a one-off change on the own class.
  Component controls carry only their own class (next item).
- **Component buttons without `btn`** (core renders them with their own class; each is styled
  by the package that brings the part, not by `buttons.css`): `.add-to-cart` (+ `.is-added`,
  `macros/product.njk` `addToCartButton`, the default class) and `.qty-control__btn` (shop);
  `.cart-item__qty-btn`, `.cart-item__remove`, `.cart-sidebar__close` (shop, cart); `.cart-toggle`
  (cart-button variant); `.age-gate__btn--confirm|--deny` (`age-gate.css` is structural only);
  `.newsletter-dialog__trigger|__close` (newsletter); `.product-filters__reset` (shop);
  `.carousel__pause` (core-styled, `carousel.css` after B.4); the lightbox trigger
  `.<cls>__trigger` (`{% gallery %}` shortcode — not in the v1 library); the product gallery's
  `.embla-thumbs__slide__number` (gallery package). None of them gets `btn` (owner, 2026-11-10, open question 8).
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
- **`{% block product_image %}`** (owner, 2026-11-10, open question 9) around the `<figure
  class="product__image">…</figure>` in `core/components/product/container.njk:7–13`, content
  unchanged — no output change. Lets the starter's gallery package (part C) replace only the
  image. jurtschitsch's full override is unaffected.
- **Gallery thumbs announce the selected image** (`overridable/gallery/thumbs.njk`,
  `src/scripts/gallery.ts`): the selected thumb is marked only by the class
  `embla-thumbs__slide--selected` — a state shown by colour/border alone, not exposed to
  assistive tech (WCAG 4.1.2). Fix: `thumbs.njk` renders `aria-current="true"` on the first
  thumb's `<button>`; `syncSelected` in `gallery.ts` removes it from the previous slide's button
  and sets it on the current one, next to the class swap. Test
  `src/scripts/__tests__/gallery.test.ts` (jsdom, `embla-carousel` mocked with a stub exposing
  `on`/`scrollTo`/`selectedScrollSnap`/`previousScrollSnap`/`slideNodes`): after a `select`
  event only the current thumb's button has `aria-current`. Additive for jurtschitsch (uses
  core's partials and script).
- **Button hierarchy** (owner, 2026-11-10): `btn--secondary` added to the coupon buttons in
  `core/components/checkout.njk` (`checkout-coupon__apply`, `checkout-coupon__remove` — the
  page's main action is `checkout__submit`). Every other `btn` is the only or main action of its
  view and stays plain (also `user-confirm.njk`'s "request a new link", which appears only once
  confirming failed). `btn` added to the cart sidebar's checkout link
  (`core/components/cart.njk:42`, `class="cart-sidebar__checkout btn"`) — the cart's main
  action had none. **Own classes** for the buttons that have only `btn` today (added next to
  it, nothing removed):

  | Template (`core/components/…`) | Element | Class added |
  |---|---|---|
  | `order/order-withdraw.njk:51` | submit | `order-withdraw__submit` |
  | `user/user-register.njk:119` | submit | `user-registration__submit` (block = its root `user-registration`) |
  | `user/user-recover.njk:26` | submit | `user-recover__submit` |
  | `user/user-confirm.njk:11` | confirm button | `user-confirm__submit` |
  | `user/user-confirm.njk:18` | "request a new link" `<a>` | `user-confirm__recover` |
  | `user/user-reset.njk:21` | submit | `user-reset__submit` |
  | `user/user-login.njk:28` | submit | `user-login__submit` |
  | `user/user-reset-success.njk:5` | login `<a>` | `user-reset-success__login` |
  | `newsletter/newsletter-confirm.njk:12` | confirm button | `newsletter-confirm__submit` |
  | `newsletter/newsletter-form.njk:36` | submit | `newsletter-signup__submit` (block = its root `newsletter-signup`) |
  | `newsletter/newsletter-unsubscribe.njk:12` | unsubscribe button | `newsletter-unsubscribe__submit` |

  Checked 2026-11-10: no active customer overrides these templates with its own button markup
  (their `overridable/` copies `extends` core), so all four get the classes with the pin; none
  needs a change. The cart template is core-only (not overridable), so tinhof and jurtschitsch
  (both style `.cart-sidebar__checkout` in `blocks/cart.css`; tinhof also has a global `.btn`
  in `global-styles.css`) get their `.btn` rules on that link too — check it in step 3.

## Part B — core CSS (core-front)

1. **Boilerplate into core.** `tailwind/{base,components,utilities}.css` are one `@tailwind …`
   line each and byte-identical in every customer; `tailwind/base.css` is imported by **no**
   customer (preflight is off, `tailwind.config.ts:119`, and core's `reset.css` replaces it).
   `utilities/flow.css` + `region.css` are byte-identical in itsapps/tinhof/rosi_schuster
   (jurtschitsch has no `utilities/` and uses none of the three); `wrapper.css` already reads
   `var(--wrapper-max-width, …)` and differs only in that fallback (itsapps 90rem,
   tinhof/rosi 85rem). Core ships `src/assets/css/utilities.css` → `dist/utilities.css` (the
   three rules as they are, wrapper fallback `90rem`; `copySync` line in `tsup.config.ts`
   `onSuccess` next to the other CSS files, row in the "Importable core CSS files" table). Core
   also ships the two directive files as `src/assets/css/tailwind-components.css` (`@tailwind
   components;`) and `tailwind-utilities.css` (`@tailwind utilities;`) → `dist/`, same
   `copySync` + table rows. The **starter** entry `@import`s them (no `tailwind/` files, no
   `@tailwind base`). They must be **imports, not inline directives** (spike step 1,
   2026-11-10): postcss-import inlines only `@import`s that precede every other statement, so an
   inline `@tailwind components;` before the `@import-glob 'blocks/*.css'` silently drops every
   block file from the output (only a warning: "@import must precede all other statements").
   `@tailwind components` is where core's Tailwind
   plugin emits the palette/space/size/font custom properties (`addComponents({':root': …})`
   in `tailwind.config.ts`), so without it no `--color-*` exists. **Existing customers are not
   switched** to `utilities.css` in this release (additive; they keep their files). Customers
   `@apply wrapper` (15×: itsapps 13, tinhof 2), `flow`, `region` today — keeps working,
   `@apply` resolves classes from any imported file. Starter entry order (all `@import`s first;
   only the empty layer statement may precede them):
   ```css
   @layer reset, core;
   @import '@itsapps/itsshops-core-front/dist/reset.css' layer(reset);
   @import '@itsapps/itsshops-core-front/dist/base.css' layer(core);
   /* starter:core-imports */  /* carousel, shop, form, checkout, … — each layer(core) */
   @import '@itsapps/itsshops-core-front/dist/utilities.css';
   @import 'global/fonts.css';
   @import '@itsapps/itsshops-core-front/dist/tailwind-components.css';
   @import 'global/variables.css';  /* roles + @custom-media */
   @import 'global/base.css';
   @import-glob 'blocks/*.css';
   @import-glob 'blocks/modules/*.css';
   @import '@itsapps/itsshops-core-front/dist/tailwind-utilities.css';
   ```
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
   layered core file (no customer does today: tinhof's `@apply btn is-primary` uses its own
   `.btn` from `global-styles.css`; core's `form.css` only has `.form .btn`). **Spike through the real pipeline — done 2026-11-10, passed**
   (scratch project; `css.ts`'s exact chain ext-glob → import → custom-media → nesting →
   tailwind nesting → tailwind with core's `getTailwindConfig` → nesting → autoprefixer, with and
   without cssnano 7.1.3; the real `dist/reset|core|form|checkout.css` as layered imports): the
   `@layer reset, core;` statement stays first, also minified; each layered file is wrapped in
   its layer, a relative `@import` inside it inherits the layer, nested CSS in it is flattened;
   `@custom-media` defined in customer CSS applies inside layered core files; block CSS, the
   `:root` tokens from `@tailwind components`, utilities and `@apply wrapper` from the
   unlayered `utilities.css` stay unlayered; the `@apply`-from-layer gotcha reproduces (the rule
   lands in a second `@layer core{}`). The only failure: inline `@tailwind` directives (B.1).
   **Decision: starter entries use `layer()`.**
3. **Colour-role contract.**
   - Document in `templates-and-assets.md` the roles core's CSS uses: `--color-bg`,
     `--color-text` (skip link — `base.css` after B.4 —, `form.css`), `--color-error`
     (`form.css`). The starter's `variables.css` defines a fixed role set: `bg`, `text`,
     `muted`, `primary`, `on-primary`, `surface`, `border`, `error` (itsapps' set — it already
     carries dark mode and bands), mapped from the palette in `src/_config/colors.mts`.
   - **Fallbacks** in core CSS for every role it uses (`var(--color-error, <AA red>)` etc.).
   - **Build warning:** new pure helper `findUndefinedColorVars(css: string): string[]` in
     `src/config/css-color-check.ts` — defined = every match of `/(--color-[\w-]+)\s*:/g`, used
     without fallback = every match of `/var\(\s*(--color-[\w-]+)\s*\)/g` (a `var(--color-a,
     …)` has a fallback and is skipped; an inner `var(--color-b)` in that fallback still counts);
     returns used − defined, de-duplicated and sorted. `src/config/css.ts` calls it on
     `result.css` right after `postcss(plugins).process()` (before the write to
     `_includes/css/global.css`) and, if non-empty, `console.warn('[itsshops] CSS uses colour
     roles that are never defined and have no fallback: ' + names.join(', '))` — once per
     compile, no failure (a template may define a property inline). Test
     `src/config/__tests__/css-color-check.test.ts` with small CSS strings (defined, undefined,
     with fallback, nested fallback, minified input). Catches a renamed/removed palette colour (today: silent fallback to
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
   | `.legal-guarantee-notice` (only `core/modules/shippingInfoModule.njk`) | shop | `shop.css` |
   | `.withdrawal-instructions`, `.shipping-info*` | shop | `shop.css` |
   | `.legal-guarantee-compact*` (only `core/components/checkout.njk`) | checkout | `checkout.css` |

   - New `src/assets/css/{base,carousel,shop}.css`, one `copySync` each; **delete**
     `src/assets/css/core.css` and its `copySync` line (`tsup.config.ts:46`).
   - **Customer switch, in the same release as the core pin** (an import of the deleted file
     fails with "Failed to find"). Replace the one `core.css` line in
     `src/assets/css/global/global.css`, same position:

     | Customer (`core.css` line in `global.css`) | Replace with | Why (checked 2026-11-10) |
     |---|---|---|
     | itsapps (line 2) | `base.css`, `carousel.css` | `carousel` in backend `page.modules`; no shop |
     | tinhof (line 10) | `base.css`, `carousel.css`, `shop.css` | `carousel` + `stdContentWithCarousel`; checkout (cart sidebar), `withdrawalPolicyModule` + `shippingInfoModule` in `page.modules` |
     | jurtschitsch (line 10) | `base.css`, `shop.css` | no `carousel` in `page.modules` (its `carousel` field only feeds gallery images, no `.carousel` markup); checkout, both legal modules, modal filter panel (`custom/partials/shop-main.njk`) |
     | rosi_schuster (line 10) | `base.css`, `carousel.css` | `carousel` + `stdContentWithCarousel`; **no `shop.css`**: `checkout: false` (no cart sidebar), neither legal module in `page.modules`, core's own filter partial has no modal mode — nothing in `shop.css` renders |

     `shop.css` rule for the CHANGELOG and the starter: needed when the site renders the cart
     sidebar (`shop.checkout`), `withdrawalPolicyModule`/`shippingInfoModule`, or a
     `[data-filter-panel-modal]` panel. The compact notice moving into `checkout.css` needs no
     customer change (tinhof + jurtschitsch already import it; jurtschitsch's own
     `.legal-guarantee-compact*` rules in `blocks/checkout.css` come later and still win).
   - Import each core file once — postcss-import deduplicates only identical imports, so the
     same file imported in two layers (or with and without one) ships twice.
   - `form`, `checkout`, `search`, `lightbox`, `age-gate`, `product-filter-price.css` are
     already per feature — unchanged.
   - Docs naming `core.css` that must change (grep 2026-11-10; no customer doc names it):
     `templates-and-assets.md` (generated legal modules' "structural baseline" ~line 59 →
     `shop.css`/`base.css`, the table, the `global.css` example, the `dist/` path explanation —
     use `base.css`, the filter-panel scroll lock ~line 265 → `shop.css`),
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
  manifest.json                  packages[]: id, kind, needs, files → target paths, inserts,
                                 placeholders, rate-limit rules; intake[]: rounds → questions
                                 → options (see part D.1)
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
    vinofact/          each: function wrappers, block CSS, page templates' CSS, core CSS
                       imports, config + .env-sample inserts, backend feature flags
                       (coupons, stock, manufacturer are values of the shop package's
                       config insert, not packages — part D.1)
  modules/
    <type>/            backend schema object(s) + frontend projection snippet + template
                       + blocks/modules/<type>.css + de/en labels
```

**Inserts** (how packages extend shared files without a generator): base files carry marker
comments, e.g. `/* starter:core-imports */` in `global.css`, `// starter:features` in
`itsshops.config.mts` and the backend `sanity.config.ts`, `// starter:page-modules` in
`schema/extensions.ts`, `// starter:schema-extensions` (top-level `schemaExtensions` entries,
e.g. `product: { fields }`) in the same file, `// starter:schema-objects` in `schema/index.ts`,
`// starter:module-projections`, `// starter:extension-fields` and `// starter:extension-resolve`
in `extensions.mts`, `// starter:translations` in the backend `src/translation/{de,en}.ts`
(module and field labels), `# starter:env` in both `.env-sample`s.
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

**Layout** is intake values, not variants: content width → `--wrapper-max-width` in
`variables.css` (narrow `64rem` / medium `76rem` / wide `90rem` — defaults, adjust in the design
pass). Text measure and section spacing are fixed defaults in `variables.css` (not asked).

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

**Placeholders:** besides marker inserts, package files may carry `%%name%%` placeholders
(`%%defaultLocale%%`, `%%stock%%`, `%%coupons%%`, …; not `{{ }}` — that is Nunjucks). The
manifest lists each package's placeholders and which intake answer fills them; the command
replaces them in step D.3.

**Feature packages** — function wrappers with file names and `config.path` matching core's
fixed `/api/…` routes (`commerce-and-netlify.md`). Verified 2026-11-10 against every active
customer's `netlify/functions/`:
- **base** `netlify/functions/preview.mts` — itsapps' and jurtschitsch's are identical but full
  of commented-out leftovers; the starter ships it clean: `config.path:
  '/api/preview/:locale/:documentType/:documentId'`, `export default (request, context) =>
  preview({ request, context })`.
- **checkout** — jurtschitsch's set (tinhof's is identical except `invoices: false` in
  `order_notify` — wineNET-only, not in the library): `payment_create` (`/api/payment/create`),
  `payment_webhooks` (`/api/payment/webhooks`), `payment_refund` (`/api/payment/refund`),
  `order_notify` (`/api/order/notify`, `withdrawalNotice: true`), `order_status`
  (`/api/order/status`, `rateLimit` 30 / 60 s), `order_withdraw` (`/api/order/withdraw`,
  `rateLimit` 5 / 60 s), `order_withdraw_notify` (`/api/order/withdraw-notify`),
  `order_meta_cleanup` (`schedule: '@daily'`). **Server options must match the frontend
  config:** `payment_create` and `payment_webhooks` take `{ defaultLocale, features: { shop: {
  stock, coupons } } }` — the functions don't read `itsshops.config.mts`, and
  `resolveServerConfig` (`src/netlify/types/config.ts`) defaults **stock on** (`stock !==
  false`) while the frontend defaults it off (`src/config/config.ts:211`). So both wrappers get
  `defaultLocale: '%%defaultLocale%%'` (first intake locale) and `features: { shop: { stock:
  %%stock%%, coupons: %%coupons%% } }` from the intake (webhooks reads only `stock` +
  `defaultLocale`, same object for simplicity); webhooks also `notify: { withdrawalNotice: true }`.
- **newsletter** — default is **without captcha** (owner rule 2026-11-04, `commerce-and-netlify.md`
  → "Captcha or not"): rosi_schuster's set — `newsletter-subscribe` with `rateLimit` 5 / 60 s and
  `createNewsletterSubscribeHandler({ captcha: false })`, `newsletter-confirm|unsubscribe`
  (identical in jurtschitsch and rosi), paths `/api/newsletter/<name>`; config insert
  `newsletter: { captcha: false }` (frontend default is `captcha: true` — the two must match, or
  the handler rejects every tokenless request). jurtschitsch's captcha wiring is not in the
  library.
- **Rate-limit rules count against the Netlify plan** (`workflows/netlify-plans.md`: 2 per site
  on Free/Personal, 5 on Pro): checkout = 2, newsletter = 1 → checkout + newsletter needs
  **Pro**. The manifest gives each package its rule count; the command's plan step (D.2) sums
  them and names the plan.
- **users** — **no active customer wires them on current core** (rosi_schuster removed its
  user wrappers; the old `jurtschitsch/jurtschitsch_frontend` is a legacy checkout). Paths from
  core's client code (`src/shared/user-api.ts`): `user-register|login|confirm|recover|reset` →
  `/api/user/<name>`; **`user-logout` left out** (no caller in core's scripts/templates);
  `supabase-keep-alive` (`schedule: '0 9 * * 1,4'`, from its doc comment). User forms use
  hCaptcha from the start (same rule): `.env-sample` gets `CAPTCHA_SITE_KEY` +
  `CAPTCHA_SECRET_KEY` (`src/netlify/utils/captcha.ts`). Mark the users package **untested** in
  the manifest until a real project uses it.
- Not in the library: `wc-api` (Winenet only), `auth-webhooks` (removed at rosi_schuster),
  rosi_schuster's `interest-*` (customer feature, `interest-list-and-invites.md`). Scheduled
functions run only on the production deploy (not `staging` branch deploys) — the feature
package's `CLAUDE.md` snippet says so. Core CSS per feature: `base` + `carousel` always, `shop`
(shop), `form` (shop, users, newsletter), `checkout` (checkout), `search`, `age-gate`,
`product-filter-price` (shop). `lightbox.css` belongs to the `{% gallery %}` shortcode (lightbox
dialog, `src/gallery/render.ts`; used only by jurtschitsch's downloads module) — **not** to the
product gallery, and not in the v1 library. **Shop flags in both stacks:** the shop package
inserts `shop: { checkout: %%checkout%%, category: %%category%%, coupons: %%coupons%%, stock:
%%stock%%, manufacturer: %%manufacturer%% }` into **both** `itsshops.config.mts` and the
backend `sanity.config.ts` (backend: plus `enabled: true`), always with every flag written out —
core-back defaults `checkout` **on** (`FeatureConfig`, core-back `src/types/config.ts`) while
core-front defaults it off, so an omitted flag differs between the stacks. `vinofact` package:
`vinofact: { enabled: true }` in both configs + `VINOFACT_API_URL`, `VINOFACT_API_TOKEN`,
`VINOFACT_PROFILE_SLUG` in the frontend `.env-sample`; needs `shop`. **Gallery** (needs `shop`; verified 2026-11-10 against jurtschitsch's
`overridable/product/container.njk`, `extensions.mts`, backend `schema/extensions.ts`, and core's
`gallery/{main,thumbs}.njk` + `gallery.ts`): more than one product image is **not core data** —
core's product/variant carry one `image`. jurtschitsch adds it as a customer extension, so the
package carries all of it (both stacks):
  - *Backend* (`// starter:schema-extensions`): `product` and `productVariant` each get
    `f('localeAltImages', 'array', { of: [{ type: 'localeAltImage' }], group: 'media' })`;
    labels (`// starter:translations`) `'product.fields.localeAltImages.title'` and
    `'productVariant.fields.localeAltImages.title'`: de "Galerie" (jurtschitsch's "Gallerie" is
    a typo), en "Gallery".
  - *Frontend* `extensions.mts`: `fields.product` and `fields.variant` =
    `` `"localeAltImages": localeAltImages[]${p.i18nAltImage}` `` (`// starter:extension-fields`);
    `resolve.product` returns `localeAltImages` mapped with `ctx.resolveLocaleAltImage` and
    filtered on `img?.asset?._ref`; `resolve.variant` returns it **only when the variant has
    some** (`...(raw.localeAltImages?.length && {…})`), so the product's stay as fallback
    (`// starter:extension-resolve`; jurtschitsch `extensions.mts:192–208` without the factsheet).
  - *Template* `overridable/product/container.njk` = `{% extends
    "core/components/product/container.njk" %}` + only `{% block product_image %}` (new in core,
    A.3 / open question 9). Inside the block (all `set`s there too, not at the child's top
    level): `_galleryImages` = `[product.image].concat(product.localeAltImages or [])`, skipping
    empty images and repeated `asset._ref`s (jurtschitsch `container.njk:9–16`);
    `_galleryImageSize = imageSizes.product`, `_galleryThumbSize = imageSizes.thumb` (both core
    defaults — no `imageSizes` insert; jurtschitsch's `productThumb` is its own); `_galleryThumbsMin`
    left at its default 2 (no lone thumb for one image). Markup: `<div class="product__image
    product-gallery" data-gallery>` with `gallery/main.njk` then `gallery/thumbs.njk` — one
    `[data-gallery]` ancestor, as `gallery.ts` needs; `main.njk` falls back to the placeholder
    with no image and loads the first slide eager. jurtschitsch's preload and its wine layout
    stay out.
  - *CSS* `blocks/embla-gallery.css` (jurtschitsch's as reference): `.embla*`, `.embla-thumbs*`,
    `.embla-thumbs__slide--selected`, thumb buttons ≥ 24 × 24 px with `:focus-visible`.
Non-feature
switches: search → `search: {…}` stub (shop only), age gate → `ageGate: { enabled: true }`, dark →
`manifest.colorScheme: 'light dark'` + `themeBgColorDark`, `theme.css` import, the three-block
role set with `color-scheme` (`ui-contracts.md` → "Theme switch"). The theme toggle is core's
since 2026-11-11 (moved from itsapps; two upcoming customers want dark mode).

**Base `blocks/buttons.css`** styles the look classes from Part A's "Classes the customer
must style": `.btn` (primary: `--color-primary` / `--color-on-primary`) and `.btn--secondary`
(outline: `--color-text` on `--color-bg`, `--color-border`), on `<button>` and `<a>` alike,
with every listed state (hover, `:focus-visible` — the global outline, `:disabled`, the
loading text swap), AA contrast in every role set (light, dark, bands), target
size ≥ 24 × 24 px (WCAG 2.5.8). It never sets `align-self` (core's `.form .btn` owns it; with
`form.css` layered, an unlayered `.btn` would win).

**Default CSS rules (all packages):** plain on purpose (system font stack, neutral palette);
only colour roles, never palette names or literal colours; AA contrast for every role pairing
that carries text; the **focus ring** in base `global/global-styles.css`, the rule all four
active customers share:
```css
:focus-visible {
  outline: 2px dotted currentColor;
  outline-offset: -2px;   /* inset: no overflow:hidden ancestor clips it, shows on filled buttons */
}
```
`:focus-visible` only (no ring on mouse clicks); no package sets `outline: none` without a
replacement ring; text-only links where an inset ring crosses letters (header logo, nav,
locale switch) get it outside (`outline-offset: 0.25em` in the header variant's CSS, as
itsapps); a package may draw a stronger ring for its own control (tinhof: video toggle, shop
button);
motion only under `prefers-reduced-motion: no-preference`; every state from the part's contract
styled; base CSS has the `[hidden]` rule. Files: `.env-sample` (not `.env.example` — the
customers' `.gitignore` ignores `.env*` except `!.env-sample`).

## Part D — the command `/itsshops-new-customer`

Rewrite `~/.claude/commands/itsshops-new-customer.md` and `workflows/new-customer.md`:

1. **Intake**, with `AskUserQuestion` — limits: 1–4 questions per call, **2–4 options per
   question** (an "Other" free-text option is added automatically), previews only on
   single-select questions. So a long feature list is split into several multi-select
   questions, and **a part with only one variant is not asked** (v1: the header). The command
   splits any question with more than 4 options into consecutive questions of ≤ 4 (modules
   will outgrow 4). Rounds:
   - Round 1 — basics: kind (site / shop); locales (de / de + en / Other → free text, first =
     default → `%%defaultLocale%%`); form of address (Sie / Du → `SHOP_FORMALITY=informal` in
     the frontend `.env-sample` and an owner step to set it in Netlify — env only, the functions
     read it too; nothing in the backend); extras, multi-select (newsletter, users, blog, dark
     mode).
   - Round 2 — only for a shop: shop features, multi-select (checkout, category, coupons,
     vinofact); more shop, multi-select (stock, manufacturer, age gate; search dropped from v1); product
     gallery (yes / no).
   - Round 3 — look: footer (`simple` / `columns`, with previews); cart button (`count` /
     `text-count`, **only with checkout** — without it core renders no cart toggle, A.3);
     content width (narrow / medium / wide, part C → "Layout").
   - Round 4 — content: modules, multi-select (stdContent, hero, teaser, faq).
   - Names (folder, repo, domain, company) as free text in the plan step.
   **Manifest `intake[]`:** rounds → questions (`id`, `header` ≤ 12 chars, `question`,
   `multiSelect`, optional `when`: an expression over earlier answers, e.g. `kind == shop`,
   `checkout`) → options (`label`, `description`, optional `preview`, and what choosing it does:
   `packages: [...]` and/or `values: { placeholder: value }`). Unchosen options set their
   `values` to the declared default (`false` for `stock`, `coupons`, …), so every placeholder is
   filled either way. Coupons and stock also `needs: checkout` (server-side only; the
   payment wrappers read them). Adding a variant later = a package + an option, no command
   change.
2. **Plan + go-ahead:** the package list resolved from the manifest (with `needs` checked,
   e.g. a package requiring `shop`), paths, owner steps, and the summed rate-limit rules →
   Netlify plan (Personal ≤ 2, Pro ≤ 5).
3. **Assemble:** copy `base/` → `web/<customer>/<…>-frontend|backend`, then each package's
   files; apply the inserts; remove the markers; fill the `%%…%%` placeholders; set
   name/locales/tokens. Then `grep -r '%%[a-zA-Z]*%%\|starter:'` over both folders must find
   nothing.
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
  base, `needs` names real packages or answers, every intake option has `packages` or
  `values` and names only existing packages/placeholders, every question has 2–4 options and a
  `header` ≤ 12 chars, every `%%…%%` placeholder in a package file is declared in its
  manifest entry and filled by some intake answer or a default); **contract
  test** — every template the library ships (v1: `cart-toggle` partial, module templates)
  contains its part's required hooks (`[data-cart-toggle]` with `aria-controls` +
  `aria-expanded`, `[data-cart-count]`, …); **drift test** — every class selector in the
  library's CSS occurs in core's `dist/templates/**/*.njk`, `dist/scripts/**` (copied `.ts`
  sources) or the library's own templates, plus a short allowlist in the test for classes core
  builds in TS from a prefix (`src/gallery/render.ts`: `${cls}__trigger`, default `gallery`),
  which no text search finds — empty in v1 (no package styles the lightbox), the mechanism is
  for when one does; **look-class test** (the reverse direction) — every class in `ui-contracts.md`
  → "Classes the customer must style" (v1: `btn`, `btn--secondary`; kept as a list in the
  test, with a comment pointing at the doc) has a rule in the base CSS, and each still occurs
  in core's `dist/templates/**` (so a class core drops fails the test too); **focus test** —
  the base CSS has the `:focus-visible` rule above (parsed with postcss, not a text match), and
  no library CSS sets `outline: none`/`0` in a rule without a `:focus-visible` replacement for
  the same selector.
- **Assembly smoke** (starter repo script, run before a library release and by the command at
  the end): assemble a content site (all modules, each footer variant once) and a shop
  (checkout, coupons, stock, newsletter, gallery; no vinofact) into a scratch dir, `npm link` core, build
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

1. ~~B.2 spike through the real pipeline~~ — done 2026-11-10: `layer()` works; the `@tailwind`
   directives must come in as imported files (B.1).
2. ~~Core-front on `feature/customer-starter`~~ (done 2026-11-10; CHANGELOG has an "Unreleased (4.0.0)" entry): A (contracts doc), A.2 (submenu disclosure),
   A.3 (menu resize fix, burger/logo/`aria-current` fixes, footer label, cart-toggle partial,
   own button classes, `product_image` block, gallery thumb `aria-current`),
   B.1–B.4 + tests.
3. Switch the four active customers (B.4 table) against the linked core: diff each one's
   compiled `src/_includes/css/global.css` before/after — same rules, only the former
   `core.css` sections moved (itsapps + rosi_schuster: minus the shop sections and the compact
   warranty notice; jurtschitsch: minus the carousel section; tinhof: the compact notice now
   with `checkout.css`). tinhof + jurtschitsch: also look at the cart sidebar's checkout link
   in `npm run dev` (it now carries `btn`, A.3) and, if their `.btn` rules clash with
   `.cart-sidebar__checkout`, fix it in their `blocks/cart.css`.
   **itsapps done 2026-11-10** (branch `feature/core-4-css`): layered imports, core's
   Tailwind/utilities files (local copies deleted), output identical declaration by declaration.
   **tinhof done 2026-11-11** (branch `feature/core-4-css`, commit 3376f59):
   diff vs 3.11.0 = only the expected changes (privacy-policy split out of the shop lists,
   role fallbacks, reset `[hidden]` rule; the compact notice moved to `checkout.css`
   unchanged); `--wrapper-max-width: 85rem` on `:root` replaces the old 85rem fallback. Layer
   flip found: tinhof's global `:focus-visible` (inset) beat core's
   `.checkout__changes:focus-visible` and sat on the notice's border — `blocks/checkout.css`
   now only sets `outline-offset: 2px` (the site's dotted ring, outside). Global ring then
   aligned to the other three (2px dotted `currentColor`, `:focus-visible` only). Follow-up
   (found with the rosi check below): that ring also beat core's `.form-field
   :is(input, textarea, select):focus { outline: none }` — `blocks/form-base.css` restores it
   (fields show focus by their border, as live). Found in `npm run dev`: shop cards' vintage
   image wrapper had a static `hidden` that tinhof's `display: contents` used to override —
   core's `[hidden] … !important` reset now wins, image area blank → attribute removed
   (`overridable/product/card.njk`). Final check (2026-11-11): `main` (core 3.11.0) and the
   branch built side by side in a scratch dir. HTML diff over all pages = only the expected
   class/`hidden` changes. Computed-style diff (Playwright, every element incl.
   `::before`/`::after` + bounding box; home, shop, product, a content page, checkout with a
   cart item; 390 + 1440 px) found the global `input, select { background-color }` beating
   core's transparent field/price-slider background → restored in `blocks/form-base.css`;
   then **0 differences**. Use this check for jurtschitsch too; it catches what the CSS rule
   diff can't (markup `hidden`, which rule wins).
   **rosi_schuster done 2026-11-11** (branch `feature/core-4-css`): `base` + `carousel`
   layered; diff vs 3.6.3 = only the shop sections and compact notice gone, fallbacks,
   privacy-policy split, `[hidden]`; `--wrapper-max-width: 85rem` as tinhof. Layer flip: its
   bare `a { text-decoration: underline }` reached core's `.skip-link` → `.skip-link {
   text-decoration: none }` in `global-styles.css` (`a:hover` won already before). Dead rules
   removed: `.product-list__item[hidden]`, the `[role='list']` copy. Newsletter dialog sets
   `max-height: calc(100dvh - …)` + `overflow: auto` — passes. Build + `npm test` pass.
   **Method addition:** also compare core rules whose selector names no element
   (`.skip-link`, `.form-field … :focus`) against the customer's bare element/pseudo rules
   (`a`, `:focus-visible`, `input`, …) with the same property, and grep the templates for
   static `hidden` attributes on elements whose CSS sets `display` — the first tinhof pass missed the form
   field because it only matched rules by shared class or element. itsapps re-checked this
   way: clean (its link rules are `a:not([class])`). Dead rules removed:
   six `[hidden] { display: none }` (incl. `.btn[hidden]`) and the `[role='list']` reset copy.
   Cart checkout link: `.cart-sidebar__checkout` (in `blocks/`, after `.btn`) sets every
   property `.btn` does, hover too — no change; worth a look in `npm run dev`. Eleventy build
   passes; `npm test`: `wc-api` "filter by status" fails against the deployed API (live
   data, no core netlify change since 3.11.0) — unrelated.
   **Dead-rule check (each customer, 2026-11-11):** every class / `data-` attribute in the
   customer's own compiled (unlayered) CSS, looked up in the built pages + JS and in the
   template/script sources of customer and core (names core builds from a variable —
   `{{ class }}__option`, `checkout-totals__row--${…}` — and state-only ones like the sold-out
   label count as used; Leaflet builds its classes at runtime). Found: tinhof 14 rules
   (`[data-no-flash]`, `.preload-transitions` and other copied starter helpers, old shop
   classes, commit `55da0e0`), rosi `[data-no-flash]` (`672d0d2`); jurtschitsch has
   `[data-no-flash]` too. Note: core never fetches archived variants (`queries.ts`), so a
   `--archived` style never renders.
   **jurtschitsch done 2026-11-11** (branch `feature/core-4-css`; staging on 3.6.3, compared
   against 3.11.0 to isolate the switch): `base`, `shop`, `form`, `checkout`, `lightbox`
   layered, no `carousel`, no `utilities.css` (unused here). Rule diff = carousel section gone
   + the common changes. Fields: `--field-focus-color` = border colour, so a focused field had
   **no visible indicator** before; the global ring now reaches them (layer flip, kept as a
   fix) and is drawn outside (`form-base.css`); checkout-changes notice ring outside. Global
   `input, select { background-color }` beat core's transparent fields → restored. Cart
   checkout link + `btn`: no standalone `.btn` rule here, no change. Dead rules removed:
   `[data-no-flash]`, `[role='list']` copy, five `[hidden]` rules. Side-by-side: HTML of all
   88 pages = expected changes only (incl. gallery thumb `aria-current`); computed styles on
   five pages × 2 widths = only the skip link's `text-decoration-thickness` (no underline,
   invisible). No `npm test` script; its `tests/unit` fail on a broken import
   (`../utils/sanity`, pre-existing). **Step 3 complete.**
   Original instructions for the switch: layered entry like itsapps, delete local `tailwind/` + `utilities/`
   copies and the unused `tailwind/base.css`, then diff declaration by declaration. With layers,
   list every customer rule that now beats a core state rule (`form.css`, `checkout.css`:
   e.g. the loading dim) and fix it. Also look for dead rules. rosi_schuster: check that its
   newsletter dialog sets `max-block-size` + `overflow` (`ui-contracts.md` → Newsletter dialog).
   **Setup per customer:** `npm link @itsapps/itsshops-core-front` first (core on
   `feature/customer-starter`, built), work on a branch `feature/core-4-css` (as itsapps), not
   `main`. Merge into `main` with the core tag pin at release (step 9). Order doesn't matter.
   **How to compare (itsapps method):** a scratch script runs the customer entry through
   `css.ts`'s PostCSS chain: ext-glob, postcss-import, custom-media, nesting, tailwind nesting,
   tailwindcss with `getTailwindConfig(projectConfig.css)` from the customer's
   `itsshops.config.mts`, nesting, autoprefixer. Run it from the customer root, with core's
   `node_modules` for the plugins. Compile (a) the entry before the change against the old core
   CSS: copy core's `dist/*.css` from `main` (3.x) into a folder and rewrite the
   `@itsapps/itsshops-core-front/dist/` paths to it. Compile (b) the new entry. Flatten both with
   postcss: one line per declaration = `ancestors (selector / at-rule, layer wrappers stripped) ::
   prop:value`. Then `diff`. Expected differences only: the moved/removed core sections. Specificity
   effects of layers don't show in this diff. Check them separately: customer rules hitting the
   same properties as core's multi-class/state selectors (`form.css`, `checkout.css`,
   `shop.css`).
4. ~~Refine parts C–E~~ — done 2026-11-10 (one round; see Status).
5. Starter repo: base, manifest, inserts; feature packages; modules v1; demo content + export.
   **Setup (owner, 2026-11-11):** Sanity project `pdsm6m17` (itsapps account), public datasets
   `development` + `development-shop` both exist. Viewer + Editor tokens: the owner adds them to
   the starter's gitignored `.env` before 5g (not needed for builds). Demo content: Claude
   writes the documents with the Editor token, owner reviews them in the Studio before the
   export. GitHub repo `itsapps/itsshops-starter` (private) exists, empty; push `main` as own
   user. Order: 5a scaffold → 5b base (front + back, markers) → 5c base-only build →
   5d feature packages (shop → checkout → category, newsletter, users, blog, search, age-gate,
   dark, gallery, vinofact; re-assemble after each) → 5e modules → 5f manifest `intake[]` →
   5g demo content + `seed/` export.
   **5a–5c done 2026-11-11** (uncommitted in the starter): scaffold, `base/` front + back, a
   manifest-driven `scripts/assemble.mjs` (Part E smoke: copy base + packages, a package may
   replace a file only if it lists it in `overrides`; inserts go above their marker with its
   indentation; marker lines removed; `%%…%%` filled from answers → package values → manifest
   defaults, an unfilled one fails). Markers grew beyond part C: `starter:manifest`,
   `starter:config`, `starter:colors`, `starter:color-roles`, `starter:module-resolve`,
   `starter:schema-imports`, `starter:schema-documents`, `starter:localized-field-types`,
   `starter:icon-imports`, `starter:icons`, `<!-- starter:claude-features -->` — all listed in
   `manifest.json` → `markers`. Base placeholders: `projectName`, `projectTitle`,
   `sanityProjectId`, `locales`, `localesText`, `defaultLocale`, `formality`,
   `wrapperMaxWidth`, `colorScheme`, `starterVersion`, `createdAt`. Base-only assembly against
   `development` (empty): Eleventy build with no `[itsshops]` warning, `sanity build`,
   `sanity schema validate` per workspace (0/0), backend `tsc`, both test suites pass. Found:
   core-back no longer exports `./localization` (the itsapps backend translator test can't run),
   so base has no translator test; itsapps' `eleventy-run` test swallowed errors — base's asserts
   a rendered page.
   **5d done 2026-11-11** (starter commits 140855f, b601e4e): packages `shop`, `checkout`,
   `category`, `newsletter`, `users` + `blog` (both `untested`), `age-gate`, `dark`,
   `gallery`, `vinofact`, plus two shared ones pulled in by `includes` (never asked): `form`
   (core `form.css` + field tokens — core's default field edge, 30 % text, is ~1.9:1, below the
   3:1 WCAG 1.4.11 needs; ring drawn outside) and `mail` (mail env, needed by checkout,
   newsletter, users). Deviations from part C: `cart.css` is in `checkout` (the sidebar only
   renders with checkout); the shop module CSS (`productList`, `productVariantList`) and
   `categoryList` ship with their feature, not as module packages; `age-gate` sets
   `checkoutAgeConfirmation: true`; base module lists are shared by `page` and `post` (blog adds
   `post: moduleProjections` / `post.modules`). Core-front renders **no blog index**. Checked:
   smoke shop (shop, checkout, category, newsletter, gallery; coupons + stock) builds
   against `development-shop` and its Studio builds + validates; an all-packages assembly
   (vinofact switched off for the frontend build) builds both sides; all 18 wrappers load in
   Node; checkout + newsletter = 3 rules → Pro.
   **Placement decisions (owner, 2026-11-11):** core renders neither the newsletter dialog nor
   a search trigger anywhere by default.
   - *Newsletter:* customers want it in the footer (rosi) or on its own page, linked from a
     menu (jurtschitsch's field-less `newsletterModule`). v1 ships the page module
     (`modules/newsletterModule`, plain, headline/intro optional, added by the newsletter
     answer); the footer dialog can't be a CSS-only variant (core's footer has no slot) — the
     command builds it from the newsletter-dialog contract on request (D.4), the package keeps
     its CSS. Core change only when a second customer wants the footer dialog.
   - *Search:* **dropped from v1** (owner, 2026-11-11; package removed, starter commit
     63a2e4a) — only tinhof (live) and grass-art (dormant) use it, each
     placing the modal + `[data-search-open]` in its own `productList` override; the index holds
     products only and its one consumer is the search modal. Re-add with a placement when a
     second active shop wants it (package: `extensions.search` entry, `searchResult` image size,
     placement).
   - *Modules v1 (owner, 2026-11-11):* hero + teaser **without buttons** (no `actionGroup`; a
     project adds them), teaser **without video**, `newsletterModule` with optional `headline` +
     `intro` (both may stay empty → only core's form renders). CSS for core's always-present
     modules (`carousel`, `youtube`, `privacyPolicyModule`) goes into base, not module packages.
   **5e done 2026-11-11** (starter commit d9c5503): module packages `stdContent`, `hero`, `teaser`,
   `faq`, `newsletterModule` (needs newsletter; the newsletter package pulls it in), each with
   schema object, icon, de/en labels, projection, resolve, template, one CSS file; shared
   `standardContent` (rich text, `standardBlock`, `localizedFieldTypes`) pulled in by the text
   modules via `includes` (now transitive). Hero headline is an `<h2>` (the page title is the
   `<h1>`); first hero image preloaded + eager. Teaser: image left/right/none, DOM order stays
   image → text. Base got `blocks/modules/{carousel,youtube,privacyPolicyModule}.css` and an
   `imageSizes` block (`starter:image-sizes`; hero + teaser add theirs). Checked: content site
   with all modules + newsletter + dark builds, Studio builds + validates (de, en), backend
   `tsc`; shop + all-packages assemblies still pass. Template rendering is checked with the
   demo content (5g).
   - *Core fix found on the way (4.0.1, owner 2026-11-11):* every site wrote an empty `[]`
     `/<locale>/search.json` (`search-index.njk` had no gate; `resolver.ts:211` returns `[]`
     without `extensions.search`). Fixed with a **derived** flag `features.shop.search` (shop on
     + `extensions.search`; resolved type only, not customer input — no second switch that could
     disagree) read by `src/config/templates.ts` like the other feature gates. Test
     `src/config/__tests__/templates-gate.test.ts`; verified on the starter content site (no
     `search.json`). CHANGELOG "Unreleased (4.0.1)", `extending.md` → "Search".
6. Variant library v1, each against its contract.
7. Starter checks (manifest, contract, drift, look classes) + assembly smoke.
8. Part D: command + `new-customer.md`; `/itsshops-update-docs` (core-front, starter).
9. Release: CHANGELOG core-front **4.0.0** — "Upgrading": replace `dist/core.css` with
   `base.css` + `carousel.css` (if the carousel module is used) + `shop.css` (if the site
   renders the cart sidebar, the withdrawal/shipping modules or a modal filter panel); compact
   warranty notice now in `checkout.css`. "Added": submenu disclosure, `partials/cart-toggle.njk`,
   `tailwind-components.css` + `tailwind-utilities.css`,
   an own class on every form/flow button next to `btn` (A.3 table), `{% block product_image %}`
   in the product container,
   `utilities.css`, role fallbacks, the `--color-*` build warning, `btn--secondary` on the
   checkout's coupon buttons (`btn` documented as the button-look class customers style).
   "Fixed": gallery thumbs expose the selected image (`aria-current`); menu state after a
   resize (default menu stayed inert; an overlay whose burger disappears stayed open with the
   page inert — itsapps, rosi_schuster); default header: no burger without a main menu, logo
   name = visible title, cart button only with checkout + count announced, `aria-current` on
   sub-links and footer links; translated footer-menu label. "Changed" (default header only):
   cart toggle markup (no `aria-label`, sr-only label) — customers styling `.cart-toggle`
   from core's markup check it; the cart sidebar's checkout link now also has `btn` (core-only
   template) — customers whose `.btn` rules don't suit it adjust `.cart-sidebar__checkout`.
   **Core 4.0.0 tagged 2026-11-11** (owner asked ahead of steps 5–8, which don't change core);
   tinhof pinned it on `staging` for review. Remaining: tinhof production, jurtschitsch,
   rosi_schuster, itsapps pins; starter tag once steps 5–8 are done.
   Push core before any customer
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
8. ~~`btn` on component buttons?~~ — decided (owner, 2026-11-10): **no.** `.add-to-cart`,
   `.age-gate__btn--*` and the other component controls keep only their own class (tinhof and
   jurtschitsch style add-to-cart by class; `btn` would pull tinhof's global `.btn` onto it).
   Also decided: every core form/flow button carries `btn` **and** its own class (A.3 table).
9. ~~Product gallery without copying core's container?~~ — decided (owner, 2026-11-10): core
   adds `{% block product_image %}` (A.3); the gallery package overrides only that block.
