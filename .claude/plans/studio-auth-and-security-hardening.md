# Plan — No secrets in the Studio bundle + security hardening (core-back + core-front)

Status: **proposed** (2026-11-11). Not started. Spans core-back and core-front; every shop benefits,
so all of it is core. The only customer-side work is env/setup and token rotation.

Trigger: the maintainer of the old ffmh shop reported 9 issues. An audit of core on 2026-11-11
found: #1 Netlify PAT in the Studio bundle and #2 shared `x-server-secret` in the bundle (both
**present**), #5 preview unauthenticated/unvalidated (**present**), #8 open redirect after login
(**present**). #3, #4, #6, #7 and #9 do not apply (see "Not affected"). The audit also found extras
that weren't in the email: the Vinofact token in the bundle, refunds keyed by any PaymentIntent id,
and no Stripe idempotency key.

Done already: the Tinhof Netlify PAT was revoked (2026-11-11). Tinhof's Studio deploy button is
broken until this ships; deploy from Netlify meanwhile.

## Root cause and principle

The Studio is a **public single-page app**. Every `SANITY_STUDIO_*` env var, and anything a customer
writes into `sanity.config.ts`, is compiled into JS that anyone can download from the Studio's URL
without logging in. The Sanity login protects the **data**, not the code. The `SANITY_STUDIO_`
prefix means "public," like `NEXT_PUBLIC_`; Sanity isn't at fault, our usage was.

Rules after this plan:
1. **Never put a credential in `SANITY_STUDIO_*` or in Studio config.** Only public values: project
   id, dataset, frontend endpoint URL, Netlify site id / project name, Vinofact endpoint + profile
   slug.
2. Values the Studio must send go into the dataset through **`@sanity/studio-secrets`** (Sanity's own
   package). Logged-in project members can read them; the internet can't.
3. Credentials that even editors must not hold (an account-wide Netlify PAT) are **not used at
   all**. Pick the narrowest-scoped mechanism instead (a build hook).
4. The server still validates everything: a leaked or misused secret must never allow more than the
   UI allows.

## A. Secrets document via `@sanity/studio-secrets` (fixes #2 and the Vinofact leak)

`@sanity/studio-secrets` (sanity-io/plugins, v4.x, peer `sanity ^5 || ^6`, React 19) stores values
in a document `secrets.<namespace>` (type `pluginSecrets`) in the dataset. Thanks to the dotted id,
it **isn't readable without a login, even in a public dataset**; only logged-in users with read
access can read it. The API is `useSecrets(namespace)` plus a ready-made `SettingsView` dialog for
entering the values.

core-back:
- Add the dependency. One namespace, `itsshops`, with these keys:
  - `functionsSecret`: the shared secret for `/api/payment/refund`, `/api/order/notify`,
    `/api/order/withdraw-notify` (server side unchanged: `requireServerSecret` /
    `SERVER_FUNCTIONS_SECRET`);
  - `netlifyBuildHook`: see B;
  - `vinofactToken`: only when `shop.vinofact` is on.
- `ITSCoreProvider`: create `frontendClient` / `vinofactClient` from `useSecrets('itsshops')`
  instead of `config.integrations`. While the secrets are loading or missing, the client is `null`
  and the existing "not initialized" toasts apply (extend them with "ask an admin to enter
  the integration settings").
- An **"Integrations" settings dialog** (`SettingsView`), reachable from the deploy/tool menu and
  shown to administrators only (`useCurrentUser().roles`). This hides it in the UI only; any member
  can still read the secrets document.
- Remove `SANITY_STUDIO_NETLIFY_ACCESS_TOKEN`, `SANITY_STUDIO_NETLIFY_FUNCTIONS_SECRET` and
  `SANITY_STUDIO_VINOFACT_API_TOKEN` from `config/mapper.ts`. These are the only secrets among the
  Studio vars of the active customers (checked 2026-11-11). Public vars that stay: `PROJECT`,
  `DATASET`, `WORKSPACE_NAME`, `USE_ADMIN_UI`, `NETLIFY_SITE_ID`, `NETLIFY_PROJECT_NAME`,
  `NETLIFY_FUNCTIONS_ENDPOINT`, `VINOFACT_API_URL`, `VINOFACT_PROFILE_SLUG`. Remove `accessToken` from the
  `integrations.vinofact` **config type** too (a token passed inline in `sanity.config.ts` is
  bundled just the same). `external/netlify.ts` goes away (B).
- `external/frontend.ts` keeps the `x-server-secret` header, now taken from the secrets document.

Trade-offs (accepted):
- Every logged-in project member, **viewers included**, can read the secrets in their browser.
  Members are the shop's own people plus us. Custom roles that restrict this need an Enterprise plan.
- Secrets live **per dataset**. A shop with staging + production datasets enters them in both.
- The document is **included in dataset exports**. Our weekly full backups contain it; they're
  encrypted, so whoever holds the backup key holds the secrets too. Note this in
  `sanity-dataset-backups.md`.
- Sanity says it will deprecate the package once native server-side secrets exist, with a migration
  path. Fine: it's one hook to swap.

## B. Deploys without a Netlify PAT (fixes #1)

A Netlify PAT is **account-wide** (every site, env vars that hold `SANITY_TOKEN`/Stripe/Supabase
keys, deploys). It must not be in the bundle, and not in the secrets document either.
`sanity-plugin-netlify` was checked and rejected: it stores a PAT in a dataset doc and calls
`api.netlify.com` from the browser; its peer deps are `sanity ^3 || ^5`, not 6.

- **Trigger:** `POST <netlifyBuildHook>?trigger_title=<title>` straight from the Studio. A build hook
  can only start a build of one site/branch. If it leaks, someone can start builds, which costs
  credits, but can't read or change anything. Netlify can regenerate it.
- **Status:** Netlify's **public deploy-status badge**
  (`https://api.netlify.com/api/v1/badges/<siteId>/deploy-status`, an SVG, no token) is shown in the
  DeployDialog with a cache-busting query, refreshed every ~10 s while the dialog is open. It
  replaces the PAT-based "latest build" call. `siteId` is public and stays in
  `SANITY_STUDIO_NETLIFY_SITE_ID`.
  - **Limitation:** the Studio can only *display* the image, not read its state (a cross-origin
    SVG). So there's no "building" lock on the Deploy button and no "done" toast, which the PAT
    version has today.
  - **Upgrade path, if editors miss that: server proxy.** The PAT goes in the **shop's server env**
    (`NETLIFY_ACCESS_TOKEN`, Functions scope) and a core-front function `/api/studio/deploy` does
    exactly three things with it: latest build, trigger, cancel. It's authenticated like refund/mail
    (`x-server-secret` from the secrets doc + CORS allowlist). Editors can only do those three
    things; the PAT never reaches the browser. Anyone who can read the server env is a Netlify
    member already. This brings back the full status (building lock, done toast) and cancel. It's
    the same idea as ffmh's `/api/deploy`.
  - Rejected: storing the PAT in the secrets doc (every editor, and every script in the Studio,
    could read an account-wide token, which means the shop's server keys plus deploying their own
    code); and a signed Netlify deploy notification writing a status doc (one function plus a
    Netlify setting per site, and still no cancel).
- **"Open in Netlify"** link stays (`SANITY_STUDIO_NETLIFY_PROJECT_NAME`).
- **Cancel deploy is dropped** (rare; editors cancel in Netlify).
- Spike: [ ] Can the Studio `POST` the build hook cross-origin (CORS), or does it need `no-cors`
  (fire and forget is enough; the badge shows the result)? [ ] Does the badge follow the hook's
  branch, or only production? If only production, show it only for hooks on the production
  branch.

## C. Refunds and mails: server-side guards (defence in depth for A)

Editors (and anyone who steals an editor's session) can read `functionsSecret`, so the endpoints
must refuse anything the UI wouldn't do:
- `payment-refund`: the request takes an **`orderId`**, and the server reads the PaymentIntent
  from the order. Today any PaymentIntent on the Stripe account can be refunded. Cap `amount` at
  what's left to refund (from Stripe / `order.refunds`). Pass a Stripe **`idempotencyKey`**: the
  Studio generates one per refund dialog submission and reuses it on retry, so a double-click can't
  refund twice.
- `order-notify`: `customerMessage` is free text sent from the shop's real address, so cap its
  length and keep it plain text (no links rendered as HTML). It stays the editor's feature.
- Rotate `SERVER_FUNCTIONS_SECRET` at release (the old one is in old bundles): generate a new one,
  put it in Netlify env (Functions scope) and in the secrets document.

## D. Preview (#5)

Today `/api/preview/:locale/:type/:id` renders **drafts** for anyone and accepts any perspective
string. Its error path echoes `documentType` into a `text/html` response, which is a probable
reflected XSS on the shop origin. Function responses don't get `_headers`/CSP.

Use **Sanity's own preview secret** (Presentation `previewMode` + `@sanity/preview-url-secret`),
the standard mechanism:
1. core-back `presentation/index.ts`: `previewUrl.previewMode: { enable: '/api/preview/enable' }`.
   Presentation creates a short-lived secret doc and opens
   `<enable>?sanity-preview-secret=…&sanity-preview-pathname=…`.
2. core-front `preview-enable` function: `validatePreviewUrl(clientWithToken, url)` → set cookie
   `itsshops_preview` = HMAC-signed `{exp, perspective}` (`PREVIEW_SESSION_SECRET`, server only;
   `HttpOnly; Secure; SameSite=None; Partitioned`, because the preview runs in the Studio's
   cross-site iframe) → redirect to the pathname (must start with `/api/preview/`).
3. `preview` function: no valid cookie → 401 page "open the preview from the Studio".
4. Validate params: `locale` ∈ configured locales, `documentType` ∈ preview types, `documentId`
   matches `^[A-Za-z0-9_.-]{1,128}$`, perspective ∈ `drafts | published`. Bad input → 400, fixed
   text.
5. Errors: log the details, return a generic message, never echo input into HTML.
6. Headers: `Content-Security-Policy: frame-ancestors <studio origins>` (same list as
   `SERVER_FUNCTIONS_ALLOWED_ORIGINS`), `X-Robots-Tag: noindex`, `Cache-Control: private, no-store`.
7. Cleanup (not a vulnerability; a function instance serves one request at a time): pass preview
   params into Eleventy without mutating `process.env`.

Spikes: [ ] Is the `Partitioned` cookie kept inside the Presentation iframe in Safari? If not,
fallback: a short-lived signed `?pt=` token in the URL. [ ] Does `@sanity/preview-url-secret` load in
a Netlify function (`npm run check:functions`)?

## E. Login redirect (#8)

`src/scripts/user-login.ts:64` redirects to `?next=` unchecked (open redirect; `javascript:` blocked
only by CSP). Phishing scenario: `https://<shop>/de/login/?next=https://<lookalike>/` shows the real
login, then hands the customer to a fake "session expired, re-enter password" page. Core never
generates `?next=` links itself (checked 2026-11-11), so today only hand-crafted links reach it.
It stays anyway, because customers may use it (e.g. Rosi's register-only flow). Add a shared helper `safeRedirectPath(next, origin)` in `src/shared/`: resolve against
the origin, require the same origin and `http(s)`, return `pathname+search+hash`, otherwise locale
home. Drop the extra `decodeURIComponent`. Use it for every redirect target that comes from a URL or
an API response. Unit tests: `//evil.com`, `/\evil.com`, `https://evil.com`, `javascript:…`, encoded
variants. Logout is fine (`SameSite=Strict`); optional: allow only POST.

## F. Smaller hardening (same release)

- `wc-api` `authenticate`: constant-time comparison (`timingSafeEqual`; timing attacks over the
  internet are theoretical, but it's one line); `try/catch` around `atob` (a malformed Basic header
  currently throws → 500, should be 401). Query-param keys stay (WooCommerce compatibility for
  wineNET). The function doesn't log the URL (checked 2026-11-11), so keep it that way.
- `wc-api` `after`/`before`: an invalid date currently throws in `toISOString()` → return 400.

## Not affected (audit 2026-11-11)

- #3 identity from the request body: checkout doesn't link orders to a user. The order comes from
  the Stripe webhook through server-set `orderMetaId` metadata.
- #4 GROQ injection: all request input goes in through `$params`. `wc-api.ts:557` only joins fixed
  filter strings.
- #6 proof path: no endpoint serves documents. `order-status` returns only the order number for an
  unguessable PaymentIntent id.
- #7 `isJsonRequest`: no such helper. `payment-create` parses with `try/catch`.
- #9 leftover orderMeta: `order-meta-cleanup` exists.

## Later option (not in this plan): action documents

If per-user identity, an audit log or admin-only refunds are ever wanted: the Studio writes an
`itsshops-action.<uuid>` doc with the editor's session, the server reads it with `SANITY_TOKEN`,
claims it atomically (`ifRevisionId`), takes the author from the transaction history, runs the
action and writes the result back. That replaces the shared secret entirely. Designed 2026-11-11 and
set aside as more machinery than the leak needs.

## Rollout

**Branching (decided 2026-11-11):** Tinhof pins core-front `4.0.0` (= `main`) and core-back
`5.4.0`. core-back `main` has unreleased menu levels, which are a no-op for Tinhof (no submenus,
`maxDepth: 1`, no `disableSubmenus`; only jurtschitsch migrates). So there are no hotfix branches:
- implement on `feature/security-hardening` (both repos) from `main` → merge into `main` → cut
  core releases (both major; core-back's includes menu levels) → Tinhof **staging** (pin, enter
  secrets, env, test) → Tinhof **production** → rotate + redeploy the Studio;
- core-front `main` already contains customer-starter's core changes (merged 2026-11-11: the
  `search.json` gate and menu `maxDepth` = levels, both CHANGELOG `4.0.1`). They belong in the same
  release as core-back's menu levels, so that both sides mean the same by `maxDepth`. Later
  customer-starter work merges as usual; check before the release that `main` holds nothing
  half-done.
- Interim until the release: optionally remove Tinhof's `payment_refund.mts` (and
  `order_notify.mts`); refunds then go through the Stripe dashboard, and the webhook syncs them.

1. Spikes (B, D) → update this plan.
2. core-front: C (refund by order, cap, idempotency; mail message guard), D, E, F. Vitest for each
   (jsdom for the redirect helper). `npm run check:functions`.
3. core-back: A (studio-secrets, settings dialog, clients from secrets, remove env/config
   tokens), B (build hook + badge, drop `external/netlify.ts` and cancel), Presentation `previewMode`.
4. One release, **breaking** (`CHANGELOG.md`). Customers must:
   - add the wrapper `netlify/functions/preview_enable.mts`; set `PREVIEW_SESSION_SECRET`;
   - rotate `SERVER_FUNCTIONS_SECRET`;
   - create a Netlify build hook;
   - enter `functionsSecret`, `netlifyBuildHook` and `vinofactToken` in the Studio's Integrations
     dialog (per dataset);
   - remove every `SANITY_STUDIO_*` secret from `.env*` **and** from the Studio site's Netlify env;
   - `sanity deploy` / redeploy the Studio so the old bundle is replaced.
5. Order: **Tinhof** (live) → Jurtschitsch → Rosi Schuster. Dormant customers get it when work
   resumes, but **revoke their Netlify PATs now** if their Studios are still online (a PAT covers
   every site in its account).
6. Rotate after release: the Vinofact token (in the Tinhof + Jurtschitsch bundles; ask Vinofact what
   it allows, and rotate immediately if it can write). For Tinhof: check the Netlify audit log,
   Stripe refunds and Resend for activity nobody caused; if anything shows up, rotate the server
   keys the PAT could read (`SANITY_TOKEN`, Stripe, Supabase, Resend).
7. Docs: core-back `plugin-and-config.md` (rule 1, secrets namespace); core-front
   `commerce-and-netlify.md` (refund contract), `csp-and-headers.md` (preview headers),
   `configuration.md` (env), `new-customer.md` + `go-live-checklist.md` (build hook, Integrations
   dialog, no Studio secrets), `sanity-dataset-backups.md` (backups contain the secrets doc); a
   decision record `decisions/studio-secrets-in-dataset.md`; and rule 1 in core-front `CLAUDE.md` +
   core-back `CLAUDE.md`.
