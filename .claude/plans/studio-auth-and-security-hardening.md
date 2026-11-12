# Plan — No secrets in the Studio bundle + security hardening (core-back + core-front)

Status: **proposed** (2026-11-11; refined 2026-11-11 against the code — A's client wiring, C's
contract, D's cookie/route and the rollout corrected; refined again 2026-11-11 — A's missing-secret
message wiring, WineTab path, D's locale/perspective handling, frame-ancestors fallback, tests for
C/D/F against the existing test files; 2026-11-12 — spikes B1/B2/D2 done, four Netlify projects
per customer folded into the rollout, D1 moved into implementation; refined 2026-11-12 — A's
`@sanity/ui` bump + `SettingsView` wiring, C's idempotency key from the refund count, D's lazy
client, preview share access off). Not started. Spans core-back and core-front;
every shop benefits, so all of it is core. The only customer-side work is env/setup, one new
function wrapper and token rotation.

Trigger: the maintainer of the old ffmh shop reported 9 issues. An audit of core on 2026-11-11
found: #1 Netlify PAT in the Studio bundle and #2 shared `x-server-secret` in the bundle (both
**present**), #5 preview unauthenticated/unvalidated (**present**), #8 open redirect after login
(**present**). #3, #4, #6, #7 and #9 do not apply (see "Not affected"). The audit also found extras
that weren't in the email: the Vinofact token in the bundle, refunds keyed by any PaymentIntent id,
and no Stripe idempotency key.

Done already: the Tinhof Netlify PAT was revoked (2026-11-11). Tinhof's Studio deploy button is
broken until this ships; deploy from Netlify meanwhile.

**Done 2026-11-11 (owner):** **all** customers' Netlify PATs revoked (Jurtschitsch and Rosi
Schuster had `SANITY_STUDIO_NETLIFY_ACCESS_TOKEN` in their Studio bundles too). Every Studio deploy
button is broken until this ships. Netlify keeps **every old deploy** reachable at its permalink
(`<deploy-id>--<site>.netlify.app`), so a redeploy never removes a leaked value — only rotation
does; that's why `SERVER_FUNCTIONS_SECRET` and the Vinofact token are rotated too.

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

`@sanity/studio-secrets` (sanity-io/plugins, v4.0.25 checked 2026-11-11, peer `sanity ^5 || ^6`,
React `^19.2`, depends on `@sanity/ui ^4`) stores values
in a document `secrets.<namespace>` (type `pluginSecrets`) in the dataset. Thanks to the dotted id,
it **isn't readable without a login, even in a public dataset**; only logged-in users with read
access can read it. The API is `useSecrets(namespace)` plus a ready-made `SettingsView` dialog for
entering the values.

core-back:
- Add the dependency (`^4.0.25`). It depends on `@sanity/ui ^4.4.10`, but core-back declares
  `^4.0.0` and has `4.0.3` installed: raise core-back's `@sanity/ui` to `^4.4.10` in the same
  commit, then `npm ls @sanity/ui` must show **one** copy (in core-back and in each customer
  backend after the pin) — two copies split the theme context. The package's `dist` imports
  `@sanity/ui/styles.css` (side-effect import; the Studio's Vite handles it, nothing to configure).
  API (checked in the 4.0.25 typings): `useSecrets<T>(ns) → { loading, secrets?: T, storeSecrets }`,
  `SettingsView({ title, namespace, keys: { key, title, description? }[], onClose })`, which
  renders its **own** `Dialog` with labelled inputs (`htmlFor`). One namespace, `itsshops`, with
  these keys:
  - `functionsSecret`: the shared secret for `/api/payment/refund`, `/api/order/notify`,
    `/api/order/withdraw-notify` (server side unchanged: `requireServerSecret` /
    `SERVER_FUNCTIONS_SECRET`);
  - `netlifyBuildHook`: see B;
  - `vinofactToken`: only when `shop.vinofact` is on.
- `src/context/ITSCoreProvider.tsx`: read `const { secrets, loading } = useSecrets('itsshops')`.
  - `frontendClient` stays **non-nullable** (`ITSContext.frontendClient: ITSFrontendClient`, used
    without null checks in `OrderActions`, `OrderMailAction`, `WithdrawalActions` ×4 and
    `lib/shop/orderRefund.ts`). Build it as
    `createFrontendClient(locale, endpoint, secrets?.functionsSecret ?? '',
    ctx.componentT.default('integrations.missingSecrets'))` — a new 4th param
    `missingSecretMessage: string`, because `createFrontendClient` has no translator today. In
    `external/frontend.ts` `post()` returns `{ error: missingSecretMessage }` **without fetching**
    when `secret` is empty. The callers already show `result.error` in a toast, so no call site
    changes. While `useSecrets` is still `loading` the secret is empty too, so an action fired in
    that first moment gets the same message — acceptable, no extra state. (There is no "not
    initialized" toast for this client today — only the Vinofact one has it.) Add
    `secrets?.functionsSecret` to the `useMemo` deps.
  - `vinofactClient` stays `undefined` until `secrets.vinofactToken` is there (as today without a
    token); build it from `ctx.config.integrations.vinofact` (endpoint, profileSlug) +
    `secrets.vinofactToken`. Two toasts show the missing client:
    `src/components/products/productManager/tabs/WineTab.tsx` already uses
    `componentT.default('vinofact.notInitialized.title'/'.description')`;
    `src/components/products/WineSelector.tsx` hard-codes the same title and description in
    English (and its fetch-error toast: `'Fetch Failed'` / `'Failed to fetch wines from
    Vinofact.'`). Change the `vinofact.notInitialized.description` text (de + en,
    `localization/resources/components_{de,en}.ts`) to "…or ask an administrator to enter the
    integration settings", and switch `WineSelector` to `componentT` (take it from
    `useITSContext()`): the two `notInitialized` keys, and `vinofact.winesLoadedError.title` for
    the fetch-error toast (description stays `err.message`). Also fix `WineTab.tsx:252`: its
    fetch-error toast title uses `vinofact.winesLoadedError.description`, a key that doesn't exist
    (de/en only have `.title`) → `.title`.
  - New i18n keys (de + en) in core-back's component translations: `integrations.*` (dialog title,
    key titles/descriptions, the missing-secrets message).
- An **"Integrations" button + `SettingsView` dialog** in `src/components/CustomToolbar.tsx` next to
  `<DeployDialog />` (new component `IntegrationsDialog.tsx`: a `Button` + `{open && <SettingsView
  title namespace="itsshops" keys onClose={() => setOpen(false)} />}` — no own `Dialog`, since
  `SettingsView` brings one), rendered only when
  `useCurrentUser()?.roles.some(r => r.name === 'administrator')`. This hides it in the UI only; any
  member can still read the secrets document. Keys: `functionsSecret` and `netlifyBuildHook`
  always, `vinofactToken` only when `features.shop.vinofact.enabled`. The toolbar button is
  icon-only like the deploy button → it gets a translated `title` **and** `aria-label`; icon from
  `src/assets/icons.ts` (central icons rule).
- `src/config/mapper.ts`: drop `netlify.accessToken`, `netlify.secret` and the Vinofact
  `accessToken` env read. Types in `src/types/config.ts`: remove `accessToken` + `secret` from
  `NetlifyConfig`, `accessToken` from `VinofactIntegrationConfig` (also the input type of
  `ItsshopsConfig.integrations.vinofact` — a token passed inline in `sanity.config.ts` is bundled
  just the same); fix the `IntegrationsConfig` comment ("`secret` must match …"). These are the only
  secrets among the Studio vars of the active customers (checked 2026-11-11). Public vars that stay:
  `PROJECT`, `DATASET`, `WORKSPACE_NAME`, `USE_ADMIN_UI`, `NETLIFY_SITE_ID`, `NETLIFY_PROJECT_NAME`,
  `NETLIFY_FUNCTIONS_ENDPOINT`, `VINOFACT_API_URL`, `VINOFACT_PROFILE_SLUG`.
- `src/external/netlify.ts` and `src/types/netlify.ts` (it holds only `NetlifyClient` and
  `NetlifyBuild`) are deleted, with their `export * from './netlify'` lines in
  `src/external/index.ts` **and** `src/types/index.ts` (B). `./external` is a public
  package export → breaking; no active customer imports `createNetlifyClient` (checked
  2026-11-11; Tinhof's and Rosi's `tests/utils/vinofact.ts` import only `createVinofactClient`).
- **Test-only token:** core-back `tests/vinofact.test.ts` and the customers'
  `tests/utils/vinofact.ts` (Tinhof, Rosi) read `SANITY_STUDIO_VINOFACT_API_TOKEN` from `.env`. The
  Sanity build bundles every `SANITY_STUDIO_*` in `.env`, so the token can't stay there under that
  name. Rename it to `VINOFACT_API_TOKEN` (no prefix → not bundled) in those tests and `.env` files;
  update core-back `CLAUDE.md` ("Commands" → `npm run test` line).
- `external/frontend.ts` keeps the `x-server-secret` header, now taken from the secrets document.

Trade-offs (accepted):
- Every logged-in project member, **viewers included**, can read the secrets in their browser.
  Members are the shop's own people plus us. Custom roles that restrict this need an Enterprise plan.
- Secrets live **per dataset**, which matches the setup: every customer has **four Netlify
  projects** — frontend + Studio for staging, frontend + Studio for production, each with its own
  Netlify env vars (`.env*` files are gitignored and never reach Netlify). The staging pair
  (and local dev) run on the `development` dataset, the live pair on `production` (owner,
  2026-11-12). So `development` holds the staging frontend's hook + functions secret, `production`
  the live ones (confirmed by the owner, 2026-11-12). The local Studio (`.env`, endpoint
  `localhost:8888`) reads the `development` secrets too: its Deploy button builds **staging**, and
  its refunds/mails only work when the local frontend's `.env` `SERVER_FUNCTIONS_SECRET` equals the
  staging one (set it to the new staging value at rotation).
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
    SVG). So the Deploy button loses today's "building" state (the `Badge` + spinner + the Cancel
    button that replaces Deploy while building, `DeployDialog.tsx`). (There's no "done" toast today
    either.)
  - **`DeployDialog.tsx` rewrite:** drop `fetchBuild`/`getStatus`/`handleCancel`/the `NetlifyBuild`
    state; keep the optional-title `TextArea`, "Open in Netlify", Close, Deploy. Deploy →
    `fetch(`${hook}?trigger_title=${encodeURIComponent(title || defaultTitle)}`, { method: 'POST' })`
    (normal CORS request, no body; spike 2026-11-11: the hook answers cross-origin with a readable
    `200`) → `res.ok` → success toast "Build requested" (the hook says nothing about the build
    itself); not ok or a network error → error toast with the status. Keep the button disabled
    ~10 s against double clicks. No hook in the secrets → Deploy disabled + a hint text naming the
    Integrations dialog. **A11y:** the badge `<img>` gets `alt` = translated "Netlify deploy
    status" (its state is visual only, so the text "Open in Netlify" link next to it is the accessible way to the
    details); the TextArea gets a real label (today only a placeholder); the icon-only toolbar
    Deploy button gets an `aria-label` next to its existing `title` (today `title` only).
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
- Spike: [x] Can the Studio `POST` the build hook cross-origin? **Yes** (2026-11-11, Tinhof
  `staging` hook, from the Studio's console): a plain `fetch(hook, { method: 'POST' })` returned a
  readable `200`, so no `no-cors` is needed and the Studio can tell an accepted trigger from a
  failed one. Both the plain and a `no-cors` request started a `staging` build (seen in Deploys).
  [x] Does the badge follow the hook's build? **Yes** (2026-11-12, staging frontend project: a
  running build showed "building", after a cancel and a reload "canceled"). The badge is per Netlify
  project, and each frontend project builds one branch (four projects per customer, see A's
  trade-offs), so each Studio's badge shows only its own frontend's builds — as long as its
  `SANITY_STUDIO_NETLIFY_SITE_ID` is that frontend's (rollout step 4). The badge is cached, so keep
  the cache-busting query on each ~10 s refresh.

## C. Refunds and mails: server-side guards (defence in depth for A)

Editors (and anyone who steals an editor's session) can read `functionsSecret`, so the endpoints
must refuse anything the UI wouldn't do:
- `payment-refund` (core-front `src/netlify/functions/payment-refund.ts`): today the body is
  `{ paymentIntentId, amount? }` and any PaymentIntent on the Stripe account can be refunded
  (also one of another system sharing the account).
  - New body `{ orderId: string, amount?: number }`. The server loads the order with
    `fetchOrderById(orderId)` (`services/sanity.ts`, `getDocument`), requires `_type === 'order'`
    and a `paymentIntentId`, else `errorResponse(ErrorCode.ORDER_NOT_FOUND, 'Order not found',
    requestId, 404)` (fixed text, don't echo the id). Missing / non-string `orderId` → 400 as the
    `paymentIntentId` check today. Then
    `refundPayment(order.paymentIntentId, amount, idempotencyKey)` and
    `syncOrderRefunds(order.paymentIntentId)` as today. Update the header comment and
    `RefundRequestBody`.
  - **No amount cap of our own:** Stripe already rejects a refund larger than what's left
    (`amount` > unrefunded → 400, mapped to `REFUND_FAILED` today). Leave it to Stripe.
  - **Idempotency key, derived on the server** (no Studio change, and a changed amount can't hit
    Stripe's "same key, different params" error):
    `refund:<orderId>:<refundCount>:<amount ?? 'full'>`, where `refundCount` =
    `(await listRefunds(order.paymentIntentId)).length` (`services/stripe.ts`, exists, used by
    `syncOrderRefunds`). Every refund — pending, succeeded, failed, dashboard-made — stays in that
    list, so the count only grows. Two confirms at the same moment read the same count → same key
    → one refund; any later refund sees a higher count → new key. (Not the charge's
    `amount_refunded`: a refund that fails asynchronously drops out of it again, so a retry of the
    same amount within Stripe's 24 h key window would reuse the key and get the old failed refund
    replayed instead of a new one.) `services/stripe.ts` `refundPayment` gets the key as a 3rd arg
    → `refunds.create(params, { idempotencyKey })` (its only caller is `payment-refund`).
    `listRefunds` reads one page of 100 (no auto-paging); an order with more than 100 refunds
    doesn't exist in practice — accepted.
  - **What the second of two simultaneous confirms gets** (verified against both callers,
    2026-11-12): Stripe answers a same-key request that arrives while the first is still running
    with `409 idempotency_error` → `REFUND_FAILED` 502 → that tab shows "refund failed" and patches
    nothing — correct. But a same-key request **after** the first finished gets the first refund
    replayed with `200`; the second tab would then patch the order again (a duplicate
    `statusHistory` entry) and send a second refund mail. Guard: stripe-node returns
    `refund.lastResponse.headers['idempotent-replayed'] === 'true'` on a replay (Stripe's
    `Idempotent-Replayed` header; `lastResponse` is on `Stripe.Response<T>` in stripe 21.0.1, so
    `refundPayment`'s return type becomes `Promise<Stripe.Response<Stripe.Refund>>`) → `payment-refund`
    answers `409` `errorResponse(ErrorCode.REFUND_FAILED, 'Refund already processed', requestId,
    409)` (log it, still run `syncOrderRefunds`), so the second tab stops at `refundFailed` like
    the in-flight case. Test: mock `create` resolving with that header → 409, sync still called.
    On Tinhof staging (Stripe test mode), confirm the header name once: two refunds with the same
    key → second response has it.
  - core-back side (same release, contract change): `ITSFrontendClient.refundPayment(orderId,
    options)` in `src/types/frontend.ts` + `external/frontend.ts` (send `orderId`),
    `lib/shop/orderRefund.ts` passes `order._id` (its `order.paymentIntentId` param goes away);
    update its doc comment ("two confirms in the same second stay a residual risk" is then fixed:
    the server key prevents a second refund, the replay 409 a second patch + mail)
    and `tests/withdrawals.test.ts` (line ~229 expects `refundPayment('pi_1', …)` → the order id).
    `buildRefundPatch` only needs `{ status }`, so dropping `paymentIntentId` from `refundOrder`'s
    `order` type breaks nothing. Callers: `OrderActions.tsx`, `WithdrawalActions.tsx`
    (both via `refundOrder`).
  - Also reject an `orderId` starting with `drafts.` (404) — orders are only ever published docs.
  - Tests: **rewrite the existing** `src/netlify/__tests__/payment-refund.test.ts` (its 4 cases post
    `{ paymentIntentId }`): add `refunds.list` next to `refunds.create` in the `stripe` mock
    (resolves `{ data: [...] }`) and
    `vi.mock('../services/sanity', () => ({ fetchOrderById: vi.fn() }))`. Cases: unknown id → 404,
    non-order / `drafts.` id → 404, order without `paymentIntentId` → 404, Stripe called with the
    order's PI + derived key as 2nd arg (`{ idempotencyKey }`), same request twice → same key,
    one more refund in the list → new key; keep the sync/502 cases.
- `order-notify`: **already guarded, no change** (checked 2026-11-11): `customerMessage` is capped
  at `CUSTOMER_MESSAGE_MAX_LENGTH = 2000`, type-checked, and rendered as React text nodes per line
  (`templates/email/components/CustomerMessage.tsx`), so no HTML/links get injected. Recipients are
  always the order's own customer. It stays the editor's feature.
- `requireServerSecret` (`src/netlify/utils/server-auth.ts`) compares with `!==` → same constant-time
  helper as `wc-api` (F).
- Rotate `SERVER_FUNCTIONS_SECRET` at release (the old one is in old bundles, which Netlify keeps
  at their deploy permalinks): generate a new one, put it in Netlify env (Functions scope) and in
  the secrets document.

## D. Preview (#5)

Today `/api/preview/:locale/:type/:id` renders **drafts** for anyone and accepts any perspective
string. Its error path echoes `documentType` into a `text/html` response, which is a probable
reflected XSS on the shop origin. Function responses don't get `_headers`/CSP.

Use **Sanity's own preview secret** (Presentation `previewMode` + `@sanity/preview-url-secret`),
the standard mechanism:
1. core-back `src/presentation/index.ts` (`createPresentations`): add
   `previewUrl.previewMode: { enable: '/api/preview/enable', shareAccess: false }` next to the
   existing `initial`
   (`<integrations.netlify.endpoint>/api/preview/<locale>`; `enable` resolves against that origin).
   Presentation creates a short-lived secret doc and opens
   `<enable>?sanity-preview-secret=…&sanity-preview-pathname=…&sanity-preview-perspective=…`.
2. core-front **new function** `src/netlify/functions/preview-enable.ts` →
   `createPreviewEnableHandler()`; tsup entry `'preview-enable'` + `package.json` export
   `./functions/preview-enable` (like the other factories); add `@sanity/preview-url-secret` as a
   **direct** dependency (`^4.1.5`; today only transitive via `@sanity/visual-editing`) and raise
   core-front's `@sanity/client` range from `^7.14.1` to `^7.26.2` (its peer range; 7.28.0 is
   installed). It's a light
   function — no `included_files` entry. Flow: `validatePreviewUrl(client, request.url)` with a
   `@sanity/client` built from `SANITY_PROJECT_ID`/`SANITY_DATASET`/`SANITY_TOKEN` (the secret
   docs need a token; `useCdn: false`) **inside the handler**, not at module load —
   `check:functions` imports every function with no env set, and the other functions' clients are
   lazy for that reason → `isValid` false → 401, fixed text. `validatePreviewUrl` **throws** instead
   of returning `isValid: false` when the client has no token or the Sanity API fails (e.g. 401 for
   a bad `SANITY_TOKEN`; spike 2026-11-11) → `try/catch`: `console.error` + 500, fixed text. Valid
   but no `redirectTo` (no `sanity-preview-pathname`) → 400, fixed text. Valid → set cookie `itsshops_preview` =
   `base64url(exp).hmacSHA256` (exp = now + 1 h; `PREVIEW_SESSION_SECRET`, Functions scope;
   `HttpOnly; Secure; SameSite=None; Partitioned; Path=/api/preview`, because the preview runs in
   the Studio's cross-site iframe) → 307 to `redirectTo` only if it starts with `/api/preview/`
   (else 400, fixed text — the function doesn't know the locales). `redirectTo` is already
   path-only and already carries `sanity-preview-perspective` (the library resolves the pathname
   against a dummy origin: `//evil.com/x` → `/x`, `https://evil.com/api/preview/x` →
   `/api/preview/x`; spike 2026-11-11), so the prefix check is the only guard needed and no
   perspective handling is added here. Wrapper path `/api/preview/enable` doesn't clash with the preview
   wrapper's 3-segment path (it would with a widened `/api/preview/:locale`; see route note). The cookie holds
   **no perspective**: Presentation sends it on every URL as `sanity-preview-perspective`, which
   `preview.ts` already reads.
   **Share preview access:** besides the 1-hour per-session secrets, `validatePreviewUrl` also
   accepts the singleton `sanity-preview-url-secret.share-access`, which Presentation creates when an
   editor turns on "Share preview access". Anyone with that link then gets a preview cookie until
   an editor turns sharing off. Presentation has a switch for it: `previewMode.shareAccess`
   (`boolean`, in sanity 6.9.2's `PreviewUrlPreviewMode` type). **Decided:** step 1 sets
   `previewMode: { enable: '/api/preview/enable', shareAccess: false }`, so there's no share toggle
   and no share secret ever exists. Document it in `csp-and-headers.md`'s preview notes.
   Shared cookie sign/verify helper in `src/netlify/utils/preview-session.ts` (Node `crypto`,
   `timingSafeEqual`), used by both functions.
3. `preview` function (`src/netlify/functions/preview.ts`, export `preview(props)`): before
   anything else, no valid cookie → 401, fixed HTML "Preview session expired — reload the
   Presentation tool in the Studio" (one `<h1>`, `lang`, no input echoed; the cookie lasts 1 h, so
   an editor who keeps Presentation open longer hits this on the next navigation). OPTIONS stays
   204.
4. Validate params: `locale` matches `^[a-z]{2}$` (the configured locales live in the customer's
   `itsshops.config.mts`, which the function doesn't load before Eleventy). Today an unknown
   two-letter locale does **not** fall back: `config/templates.ts` `pageDoc` uses
   `preview.locale || defaultLocale`, then `data.cms[locale][collection]` throws on `undefined`. Fix
   there: `const locale = data.cms[l] ? l : data.coreConfig.defaultLocale`. `documentType` ∈
   `page | post | productVariant | category` (the types `pageDoc` resolves), `documentId` matches
   `^[A-Za-z0-9_.-]{1,128}$`. Bad locale/type/id → 400, fixed text. Perspective: `published` stays
   `published`; anything else (missing, `drafts`, or a release stack Presentation sends when an
   editor views a release) → `drafts`. No 400 here, because a 400 would break the preview iframe
   while a release is selected; release previews aren't supported today either (the raw string is
   cast to `ClientPerspective` in `config/config.ts`) — out of scope.
5. Errors: `console.error` the details, return a generic message (today `error.message` with the
   raw `documentType`/`documentId` goes into the `text/html` body), never echo input into HTML.
6. Headers on every preview / preview-enable response: `Content-Security-Policy: frame-ancestors
   <studio origins>`, `X-Robots-Tag: noindex`, `Cache-Control: private, no-store`. Origins: split
   the list parsing out of `server-auth.ts` `allowedOrigin()` into an exported
   `allowedOrigins(): string[]` (reads `SERVER_FUNCTIONS_ALLOWED_ORIGINS`) and use it in both. Empty
   list → `frame-ancestors 'none'` (fail closed, same as the CORS side).
7. `process.env.PREVIEW_*` stays (an instance serves one request at a time, and after step 4 every
   request sets all four). No refactor.
8. Tests (`src/netlify/__tests__/`, new files): `preview-session.test.ts` (valid, expired, tampered
   signature, wrong length, missing secret → invalid); `preview-enable.test.ts` with
   `vi.mock('@sanity/preview-url-secret')` (invalid → 401, `redirectTo` outside `/api/preview/` →
   400, valid → 307 + `Set-Cookie` with all attributes); `preview.test.ts` with
   `vi.mock('@11ty/eleventy')` (no/bad cookie → 401, bad locale/type/id → 400, an Eleventy throw →
   generic 500 body without the input, CSP header present).

Route note: the starter/Tinhof wrapper path is `/api/preview/:locale/:documentType/:documentId`
only, so Presentation's `initial` (`/api/preview/<locale>`) 404s today and keeps doing so after the
redirect. Not a security issue; out of scope (separate fix: widen the wrapper path, or point
`initial` at the home page's preview URL). Same for posts: core-back offers a `post` location
when the blog is on, but core-front ships only `templates/pages/preview/pages.njk`, so a post
preview ignores every template → "No preview result" (after step 5: the generic 500). Keep `post`
(and `productVariant`/`category`) in the allowlist; adding their preview templates is a separate
fix.

Spikes: [ ] Is the `Partitioned` cookie kept inside the Presentation iframe in Safari? If not,
fallback: a short-lived signed `?pt=` token in the URL — but the location hrefs built in core-back
`presentation/index.ts` and the `history.update` pushes in `src/preview/visual-editing.ts` don't
carry it, so the spike must also check how Presentation navigates (iframe `src` vs history) and
where `pt` gets re-appended. [x] Does `@sanity/preview-url-secret` load in a Netlify function?
**Yes** (2026-11-11): it imports in plain Node 22 ESM from core-front's `node_modules` and
works with a real `@sanity/client` 7.28.0. Findings folded into step 2 (throws on API errors,
path-only `redirectTo`, share-access secret, peer range). Still run `npm run check:functions` on
the real `preview-enable` build.

## E. Login redirect (#8)

`src/scripts/user-login.ts:64` redirects to `?next=` unchecked (open redirect; `javascript:` blocked
only by CSP). Phishing scenario: `https://<shop>/de/login/?next=https://<lookalike>/` shows the real
login, then hands the customer to a fake "session expired, re-enter password" page. Core never
generates `?next=` links itself (checked 2026-11-11), so today only hand-crafted links reach it.
It stays anyway, because customers may use it (e.g. Rosi's register-only flow). Add a pure helper
`safeRedirectPath(next: string | null, origin: string, fallback: string): string` in
`src/shared/safe-redirect.ts`: `new URL(next, origin)` in `try/catch`, require the same `origin`
and `http:`/`https:`, return `pathname + search + hash`, otherwise `fallback` (`/${locale}/`). Drop
the extra `decodeURIComponent` (`searchParams.get` already decodes; decoding twice is what lets
`%2F%2Fevil.com` through). Call site: `user-login.ts:64-65` only — the only redirect target that
comes from the URL. The 7 `json.redirectUrl` sinks (`user-register/-reset/-recover/-confirm`,
`newsletter-action`, `order-withdraw`) get server-built relative paths from same-origin endpoints
(checked 2026-11-11) and stay as they are. Unit tests in `src/shared/__tests__/` (plain node env,
the origin is a parameter): `//evil.com`, `/\evil.com`, `https://evil.com`, `javascript:…`,
`%2F%2Fevil.com`, empty/null, a valid `/de/konto/?x=1#y`. Logout is fine (`SameSite=Strict`
session cookies, `services/supabase.ts`; `user-logout` accepts GET + POST); optional: allow only POST.

## F. Smaller hardening (same release)

- New helper `safeEqual(a: string, b: string): boolean` in `src/netlify/utils/server-auth.ts`:
  `timingSafeEqual` over the two **SHA-256 digests** (`timingSafeEqual` throws on different
  lengths, so never compare the raw strings). Used by `requireServerSecret` (C) and `wc-api`.
- `wc-api` `authenticate` (`src/netlify/functions/wc-api.ts:258`): use `safeEqual` for key and
  secret (timing attacks over the internet are theoretical, but it's cheap); `try/catch` around
  `atob` → `false` (it runs **before** the handler's `try`, so a malformed Basic header is an
  uncaught throw → 500 today; should be 401); split at the **first** `:` only (a secret containing
  `:` fails today). Query-param keys stay (WooCommerce compatibility for wineNET). The function
  logs only param names, not values or the URL (checked 2026-11-11), so keep it that way.
- `wc-api` `after`/`before` (`handleListOrders`, ~line 545): `new Date(x).toISOString()` throws a
  `RangeError` on an invalid date → caught by the handler → 500 today. Check `isNaN(date.getTime())`
  first → `wcError('rest_invalid_param', …, 400)`.
- Tests: extend the existing `src/netlify/__tests__/wc-api.test.ts` (malformed Basic → 401, secret
  containing `:` → 200, bad `after`/`before` → 400); `safeEqual` unit cases (equal, different,
  different length) next to them or in a new `server-auth.test.ts`.

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

1. Spikes: B1, B2 and D2 done (2026-11-11/12, results in B and D). **D1 (Safari + `Partitioned`
   cookie) runs as the first implementation step of D** (decided 2026-11-12, no throwaway spike):
   build `preview-enable` + the cookie check in `preview` + core-back's `previewMode`, pin them on
   Tinhof **staging** only, open Presentation in the staging Studio in Safari (and Chrome). Cookie
   kept → continue D as written; dropped → switch D's cookie to the `?pt=` fallback (see D's
   spikes) before building the rest.
2. core-front: C (refund by `orderId`, server-derived idempotency key, `safeEqual` in
   `requireServerSecret`), D (`preview-enable` function + export + dependency, preview guards), E,
   F. Vitest for each. `npm run build && npm run check:functions` (must load `preview-enable` in
   plain Node).
3. core-back: A (studio-secrets, Integrations dialog, clients from secrets, remove env/config
   tokens, rename the test token), B (build hook + badge, drop `external/netlify.ts` and cancel),
   C's `refundPayment(orderId)` contract, D's Presentation `previewMode`. `npm run build`,
   `npx vitest run`.
4. One release per core, both **major**, `CHANGELOG.md` "Upgrading" in each. **The two must go live
   together per customer:** the refund contract changed (old Studio → `paymentIntentId` → 400 on
   new core-front; new Studio → `orderId` → 400 on old core-front), and the rotated secret breaks the
   old Studio anyway. So per customer: frontend + backend pinned and deployed in the same session,
   staging first. Every env/hook/secret step below happens **per environment**: staging frontend +
   Studio projects with the `development` dataset, production ones with `production`. Customers must:
   - frontend: add `netlify/functions/preview_enable.mts` (`path: '/api/preview/enable'`,
     `export default createPreviewEnableHandler()`); Netlify env (Functions scope):
     `PREVIEW_SESSION_SECRET` (new, ≥ 32 random bytes) and a **new** `SERVER_FUNCTIONS_SECRET`, each
     generated separately for the staging and the production frontend project; check
     `SERVER_FUNCTIONS_ALLOWED_ORIGINS` lists that project's own Studio origin (today: own Studio
     only, owner 2026-11-12 — no change) — it's now also the preview's `frame-ancestors`. Local dev
     needs nothing new: the local Studio (`sanity dev --port <n>`, per customer in the backend's
     `package.json`: Tinhof 3334, Jurtschitsch 3335, Rosi 3339) calls the local frontend
     (`localhost:8888`), whose `.env` already allows `http://localhost:<n>`; that same value also
     lets the local preview be framed. Add `PREVIEW_SESSION_SECRET` to the local frontend `.env`;
   - Netlify → **each** frontend project → Build hooks: one hook for the branch that project builds
     (staging frontend → `staging`, production frontend → `production`). Tinhof's staging hook exists
     (spike, 2026-11-11);
   - Studio → Integrations dialog (as administrator), **once per dataset**: in the staging Studio
     (`development`) the staging frontend's hook + `SERVER_FUNCTIONS_SECRET`, in the live Studio
     (`production`) the production ones; `vinofactToken` in both (Vinofact shops: Tinhof,
     Jurtschitsch, Rosi);
   - backend, public Studio vars: `.env*` is gitignored, so each Studio Netlify project builds
     only from **its own Netlify env vars** (the local `.env`/`.env.production` are for local runs
     only). Check that the staging Studio project's `SANITY_STUDIO_NETLIFY_SITE_ID` (now also the
     badge) belongs to the **staging** frontend project. The old Deploy button already built that
     site id, so if staging's Deploy built staging, it's right already;
   - backend: remove `SANITY_STUDIO_NETLIFY_ACCESS_TOKEN`, `SANITY_STUDIO_NETLIFY_FUNCTIONS_SECRET`
     and `SANITY_STUDIO_VINOFACT_API_TOKEN` from `.env*` **and** from **both** Studio projects'
     Netlify env;
     rename the test token to `VINOFACT_API_TOKEN` in `.env` (A);
   - redeploy the Studio: it's a Netlify site, so push the backend's `staging`/`production` via the
     `user` remote (not `sanity deploy`). Old deploys stay reachable at their permalinks — that's
     why every value in them is rotated.
   - also add the `preview_enable.mts` wrapper to itsshops-starter `base/frontend/netlify/functions/`
     (next to `preview.mts`) so new customers get it.
5. Order: **Tinhof** (live) → Jurtschitsch → Rosi Schuster. Dormant customers get it when work
   resumes (their PATs are revoked already, see top).
6. Rotate after release: the Vinofact token (in the Tinhof, Jurtschitsch **and Rosi** bundles — all
   three have `SANITY_STUDIO_VINOFACT_API_TOKEN`; ask Vinofact what it allows, and rotate
   immediately if it can write). For Tinhof (and Jurtschitsch/Rosi once their PATs are revoked):
   check the Netlify audit log, Stripe refunds and Resend for activity nobody caused; if anything
   shows up, rotate the server keys the PAT could read (`SANITY_TOKEN`, Stripe, Supabase, Resend).
7. Docs: core-back `plugin-and-config.md` (rule 1, secrets namespace); core-front
   `commerce-and-netlify.md` (refund contract), `csp-and-headers.md` (preview headers),
   `configuration.md` (env: `PREVIEW_SESSION_SECRET`), `new-customer.md` + `go-live-checklist.md`
   (build hook, Integrations dialog, no Studio secrets, `preview_enable.mts`),
   `sanity-dataset-backups.md` (backups contain the secrets doc), `wc-api.md` (401/400 cases),
   `consuming-core-and-deploy.md` (four Netlify projects per customer and which dataset/env each
   uses — today it reads as one site with two branches); the
   function catalog in core-front `CLAUDE.md` build-outputs table is generic (`<name>.ts`), no change;
   core-back `studio-components.md` (DeployDialog, IntegrationsDialog, `frontendClient` missing-secret
   behaviour); a decision record `decisions/studio-secrets-in-dataset.md` (+ its line in
   `decisions/README.md`); and rule 1 in core-front
   `CLAUDE.md` + core-back `CLAUDE.md`.

## Decided (2026-11-11)

- All Netlify PATs revoked (see top).
- Integrations dialog: `administrator` role only. Each customer's Sanity project has a single
  user, who created the project and is therefore its Administrator, so in practice that user sees
  the dialog. Check under manage.sanity.io → project → Members if unsure. The check only matters
  once a shop adds more members (e.g. editors).
- Preview share access off (owner, 2026-11-12): `previewMode.shareAccess: false` in
  `createPresentations` (D step 1). No shop shares previews today, and it removes the only way to
  get a draft-preview cookie without a Studio login. Turning it on later is one line.
