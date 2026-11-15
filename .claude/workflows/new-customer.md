# Workflow: starting a new customer (website or webshop)

How to set up a new customer project — a Sanity Studio backend + an Eleventy frontend, both
consuming core — from nothing to a first local build and a staging deploy. Entry point:
`/itsshops-new-customer` (`~/.claude/commands/`). Go-live itself is the
[go-live checklist](go-live-checklist.md); deploys and core pinning are
[consuming-core-and-deploy.md](consuming-core-and-deploy.md). This file links to them, it does not
repeat them.

**Principle:** a customer repo is *thin*. Behaviour lives in core; the customer holds config,
design tokens, template overrides, schema extensions and its own `CLAUDE.md`. Both repos are
**assembled from the starter** (`~/Documents/programming/jamstack/itsshops-starter`, private
`itsapps/itsshops-starter`): a parts library of tested base, variant, feature and module packages
plus a manifest. Everything copied belongs to the customer; core never reads it. Siblings under
`web/` are no longer copied — they stay a reference for wishes the library doesn't have (D.4).
Core gets only what more than one customer uses (core-front `CLAUDE.md` → "What goes into core").

Starter layout, package rules and checks: the starter's `CLAUDE.md`. UI parts' hooks, states and
a11y: [ui-contracts.md](../architecture/ui-contracts.md).

## D.0 Starter check — before the intake

- The checkout `~/Documents/programming/jamstack/itsshops-starter` exists — else hand the owner
  `! git clone git@github.com:itsapps/itsshops-starter.git ~/Documents/programming/jamstack/itsshops-starter`
  (own GitHub user).
- `git -C <starter> status --porcelain` is empty, and `git -C <starter> describe --tags
  --exact-match` names a release tag (that tag is `starterVersion`). Otherwise say which commit
  it is on and ask whether to go on (then `starterVersion` = the short hash).
- `manifest.json` → `core` (`{ front: "5.x", back: "6.x" }`) matches the majors in core-front's
  and core-back's `package.json` on `main`. On a mismatch, **stop** and say so: the starter needs a
  catch-up first (as plan step 7a: pins, CHANGELOG "Upgrading" notes, `npm run smoke`).
- `npm test` in the starter root passes (needs a root `npm install` once).

## D.1 Intake

Ask with `AskUserQuestion`, round by round, from `manifest.json` → `intake` (rounds → questions →
options); skip what `$ARGUMENTS` already answers. Rules (`manifest.json` → `intakeRules`):

- 1–4 questions per call, 2–4 options per question (an "Other" free-text option is added
  automatically), previews only on single-select questions, `header` ≤ 12 chars. A question with
  more than 4 options is split into consecutive questions of ≤ 4.
- `when` — `{ answer, is }` (that answer includes the option) or `{ package }` (chosen so far);
  skip the round/question when it fails (round 2 only for a shop, the cart-button question only
  with checkout).
- Option `needs` (coupons, stock, free-shipping products → checkout): drop the option and say so
  when its need isn't chosen.
- `collect: <placeholder>` (product kinds): join the chosen options' values into one TS array
  literal in option order (`['physical', 'wine']`); none chosen → the default.
- "Other" on locales: free text, first = default → `locales` (TS array literal), `localesText`
  (prose list), `defaultLocale`. "Other" elsewhere: a wish outside the library (D.4).
- A part with one variant is not asked (v1: the header, `header-inline` via base).

Round 1 basics (kind, locales, form of address, extras), round 2 shop (features, more shop,
product kinds, gallery), round 3 look (menus, width, cart button, footer), round 4 modules. Not
asked: `invoices` (wineNET-only, a project adds it by hand), newsletter captcha (library default
`captcha: false`), accounts (→ D.2 owner steps).

**Names** come with the plan (D.2), as free text: folder `web/<customer>/`, the two repo folders
(shops: `webshop-frontend` / `webshop-backend`; sites as the owner names them — siblings vary:
`webpage_*`, `frontend`/`backend`), `projectName` (slug), `projectTitle` (human name), domain,
company, Sanity project id (or "owner creates it" → placeholder until D.6).

## D.2 Plan + go-ahead

Show, then wait for the go-ahead before creating anything:

- the package list: chosen options' `packages` + `includes` (transitive), `needs` checked;
- the values that differ from the manifest defaults;
- target paths (`web/<customer>/<…>-frontend` + `…-backend`; refuse if either exists);
- the summed `rateLimitRules` → Netlify plan (≤ 2 Free/Personal, ≤ 5 Pro —
  [netlify-plans.md](netlify-plans.md)); the assembler prints the same sum;
- owner steps (D.6: accounts, Sanity project, PAT, Netlify projects, Stripe/mail/VinoFact);
- packages marked `untested` in the manifest (users, blog), if chosen.

## D.3 Assemble

1. Write the answers file to the scratchpad, in the fixtures' format
   (`<starter>/tests/fixtures/*.json`): `{ "packages": [...], "values": {...} }` — the chosen
   options' `packages` and `values`, plus `projectName`, `projectTitle`, `sanityProjectId`,
   `starterVersion` (D.0), `createdAt` (today, ISO date), the locale values (D.1).
2. `node <starter>/scripts/assemble.mjs --answers <file> --out <scratchpad>/<customer>` — it
   resolves `includes`, fails on a missing `needs` / `needsValues`, a file collision, a missing
   marker or an unfilled placeholder, and prints the rate-limit sum. **`--out` is wiped first**
   (`fs.rmSync`) — never point it at `web/`.
3. Move `<out>/frontend` → `web/<customer>/<…>-frontend` and `<out>/backend` → `…-backend`
   (refuse if a target exists); `git init` in both.
4. `grep -rn '%%[a-zA-Z]*%%\|starter:' <both folders>` must find nothing.
5. Backend `package.json`: `"dev": "sanity dev --port <free port>"` (base has plain `sanity dev`;
   pick a port no sibling Studio uses).
6. `.env` in both from their `.env-sample` (the keys are already right — packages added theirs):
   `SANITY_DATASET` / `SANITY_STUDIO_DATASET` = `development` until go-live; secrets filled by
   the owner or generated — `PREVIEW_SESSION_SECRET` with `openssl rand -base64 48`, written
   straight into the file, never printed. Key meanings: [configuration.md](../architecture/configuration.md)
   → "Env var → config field map".
7. **Core pin:** the assembled `package.json`s carry the tags the starter fits (e.g. `#5.2.0` /
   `#6.2.0`) — keep them; `npm install` in both pins that tag's commit in `package-lock.json`. A
   tag pin is fine for staging; only when a staging deploy needs unreleased core, switch once to
   floating (consuming doc → "Back from a tag to floating"). For local work on core, `npm link`
   (consuming doc → "Local development").

## D.4 Wishes outside the library

A header/footer/cart/module the library doesn't have (an "Other" answer, or a later wish): build
it from that part's contract in [ui-contracts.md](../architecture/ui-contracts.md), with the
starter's CSS rules (colour roles only, AA contrast, `:focus-visible` ring kept, motion only under
`prefers-reduced-motion: no-preference`, every contract state styled). A sibling under `web/` may
serve as reference — copy the idea, not its leftovers. Note in the customer `CLAUDE.md` that it
isn't a library variant. One that proves itself may go back into the starter as a plain variant.
A new page module follows the starter's frontend layout (starter `CLAUDE.md` → "Frontend
layout": `_config/modules/<type>.mts` + template + CSS of the same name, presets in
`image-sizes.mts`, strings in `translations.mts`).

The newsletter **footer dialog** is such a wish: core's footer has no slot, so build it from the
newsletter-dialog contract (rosi_schuster has one); the newsletter package keeps its CSS.

## D.5 Design pass

Run the `frontend-design` skill for palette, fonts and details on top of the plain defaults.
Tokens first (`src/_config/*`, `global/variables.css` — colour **roles**, never palette names in
block CSS), then block CSS, then overrides. Accessibility is mandatory (core-front `CLAUDE.md` →
"Accessibility"): AA contrast for every role pairing that carries text (light, dark, bands),
the base `:focus-visible` ring stays, headings in order (the page owns the `<h1>`).

## D.6 Accounts, first content, docs, staging

### 1. Accounts & services (owner or Claude, in this order)

1. **GitHub:** customer account (customer email); one repo each for frontend and backend; the
   developer is a collaborator. Create a PAT on the customer account for the `user` remote — it
   lives **only** in `.git/config`, never printed (`git remote`, not `git remote -v`).
2. **Sanity:** new project (plan: `netlify-plans.md` → "Sanity plan"), datasets `development`
   (now) and `production` (go-live). API token for the frontend `SANITY_TOKEN` — it must read
   drafts (preview); **Editor** if Claude is to write content with it (as on itsapps). CORS
   origins: the Studio URL, the frontend URL(s) and the local dev ports (`localhost:<SERVE_PORT>`,
   the Studio's `sanity dev` port) — with credentials for the Studio origins.
3. **Netlify** (customer account): a frontend and a Studio project **per environment** — staging
   pair first (builds `staging`, dataset `development`), production pair at go-live (builds
   `production`, dataset `production`); consuming doc → "Netlify projects per customer". On each
   frontend project create a **build hook** for its branch (Project configuration → Build hooks) —
   the Studio's Deploy button posts to it. Node.js major in the site settings (consuming
   doc → "Node.js version"). Plan from D.2.
4. **Shop only:** Stripe account (test mode first), email provider (`EMAIL_PROVIDER`, Resend or
   Mailgun), Supabase if `users`, VinoFact credentials if `vinofact`. Webhooks come later
   (go-live checklist).

Backend `.env`: public values only (`SANITY_STUDIO_*` is bundled into the Studio — never a token
or secret there, core-back `CLAUDE.md` rule); `SANITY_STUDIO_NETLIFY_SITE_ID` = the **frontend**
project of that environment (deploy-status badge). Credentials go into the Studio's
**Integrations** dialog (step 4).

### 2. First run & first content

- `npm install` in both (D.3 core pin).
- Backend: `npm run dev` → Studio opens; create **Settings** (site title, short description,
  **company** name/address/email — the privacy policy and mails need them), a home page, the
  privacy page with `privacyPolicyModule`, the main + footer menus (shop: the withdrawal and
  shipping pages, tax category, a shipping method, a product).
- Frontend: `npm run dev` → builds against `development`; then `npm test` (menu integrity +
  Eleventy smoke) and `npm run build`.

### 3. Customer docs

- Both `CLAUDE.md`s come assembled (features filled via `starter:claude-features`). Add
  "Status" (core pins, "built from starter `<starterVersion>`") and "Deploy" (branches, Netlify
  projects, `user` remote), plus anything built in D.4. Link to core docs — never explain core
  mechanisms there.
- Add the customer to the ecosystem table in core-front `CLAUDE.md` and to the "Active
  customers" line in `~/.claude/CLAUDE.md`.

### 4. Remotes & first staging deploy

- `origin` → customer repo (your own user, `main`); `user` → same repo with the customer PAT
  (`staging`/`production`). Push `main` via `origin`.
- Netlify env vars for **all scopes** (functions too) — except the secrets (`SERVER_FUNCTIONS_SECRET`,
  `PREVIEW_SESSION_SECRET`, generated per frontend project): **Functions** scope only;
  `SHOP_FORMALITY` before the first deploy (if "Du").
- Studio → toolbar **Integrations** (plug icon, administrators only), once per dataset: that
  environment's `SERVER_FUNCTIONS_SECRET` (checkout), its frontend's build hook URL, and the
  VinoFact token (vinofact shops).
- "release <customer> staging" (consuming doc → "Release flow"): the core tag pin from D.3 stays;
  move `staging`, hand over the `! git -C <repo> push user staging` lines — `user` pushes are the
  user's.
- Before production: the [go-live checklist](go-live-checklist.md), and a core **tag** pin
  (`production` never ships untagged core).

## D.7 Checks

- `npm run build` in both, `npm test` in both.
- Lighthouse accessibility on every page type (go-live checklist → "Tests"); cart (shop with
  checkout) and menu by keyboard.

## Done when

- [ ] Both repos build (`npm run build`) and `npm test` passes in both.
- [ ] No `%%…%%` or `starter:` left, no package the intake didn't choose (or `includes` pulled in).
- [ ] Feature flags match between frontend `Config` and backend `ItsshopsConfig` (the shop
      package writes every flag out on both sides; free-shipping products and product kinds are
      backend-only).
- [ ] Lighthouse accessibility checked on every page type (go-live checklist → "Tests").
- [ ] Both `CLAUDE.md`s have "Status" (core pins, built from starter `<tag>`) and "Deploy";
      ecosystem table + "Active customers" updated.
- [ ] Staging deployed from the `user` remote; Studio deploy button builds the frontend (build hook
      entered in Integrations); Presentation shows the home page (Safari too).
