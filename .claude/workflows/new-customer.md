# Workflow: starting a new customer (website or webshop)

How to set up a new customer project — a Sanity Studio backend + an Eleventy frontend, both
consuming core — from nothing to a first local build and a staging deploy. Entry point:
`/itsshops-new-customer` (`~/.claude/commands/`). Go-live itself is the
[go-live checklist](go-live-checklist.md); deploys and core pinning are
[consuming-core-and-deploy.md](consuming-core-and-deploy.md). This file links to them, it does not
repeat them.

**Principle:** a customer repo is *thin*. Behaviour lives in core; the customer holds config,
design tokens, template overrides, schema extensions and its own `CLAUDE.md`. Reuse order for
anything the design needs: **core → a sibling customer under `web/` → build new** (and core gets
only what more than one customer uses — see core-front `CLAUDE.md` → "What goes into core").

## 0. Intake — decide before creating anything

Ask the owner (one round, not piecemeal):

| Decision | Options / where it lands |
|---|---|
| Kind | **content site** (`features: {}`) or **shop** (`features.shop`) |
| Shop features | `checkout` (Stripe), `category`, `coupons`, `stock`, `manufacturer`, `vinofact`, `invoices`; `productKinds` (`wine`, `bundle`, …) — frontend `Config` and backend `ItsshopsConfig` (keep both in sync; the backend set is a superset) |
| Other features | `users` (Supabase), `newsletter` (+ captcha?), blog |
| Locales | UI + field locales, default locale (all customers so far: `de` default, `en`) |
| Form of address | `SHOP_FORMALITY` `formal` ("Sie", default) / `informal` ("Du") — `architecture/i18n.md` |
| Dark mode | `manifest.colorScheme` — only itsapps has it so far (theme toggle is site-only there) |
| Closest sibling | the template to copy the scaffold from (below) |
| Names | folder `web/<customer>/`, repo names, Sanity project name, domain |
| Accounts | customer GitHub + Netlify account under the customer's email (deploy identity, see consuming doc → "Deploy identity"); who creates the Sanity project |

**Sibling templates** (copy scaffolding from the closest, never from a dormant one without
checking it against current core):

| New customer is… | Copy from |
|---|---|
| Content site, no shop | `web/itsapps/{webpage_frontend,webpage_backend}` |
| Shop with Stripe checkout (wine) | `web/tinhof/{webshop-frontend,webshop-backend}` (live reference) |
| Shop with checkout + newsletter | `web/jurtschitsch/{webshop-frontend,webshop-backend}` |
| Catalog without checkout, vinofact, custom functions | `web/rosi_schuster/{itsshops_frontend,itsshops_backend}` |

Folder naming so far: `webshop-frontend` / `webshop-backend` for shops; keep that for new shops.

## 1. Accounts & services (owner or Claude, in this order)

1. **GitHub:** customer account (customer email); one repo each for frontend and backend; the
   developer is a collaborator. Create a PAT on the customer account for the `user` remote — it
   lives **only** in `.git/config`, never printed (`git remote`, not `git remote -v`).
2. **Sanity:** new project (plan: `netlify-plans.md` → "Sanity plan"), dataset `production`
   (optionally a second for dev). API token for the frontend `SANITY_TOKEN` — it must read
   drafts (preview); **Editor** if Claude is to write content with it (as on itsapps). CORS origins: the Studio URL, the
   frontend URL(s) and the local dev ports (`localhost:<SERVE_PORT>`, the Studio's `sanity dev`
   port) — with credentials for the Studio origins.
3. **Netlify** (customer account): a frontend and a Studio project **per environment** — staging
   pair first (builds `staging`, dataset `development`), production pair at go-live (builds
   `production`, dataset `production`); consuming doc → "Netlify projects per customer". On each
   frontend project create a **build hook** for its branch (Project configuration → Build hooks) —
   the Studio's Deploy button posts to it. Node.js major in the site settings (consuming
   doc → "Node.js version"). Plan: `netlify-plans.md`.
4. **Shop only:** Stripe account (test mode first), email provider (`EMAIL_PROVIDER`, Resend or
   Mailgun), Supabase if `users`, VinoFact credentials if `vinofact`. Webhooks come later
   (go-live checklist).

## 2. Backend (Sanity Studio)

Create `web/<customer>/<…>-backend`, `git init`, copy from the sibling **only** these files, then
strip everything customer-specific:

| File | What it holds |
|---|---|
| `package.json` | name/description; deps `@itsapps/itsshops-core-back` (git dep, see below), `sanity`, `react`, `react-dom`, `styled-components`, `react-icons`; scripts `dev` (`sanity dev --port <free port>`), `build`, `test` |
| `sanity.config.ts` | `createItsshopsWorkspaces(config)` with `workspaceIcon`, `features`, `i18n`, `documents`, `objects`, `structure`, `schemaExtensions`, `schemaSettings` (menus `allowedReferences`, `productKinds`) |
| `sanity.cli.ts` | `api` from `SANITY_STUDIO_PROJECT`/`SANITY_STUDIO_DATASET` + the vite **dedupe** — keep it (core-back `plugin-and-config.md` → "npm-link gotcha") |
| `src/schema/index.ts` | `documents` / `objects` arrays — start empty (`[]`) |
| `src/schema/extensions.ts` | `schemaExtensions` — at least `page.modules` listing the modules this site uses (core modules like `privacyPolicyModule`; a shop also `withdrawalPolicyModule`, `shippingInfoModule`) |
| `src/structure/index.ts` | `structure: ITSStructureItem[] = []` |
| `src/translation/{index,de,en}.ts` | `i18n` (`ui`, `fields`, `defaultLocale`, `localizedFieldTypes`, overrides) |
| `netlify.toml` | Studio SPA: `npm run build` → `dist`, `/* → /` 200 rewrite |
| `.env` (gitignored) | public values only: `SANITY_STUDIO_PROJECT`, `SANITY_STUDIO_DATASET`, `SANITY_STUDIO_WORKSPACE_NAME`, `SANITY_STUDIO_NETLIFY_SITE_ID` (the **frontend** project of that environment — deploy-status badge) / `_PROJECT_NAME`, shop: `SANITY_STUDIO_NETLIFY_FUNCTIONS_ENDPOINT`, `SANITY_STUDIO_VINOFACT_API_URL` / `_PROFILE_SLUG`. **Every `SANITY_STUDIO_*` value is public** (bundled) — never a token or secret there (core-back `CLAUDE.md` rule). Credentials go into the Studio's **Integrations dialog** (step 7). Test-only: `VINOFACT_API_TOKEN` (no prefix → not bundled) |
| `tests/`, `vitest.config.ts`, `tsconfig.json`, `.gitignore` | as the sibling |

Schema/structure details: core-back `CLAUDE.md` + `.claude/architecture/` (schema-authoring,
studio-structure, localization). Customer-only schema objects go under `src/schema/objects/`.

## 3. Frontend (Eleventy)

Create `web/<customer>/<…>-frontend`, `git init`, copy from the sibling:

| File | What it holds |
|---|---|
| `package.json` | name/description; scripts exactly as siblings (`clean`, `predev`, `dev`, `preview`, `maintenance`, `build`, `netlify`, `test`) — all call the `itsshops` CLI; deps `@11ty/eleventy`, `@itsapps/itsshops-core-front`, `@netlify/functions`, `tsx`; dev `@types/node`, `dotenv`, `vitest`; `engines.node >=22` |
| `eleventy.config.mts` | `export default createEleventyConfig(projectConfig)` (optional callback for customer filters/global data) |
| `itsshops.config.mts` | `Config`: `features`, `css: { colors, fontFamilies, textSizes }`, `imageSizes`, `extensions`, `translations` (`customer.*` strings), `headers.extra` only for external hosts, `menu` — reference: `architecture/configuration.md` |
| `src/_config/colors.mts`, `fonts.mts`, `text-sizes.mts` | design tokens (Tailwind is generated from them — `templates-and-assets.md` → "Token-driven Tailwind"); `extensions.mts` (`queries`, `resolveData`, `modules.page.<type>` projections — `architecture/extending.md`) |
| `src/assets/css/global/global.css` | the CSS entry: `@import` core's `dist/reset.css` + `dist/base.css` (+ `carousel.css`/`shop.css`/… per feature — `templates-and-assets.md` → "Importable core CSS files"; all `@import`s before any other statement), then core's `dist/tailwind-components.css`, `global/`, `blocks/*`, core's `dist/utilities.css`, core's `dist/tailwind-utilities.css` (no local copies of those). Layered core imports as in that section's example; itsapps is the reference entry. Copy the sibling's structure, **not** its block styles |
| `src/assets/fonts/preload/*.woff2` | every file here is preloaded — only the fonts used above the fold |
| `src/assets/images/favicon/*` | favicon set (served at `/`) |
| `src/assets/scripts/index.ts` | customer client JS entry (may be empty) |
| `src/_includes/overridable/` | **only** the templates this design really overrides (header, footer, modules) — start with none and add as needed (`templates-and-assets.md` → "Template system") |
| `netlify/functions/preview.mts` + `preview_enable.mts` | the preview wrappers (identical in every customer; paths: `commerce-and-netlify.md` → "Draft preview"); shop: the function wrappers its features need (catalog: `commerce-and-netlify.md`; Tinhof/Jurtschitsch show the set) |
| `netlify.toml` | `npx itsshops init` writes the default; Rosi Schuster's adds `!node_modules/…` excludes to keep the preview function small — copy those if the bundle gets large |
| `tests/` + `vitest.config.ts` | `setup.ts` (dotenv), `utils/sanity.ts`, `dataset/menu.test.ts`, `unit/eleventy-run.test.ts`, `unit/translators.test.ts` — as the sibling |
| `.gitignore` | as the sibling (`.env*`, `dist`, `node_modules`, `src/_includes/css`, `src/_includes/scripts` — generated) |
| `.env` (gitignored) | copy the sibling's **keys**, never its values: `URL`/`PUBLIC_URL`, `SERVE_*`, `SANITY_PROJECT_ID`/`SANITY_DATASET`/`SANITY_TOKEN`/`SANITY_STUDIO_URL`, `SERVER_FUNCTIONS_SECRET`/`SERVER_FUNCTIONS_ALLOWED_ORIGINS`, `SUPPORT_EMAIL`, `DEVELOPER_EMAIL`, `PUBLIC_DEVELOPER_*`, `EMAIL_PROVIDER` + key; shop: `STRIPE_*`, `SHOP_FORMALITY`, `VINOFACT_*`, `WC_*`, `CAPTCHA_*` — meaning of each: `architecture/configuration.md` → "Env var → config field map" |

**Copying is the fast path, and the trap.** After copying, grep the new repos for the sibling's
name, domain, colours, module names, `customer.*` strings, Studio/project ids and email
addresses, and delete every override/block/function the new customer doesn't need. The itsapps
site was copied from Tinhof/fem_innenarchitektur and carried leftovers for months.

## 4. Core dependency & first run

- Both repos: core as a **git dependency** with no committish while not live
  (`npm install 'github:itsapps/itsshops-core-front'` / `…-core-back`), then `npm link` for dev —
  consuming doc → "Local development". No yalc, no registry.
- Backend: `npm run dev` → Studio opens; create **Settings** (site title, short description,
  **company** name/address/email — the privacy policy and mails need them), a home page, the
  privacy page with `privacyPolicyModule`, the main + footer menus.
- Frontend: `npm run dev` → builds against the dataset; then `npm test` (menu integrity +
  Eleventy smoke) and `npm run build`.

## 5. Design

Run the `frontend-design` skill for the visual direction before writing CSS. Tokens first
(`src/_config/*`, `global/variables.css`), then block CSS, then overrides. Accessibility is
mandatory (core-front `CLAUDE.md` → "Accessibility"): AA contrast for every token pairing used for
text, `:focus-visible` outline (the jurtschitsch / rosi_schuster / itsapps pattern), headings in
order, `prefers-reduced-motion`.

## 6. Customer docs

- `CLAUDE.md` in **both** repos, thin, same shape as the siblings: one-paragraph "what this is",
  `@`-import of the core `CLAUDE.md`, "Before you start", "Wired & features" (config, flags,
  overrides, extensions), "Status" (core versions pinned), "Deploy" (branches, Netlify sites,
  `user` remote). Link to core docs — never explain core mechanisms there.
- Add the customer to the ecosystem table in core-front `CLAUDE.md` and, if active, to the
  "Active customers" line in `~/.claude/CLAUDE.md`.

## 7. Remotes & first staging deploy

- `origin` → customer repo (your own user, `main`); `user` → same repo with the customer PAT
  (`staging`/`production`). Push `main` via `origin`.
- Netlify env vars for **all scopes** (functions too) — except the secrets (`SERVER_FUNCTIONS_SECRET`,
  `PREVIEW_SESSION_SECRET`, generated per frontend project): **Functions** scope only;
  `SHOP_FORMALITY` before the first deploy.
- Studio → toolbar **Integrations** (plug icon, administrators only), once per dataset: that
  environment's `SERVER_FUNCTIONS_SECRET`, its frontend's build hook URL, and the Vinofact token
  (vinofact shops).
- "release <customer> staging" (consuming doc → "Release flow"): pin core commit hashes, move
  `staging`, hand over the `! git -C <repo> push user staging` lines — `user` pushes are the
  user's.
- Before production: the [go-live checklist](go-live-checklist.md), and a core **tag** pin
  (`production` never ships untagged core).

## Done when

- [ ] Both repos build (`npm run build`) and `npm test` passes in the frontend.
- [ ] No sibling leftovers (names, domains, ids, unused overrides/functions/modules).
- [ ] Feature flags match between frontend `Config` and backend `ItsshopsConfig`.
- [ ] Lighthouse accessibility checked on every page type (go-live checklist → "Tests").
- [ ] Both `CLAUDE.md`s written; ecosystem table updated.
- [ ] Staging deployed from the `user` remote; Studio deploy button builds the frontend (build hook
      entered in Integrations); Presentation shows the home page (Safari too).
