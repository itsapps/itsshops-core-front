# UI contracts — what core's JS expects from markup and CSS

Per UI part core's scripts drive: the **markup hooks** a template must render, the **states** the
script sets, what the **CSS must do** with them, and the **a11y** the markup provides (the script
does the rest). A customer template override, a starter variant, or a part built from scratch must
keep its part's contract — then core's JS works unchanged. Verified against `src/scripts/`
2026-11-10. Keep this file in sync when a script's hooks or states change.

## Global rule

Core shows/hides almost everything with the `hidden` attribute, and any author `display` rule beats
the UA's `[hidden] { display: none }`. So `reset.css` (4.0.0) sets
`[hidden]:not([hidden='until-found']) { display: none !important; }`: an element with `hidden` is
hidden, whatever its `display`. Consequences:

- **Show or animate a part with a class or attribute** (`.is-open`), never by overriding
  `display` on `[hidden]`. That no longer works (layered: core's `!important` beats a customer's).
- Per-component `&[hidden] { display: none }` patches are redundant (harmless).
- Every site imports `reset.css`. One that doesn't must set the rule itself.

**When to use `hidden` and when a class** (for new parts, core and customer):
- **Plain on/off, no animation → `hidden`.** One attribute hides visually, from screen readers
  and from the tab order, works before CSS loads, and is trivial to toggle and test.
- **Animated (overlay, drawer, dropdown that slides/fades) → a state class (`.is-open`) +
  `visibility: hidden` when closed.** `display: none` can't animate, while `visibility` also
  takes the element out of the a11y tree and tab order and can be delayed by `transition` until
  the closing animation ends. The alternative: `opacity`/`transform` **plus `inert` (and
  `aria-hidden`) in the markup**, which `menu.ts` removes on open and restores on close (itsapps'
  overlay). Never `opacity`/`transform` alone: the element stays focusable and announced. The
  cart sidebar is state-class based too (`.is-open`; how it hides is customer CSS). A menu that
  animates must not start `hidden` (see Menu).

## Menu (`menu.ts`, every `[data-menu-toggle]` button)

- **Hooks:** a button `[data-menu-toggle]`; its target = the `data-menu-toggle` value or the
  `aria-controls` id. Optional `[data-menu-close]` inside the target.
- **Open:** removes `hidden` (only if the target started `hidden`), adds `is-open`,
  `aria-hidden="false"`, removes `inert`, `aria-expanded="true"` on the button, inerts the rest of the
  page (`lockInertOutside([target, button])`, not `deep` — so only `<body>` children containing
  neither; in core's default header the logo and actions stay reachable, the overlay CSS must leave
  them visible), focuses the first focusable element in the target.
- **Close** (button, `[data-menu-close]`, Escape): the reverse; `data-closing` on the button for
  300 ms (for a closing animation), focus back to the button.
- **Resize:** when the button stops being rendered (`getClientRects()` empty — e.g. hidden from a
  breakpoint on), an open menu closes **without** moving focus, and the target gets its initial
  `hidden` / `inert` / `aria-hidden` back. So a menu shown inline on large screens is reachable
  there again, an overlay never stays open with the page inert. The button's own CSS visibility is
  the single source — no breakpoint in JS.
- **CSS:** show/hide/animate on `.is-open`. A target visible inline on large screens must **not**
  start `hidden` or `inert`. A separate mobile overlay is hidden with `display`/`visibility`, or
  with `opacity`/`transform` when it starts `inert` + `aria-hidden="true"` in the markup. Never
  with `opacity`/`transform` alone: it must be out of the a11y tree before the first toggle.
- **A11y in markup:** the button has an accessible name (`aria-label` via i18n), `aria-expanded`,
  `aria-controls`.

## Submenus (`submenu.ts`, every `[data-submenu-toggle]` button)

- **Hooks:** a button `[data-submenu-toggle]` with `aria-controls` = the id of its list. Core's
  default header renders it as `.site-nav__submenu-toggle` (item with link + children) and
  `.site-nav__trigger` (item that is only a submenu).
- **States:** the script sets `hidden` on every list at init (without JS all links stay visible),
  click toggles `hidden` + `aria-expanded`; opening one closes the other open submenus of the same
  `<nav>`; Escape closes and returns focus to the button if focus was inside; a click outside the
  `<nav>` closes without moving focus.
- **CSS:** position the open list (dropdown on wide screens, inline in the mobile overlay). No
  `:hover`-only opening — the list is `hidden` until clicked.
- **A11y in markup:** the button's name says what it opens (default header: sr-only
  "Untermenü öffnen: <title>" or the visible title).

## Cart (`cart-ui.ts`)

- **Hooks:** `#cart-sidebar` containing `[data-cart-items]`, `[data-cart-total]`,
  `[data-cart-empty]`, `[data-cart-close]`; any number of `[data-cart-toggle]` buttons
  (`aria-controls="cart-sidebar"`, `aria-expanded` kept in sync) and `[data-cart-count]` elements
  (text = item count; with `data-cart-count-hide` also `display: none` at 0); optional
  `[data-cart-overlay]`. The sidebar exists only with `shop.checkout` (`layouts/base.njk`), so a
  toggle must too — core's `overridable/partials/cart-toggle.njk` renders it only then and not on the
  checkout page. Lines come from the `cartItem` macro (`[data-cart-item]`,
  `[data-qty-decrease|value|increase]`, `[data-cart-remove]`). Add to cart: `[data-add-to-cart]`
  inside `[data-product-actions]` or `.product-card__actions`, optional `[data-qty-control]`.
- **States:** `.cart-sidebar.is-open`, overlay `.is-visible`, `[data-cart-empty]` `hidden`, Escape
  closes; the add button gets `.is-added` briefly. No cart page exists — the sidebar is the only cart
  UI.
- **CSS:** the sidebar's open/closed look on `.is-open`, the overlay on `.is-visible`
  (`shop.css` draws only the close/remove icon).
- **A11y in markup:** the toggle's name includes the count — default partial: sr-only
  "Zum Warenkorb, " + the visible count, no `aria-label` (an `aria-label` would replace the count).

## Newsletter dialog (`newsletter-dialog.ts`)

- **Hooks:** `[data-newsletter-dialog]` containing `[data-newsletter-open]`, a `<dialog>`,
  `[data-newsletter-backdrop]` (toggled `hidden`), `[data-newsletter-subscribe]`,
  `[data-newsletter-close]`.
- **States:** `html.newsletter-dialog-open` while open — **no core CSS styles it**; the customer CSS
  must lock scroll (`overflow: hidden`).
- **CSS:** opened with the non-modal `dialog.show()`, and `reset.css` unsets the dialog's UA
  `inset`/`max-width`/`max-height`. So the customer CSS positions the dialog (e.g. `position:
  fixed` + `inset` + `margin: auto`) and gives it `max-block-size` (≤ `100dvh`) + `overflow: auto`.
  Otherwise, on a small or landscape screen, part of the form lies off screen, unreachable
  (WCAG 1.4.10).

## Product filter panel (`product-filter.ts`)

See `templates-and-assets.md` → "Product filter panel": `[data-toggle-products-filter]` toggles
`is-open` on `[data-filter-panel]`; `data-filter-panel-modal` opts into a modal dialog with
`html.has-filter-panel-open` (scroll lock in `shop.css`); `[data-product-list][data-view]` for the
grid/list toggle.

## Other parts (states styled by core CSS)

| Part | Hooks | States / core CSS |
|---|---|---|
| Carousel (`carousel.ts`) | `[data-carousel]`, `[data-carousel-pause]` | pause label swap; position in `carousel.css` |
| Product gallery (`gallery.ts`) | `[data-gallery]` ancestor with `.embla__viewport` (+ optional `.embla-thumbs__viewport`) — partials `overridable/gallery/{main,thumbs}.njk` | `.embla-thumbs__slide--selected` + `aria-current="true"` on the selected thumb's button; **no core CSS** (customer styles `.embla*`) |
| Lightbox (`lightbox.ts`, `{% gallery %}` shortcode) | `[data-gallery-open]`, `[data-lightbox]`, `[data-lightbox-items]`, `[data-lb-prev|next|close]` | `lightbox.css` |
| Search (`search.ts`) | `[data-search]`, `[data-search-open]`, `[data-search-modal]`, `[data-search-input]`, `[data-search-results]`, `[data-search-close]` | `search.css` |
| Age gate (`age-gate.ts` + inline) | `[data-age-gate]`, `[data-age-gate-confirm|deny]`, `[data-age-gate-denied-msg]` | `html[data-age-gate-state="pending|open"]`; structure in `age-gate.css`, the buttons' look is customer CSS |
| Checkout (`checkout.ts`) | `[data-checkout]` + `[data-checkout-*]` regions | `data-checkout-state`, `aria-busy` on the container; `checkout.css` |

## Classes the customer must style

Look classes core emits but never styles (core's only rule: `.form .btn { align-self }` in
`form.css`):

- **`btn`** — a button or button-like link in core's form and flow views (checkout submit, order
  withdrawal, the user forms and links, the newsletter views, the withdrawal module's link, the cart
  sidebar's checkout link). Plain `btn` = the view's main action.
- **`btn--secondary`** — next to `btn` on a button that isn't the view's main action (the checkout's
  coupon apply/remove).

Both `<button>` and `<a>` carry them — style both alike. States to cover:

- hover, `:focus-visible`, `:disabled`.
- **Form submit** (user, newsletter, withdrawal): while submitting the script sets `disabled` and
  swaps `[data-submit-text]` for `[data-submit-loading]` (two `<span>`s in the button, toggled with
  `hidden`) — the button must not change size noticeably. `user-reset`'s button starts `disabled`
  and is enabled once the URL has a token.
- **Checkout submit:** no text swap; `disabled` while totals recalculate and while submitting —
  `:disabled` must look inactive but stay legible.
- **Coupon buttons:** disabled while busy; apply/remove swap via `hidden` (remove starts hidden) —
  relies on the global `[hidden]` rule.

**Rule:** every `btn` element also has its **own class** (`<block>__<role>`, e.g.
`user-login__submit`, `checkout__submit`, `newsletter-signup__submit`) — the shared look goes on
`.btn`, a one-off change on the own class (no context selectors). **Component controls** keep only
their component class and are styled with their part: `.add-to-cart` (+ `.is-added`),
`.qty-control__btn`, `.cart-item__qty-btn`, `.cart-item__remove`, `.cart-sidebar__close`,
`.cart-toggle`, `.age-gate__btn--confirm|--deny`, `.newsletter-dialog__trigger|__close`,
`.product-filters__reset`, `.carousel__pause`, `.embla-thumbs__slide__number`, the lightbox trigger
`.<cls>__trigger`.

A class core adds later for customers to style goes on this list in the same change. A BEM class of
one component (`checkout__submit`) is not a look class.
