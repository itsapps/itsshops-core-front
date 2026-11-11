# Compare a customer's build before/after a core CSS change

Use it when a customer switches core CSS (a core major, layered imports, a split/renamed core
file) or changes its own global rules. It proves the site still renders as before, without
screenshots. Established with the 4.0.0 switch (2026-11-11, tinhof + jurtschitsch). It found what
the plain CSS rule diff missed: a static `hidden` that now won, and global rules that beat core
under layers (`templates-and-assets.md` → "Cascade layers").

Work in a scratch dir, **not** in the customer repo: a build wipes `dist/`, which breaks a
running `npm run dev` there.

## 1. Two builds side by side

- **Old core:** `git worktree add --detach <scratch>/core-old <tag>` in core-front, symlink
  core's `node_modules` into it, `npm run build` there (`dist/` is not in git).
- **Customer "before":** `git worktree add --detach <scratch>/before main` in the customer repo.
  Its `node_modules/`: a folder of symlinks to every entry of the customer's `node_modules`
  except `@itsapps/`, plus `@itsapps/itsshops-core-front` → the old core worktree. Copy `.env`.
- **Customer "after":** `rsync` the working tree (without `node_modules`, `dist`, `.git`,
  `.netlify`) and symlink the customer's `node_modules` (core linked at the new version).
- Build both with the CLI of their own core: `node <core>/dist/itsshops.js eleventy --env=.env`
  (not `npx itsshops`: its `.bin` link points into the customer's `node_modules`).
- Baseline: pick the latest core tag, not an old staging pin, so the diff shows only the change
  under test. Sanity check: the "before" CSS matches the customer's last compiled
  `src/_includes/css/global.css`.

## 2. HTML diff of every page

Per `dist/**/*.html`: drop the inlined `<style>` blocks, one tag per line, `diff`. Count the
changed lines (`sort | uniq -c`) and account for each kind. Expected for a core change: the CSS
file hash and the markup the core release notes list.

## 3. Computed styles

Serve both `dist/` folders (a small Node static server, two ports). With Playwright
(`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i playwright` in the scratch dir;
`chromium.launch({ channel: 'chrome' })` uses the installed Chrome), at 390 and 1440 px, with
`reducedMotion: 'reduce'`, record for every `body *` element: all `getComputedStyle` properties,
those of `::before`/`::after` when they have content, and the rounded bounding box. Compare
element by element. Match by the **tag path**, not the classes (a core release may add classes).
Pages: home, shop, a product page that can be ordered, a text page, and the checkout. For the
checkout, click add-to-cart on the product page first and **wait until the cart is in
`localStorage`** (`itsshops_cart_<host>`): with a fixed wait one build sometimes renders an
empty cart, and the comparison then reports a whole different page.

Run it twice: real differences repeat, timing noise doesn't. Load-time states only. Focus, open
menus and the filter panel are still checked by hand in `npm run dev`.

## 4. Dead rules (optional, same session)

Take every class and `data-` attribute from the customer's **own** (unlayered) rules in the
compiled CSS. Look each up in the built HTML/JS (**excluding `*.css`**, or every rule finds
itself) and in the customer's and core's template/script sources. Not dead: names core builds
from a variable (`{{ class }}__option`, `` `checkout-totals__row--${…}` ``), state-only output
(sold-out label), classes the customer `@apply`s, Leaflet's runtime classes. Core never fetches
archived variants (`src/data/queries.ts`), so an `--archived` style never renders.
