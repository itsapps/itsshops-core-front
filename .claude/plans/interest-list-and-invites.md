# Plan — interest list → invite → gated prices/reservations (Rosi Schuster first)

Status: **Planned** (2026-11-04, revised after review the same day; second and third reviews
2026-11-04 checked it against the code). All phase 1 decisions made; one phase 2 question open (see "Open
questions"). **Phase 1 steps 1–4 done** (2026-11-04: core-front exports unreleased; Schuster backend + frontend committed on `main`, not deployed); step 5 (staging verify + deploy) open. Origin: Rosi Schuster sells by allocation, not online. Today, visitors register a
Supabase account (`users` feature). New flow:

1. **Interest phase:** visitors leave their details (no password, no account). Schuster manages the
   list in the Studio (delete, assign customer groups, notes).
2. **Invite phase:** Schuster invites selected people by email. They get a real account (Supabase +
   `customer` doc, status `invited` → `active`).
3. **Reservation phase:** invited customers (by customer group) see prices and reserve wines.

**Core stays lean — rule for this whole plan:** nothing goes into core that only Schuster uses.
Core gets only (a) **exports** of helpers that already exist (no new behaviour) and (b) a flag where
core itself builds something Schuster can't remove by override (phase 2: the register page). All
interest-list and invite *logic* is customer code (Schuster backend + frontend). Promote it to core
when a second shop needs it.

When this ships, delete this file. Durable parts go to core-front `commerce-and-netlify.md`
(exported helpers, `users.registration`), `configuration.md` (`users.registration`), the Schuster
`CLAUDE.md`s (interest list, invite action) and a decision record (why the interest list and invites
are customer code).

## Decided (2026-11-04)

- **Customer code, not a core feature (yet):** interest list = Schuster schema + Schuster Netlify
  functions. Core only **exports existing helpers**, so nothing is copied.
- **Fields:** `prename`, `lastname`, `country`, `email` required. Optional: `phone`, address
  (`line1`, `zip`, `city`) and `newsletter`. Email is required because the invite goes there.
- **Double opt-in:** an entry is `pending` until the visitor confirms, then `confirmed`. Mirrors the
  newsletter token flow, **including** its details: the mail links to a landing page that POSTs the
  token (never a GET confirm endpoint — mail link scanners would confirm on their own), and a repeat
  submit re-sends the **same** token (a double submit must not invalidate the first mail's link).
  Gives proof of consent for the later invite mail and keeps typos and foreign addresses out.
- **Spam: no hCaptcha, per-IP `rateLimit` + double opt-in** — same decision as Schuster's
  newsletter. Worst case: confirmation mails to foreign addresses; those entries are deleted
  unconfirmed after 7 days. Why no captcha: the form sits on an editor-chosen page (see placement),
  and `_headers` CSP is keyed by path, so hCaptcha would need either a site-wide CSP widening or new
  core code. Without it: no CSP change, no hCaptcha privacy section, no core change.
- **Placement: a page module** (`interestForm`) on a normal CMS page (e.g. "Interessentenliste",
  slug `interesse`). It is an ordinary `page`, so editors link to it like any page — portable-text
  links ("Mailingliste" / "Anmelden" on the contact page), menus, buttons — via core-back's
  `internalLinkFields`; links survive slug changes (`urlMap`). The **confirm landing page is fixed**
  (`/de/interesse/bestaetigt` + en) — only the mail links there.
- **No public self-registration on Schuster, at any point.** Frontend `users` is turned **off** for
  the interest phase. Phase 2 turns it back on in invite-only mode.
- **Prices/reservations (phase 3) are checked by customer group** on the server, not just by
  "logged in".
- **Existing Supabase users** on Schuster are test users only. Delete them, no migration.
- **Backend `users` stays on, frontend `users` off** (phase 1). In core-back the flag gates only
  the `customer` and `customerGroup` types and the mail-sender settings (`settings.ts`), which
  newsletter requires anyway. The frontend never reads backend flags, so the mismatch is harmless,
  unlike `checkout`. Interest entries reference the real `customerGroup`, so groups carry into the
  `customer` on invite (phase 2) and gate prices (phase 3). The empty "Kunden" list is **hidden** in
  the Schuster desk structure until phase 2 (avoids confusion next to "Interessenten").
- **Retention:** a daily scheduled cleanup deletes `pending` entries **7 days after the last form
  submit** (`submittedAt`, so a re-sent link isn't deleted the next day). Confirmed
  entries stay until Schuster deletes them or the person asks. The privacy section states both.
- **Non-binding note stays** (owner, 2026-11-04): today's `customer.registerInfo` text ("Die
  Bereitstellung der Kontaktdaten ist unverbindlich …", de + en) moves to
  `customer.interest.nonBindingNote` and is rendered in the `interestForm` above the submit button
  (step 4), so editors don't have to repeat it.
- **No extras in phase 1:** no notification mail to Schuster (they check the Studio), no free-text
  field, no fields on the `interestForm` module (intro text goes in a text module above it). The
  Supabase keep-alive is removed with the `user-*` wrappers; the free project may pause and is
  restored (or recreated) at the start of phase 2. Supabase env vars and Supabase-side hooks are
  **kept** (phase 2 needs them).
- **Re-signup of a confirmed/invited address:** no mail, generic success (like newsletter).
- **Hand-created entries** (no recorded opt-in): no extra field; the privacy section states that
  Schuster is responsible for the consent of people it adds by hand.
- **Interest mail:** built in Schuster with `sendMail` (no `sendSimpleEmail` refactor in core).
- **Customer strings in functions:** core's `serverT` reads **only** core's bundled translations
  (`src/netlify/utils/i18n.ts`), not `itsshops.config.mts` → `translations`. So everything the
  functions *and* the templates both need (confirm-page URL segments, mail texts, retention days)
  lives in one Schuster module, `src/_config/interest.mts`, imported by the functions, by
  `eleventy.config.mts` and by `itsshops.config.mts`. Page-only UI strings stay in
  `itsshops.config.mts` → `translations`.

- **`productList` button = editor-chosen link** (owner, 2026-11-04). Today it links to
  `cms[_locale].registerUrl`, which core sets to `'#'` once `users` is off. Instead, editors pick
  the target and label per module (steps 2 and 4). No button when no link is set.

## Open questions (owner)

1. **Phase 2 auth — decide before phase 2 starts** (owner, 2026-11-04; doesn't block phase 1,
   which has no Studio → function calls). The invite function must verify that the caller is a
   Schuster editor. The plan is to send the editor's Sanity token and check it against Sanity, but
   the Studio logs in with a cookie by default, so `client.config().token` is empty. Options to
   check then: `auth: { loginMethod: 'token' }` in the Schuster workspace, or another Sanity-side
   check. Related: core's existing Studio → function calls (refund, notify) use
   `SERVER_FUNCTIONS_SECRET`, which sits in the Studio bundle and is therefore public. That's the
   same problem in core and a separate fix, not part of this plan.

## Phase 1 — interest list

### Step 1 — core-front: exports only ✅ done 2026-11-04

- New file `src/netlify/functions/utils.ts` → tsup entry `'functions-utils'` → package export
  `"./functions/utils": { types: ./dist/functions-utils.d.ts, import: ./dist/functions-utils.js }`.
  **Re-exports only, no new behaviour** (sources as of 2026-11-04):
  - `sanityClient`, `fetchEmailSettings` (`services/sanity.ts`), `buildEmailShopSettings`
    (`lib/email-settings.ts`)
  - `sendMail` + types `SendMailParams` (`services/email.ts`; params `from, to, subject, text,
    html?, replyTo?, headers?`)
  - `validateEmail` (`shared/validation.ts`), `normalizeEmail` (`utils/newsletter-helper.ts`),
    `serverT` (`utils/i18n.ts`; core keys only, e.g. `api.errors.validation.email`), `success`,
    `badRequest`, `errorResponse`, `methodNotAllowed` (`utils/response.ts`), `ErrorCode`
    (`types/errors.ts`), `log` (`utils/logger.ts`)
  - `prepareSubscription`, `confirmSubscription` (`utils/newsletter-helper.ts`; newsletter opt-in
    on interest confirm, step 3)

  `check:functions` picks it up automatically (it loads every `./functions/*` export), so nothing
  to add there. Just run it after the build.
- **Lazy `sanityClient`** (core hardening, decided 2026-11-04 — generic, not Schuster logic):
  today `services/sanity.ts` creates the client at import (`export const sanityClient =
  initSanityClient()`), so importing anything that reaches it throws without `SANITY_PROJECT_ID` /
  `SANITY_DATASET` / `SANITY_TOKEN` — which would hit every Schuster module and test importing
  `./functions/utils`. Make it lazy exactly like `services/supabase.ts` (`getClient()` memoised +
  `export const sanityClient = new Proxy({} as SanityClient, { get })` binding functions to the
  real client). Callers are unchanged; the missing-env error now fires on first use instead of at
  import. Then drop the dummy-env loop from `scripts/check-functions.mjs` (its comment "Some
  modules create clients at import time" no longer holds) — the check proves import-time
  side-effect freedom from then on. Existing tests `vi.mock` the whole module (no `spyOn` on the
  client, checked), so they're unaffected; add one test that importing `services/sanity` with no
  env doesn't throw and first use does. CHANGELOG line under the same minor release.
- The interest mail is built in Schuster with `sendMail` (plain HTML + text) — no core refactor.
- **Not** in core (dropped after review): `captchaRoutes` / `captchaModules`, a privacy hCaptcha
  hook, client captcha exports, a `confirmOptIn` helper — all unnecessary without captcha.
- `npm run build`. CHANGELOG entry (minor).

### Step 2 — Schuster backend: `interestedPerson` document ✅ done 2026-11-04

(As built: `source`/`status` defaults via field `initialValue`, not `getInitialValue` — core-back
declares that hook but never reads it. Orderings: newest first + last name.)


- `src/schema/documents/interestedPerson.ts` (an `ITSDocumentDefinition`, added to the today empty
  `documents` array in `src/schema/index.ts`), Studio title **"Interessenten"** (de/en field
  translations):
  - **`liveEdit: true`**, returned from `build()`: core-back spreads `build()`'s result into
    `defineType` (`src/schemas/index.ts`), so it passes through. No drafts. Functions write the
    published doc; an open editor draft would otherwise overwrite `status`/`token` on publish (e.g. a
    confirm happening while an editor assigns groups would be reverted to `pending`).
  - `source` (`form` | `manual`, read-only, initial value `manual` via `getInitialValue`; the
    function writes `form`).
  - read-only **when `source == 'form'`** (`readOnly: ({ document }) => document?.source === 'form'`),
    editable on hand-created docs: `email` (required, lower-case validation), `status`
    (`pending` | `confirmed` | `invited`, initial `confirmed`), `newsletter`. Always read-only:
    `locale`, `token`, `submittedAt` (set by the function on create **and** on every re-submit of
    a `pending` entry; the cleanup keys on it), `confirmedAt`.
  - `email` validation: unique among `interestedPerson` (custom rule with
    `getClient({ apiVersion })`, `*[_type == "interestedPerson" && email == $email && _id != $id]`),
    so a hand entry can't duplicate a form entry.
  - `country`: a plain `string` with `Rule.regex(/^[A-Z]{2}$/)`, **not** core's
    `ctx.constants.countryOptions` list — that holds only the shop's configured countries, while
    the form offers every ISO code (`countryList`). Phase 2 maps it (and the plain-string `city`)
    into core's `address` object (`city` is an `i18nString` there).
  - editable: `prename`, `lastname`, `country`, `phone`, `address` (line1, zip, city),
    `customerGroups[]` (refs to core `customerGroup`), `notes`
  - `allowCreate: true`, so Schuster can add people by hand (random `_id`, status `confirmed`, no
    token); consent for those is covered by the privacy text (see Decided).
  - Preview: name + country + status icon. Default ordering newest first by `_createdAt` (set for
    form and hand entries alike; Sanity orderings can't `coalesce`, so no own `createdAt` field).
- `src/schema/objects/interestForm.ts`: a field-less page module like `fundingNotice` (copy it),
  added to `objects` in `src/schema/index.ts`, to the page modules list in
  `src/schema/extensions.ts` (next to `{ type: 'fundingNotice' }`), and titled in
  `src/translation/{de,en}.ts` (like `fundingNotice`).
- `productList` button link: in `src/schema/extensions.ts` → `productList.fields`, add
  `builders.actionGroup({ includeTitle: true })` (`group: 'content'`), the same field
  `stdContentWithCarousel` uses (an `actions[]` of core `internalLinkFields`, so links follow slug
  changes). The editor sets title + target (e.g. the interest page). The backend `CLAUDE.md` gets a
  line for it.
- Desk structure: `src/structure/index.ts` (today empty) + un-comment `structure` in
  `sanity.config.ts`:
  - a new top-level `{ type: 'custom', id: 'interest', position: { anchor: 'customers',
    placement: 'before' }, component: (S, _context, ctx) => S.listItem().id('interest')… }` listing
    "Alle" (`S.documentTypeList('interestedPerson')`) plus one list per status (confirmed / pending
    / invited): `S.documentList().schemaType('interestedPerson').filter('_type == "interestedPerson"
    && status == $status').params({ status })` — `.filter()` **replaces** the type filter, so a
    `documentTypeList(…).filter('status == $s')` would list every document type. Titles via
    `ctx.structureT` / the backend translations. The customer item merges into core's root list
    and `position` anchors on the core `customers` group (core-back `src/structure/structure.ts` →
    `mergeManifests` / `sortItems`).
  - hide the core "Kunden" list until phase 2: `{ id: 'customers', children: [{ id: 'customer',
    hidden: true }] }` (`hidden` still shows in dev, fine). The `customers` group is gated by
    feature `shop` (core-back `src/config/structure.ts`) and its children by `users`, so it stays
    with `customerGroup` only.
- Delete = the normal Studio delete (the person asked for removal → gone).

### Step 3 — Schuster frontend: functions ✅ done 2026-11-04

(As built: logic in `netlify/lib/interest.mts`, thin wrappers; `src/_config/interest.mts` created
here already — step 4 only adds UI to it. GROQ param `$confirmToken`, since `token` is reserved in
Sanity's `QueryParams` type. Tests: `tests/unit/interest.test.ts`.)


- `netlify/functions/interest-register.mts` (`/api/interest/register`, POST, `rateLimit` per IP like
  `newsletter-subscribe.mts`):
  - locale from the `x-locale` header, accepted only if it is a key of `INTEREST_CONFIRM_PATHS`,
    else `de` (core's newsletter functions don't check it, but an unknown locale would build a
    broken confirm link here).
  - validate the required fields (`validateEmail`; `prename`/`lastname` non-empty; `country`
    `/^[A-Z]{2}$/` — core's `ALPHA2_CODES` sit unexported in `src/filters/index.ts`, and core's own
    register function only checks non-empty), normalise the email. Validation errors → `errorResponse(ErrorCode.INVALID_INPUT, …, 400)` (format errors
    only, never "already registered").
  - lookup: first `*[_type == "interestedPerson" && email == $email][0]` (catches hand-created
    docs with random ids). If none: **deterministic `_id`** `interestedPerson-<sha256(email)>`
    (hyphen, not a dot: a dot makes it a path id with special visibility rules) +
    `createIfNotExists` with `source: 'form'`, `status: 'pending'`, a fresh `crypto.randomUUID()`
    token, `submittedAt`. Then **re-read** the doc and use *its* token, so two concurrent submits send
    the same link.
  - new → confirm mail. Existing `pending` → **same token**, mail again (patch locale/fields and
    `submittedAt`; `setIfMissing({ token: randomUUID() })` first, for a hand entry an editor set to
    `pending`, which has no token — then re-read).
    Existing `confirmed`/`invited` → no data change, no mail (a newsletter tick there is dropped
    too: the person can use the footer newsletter form).
  - mail: `fetchEmailSettings(locale)` → sender (throw if `senderEmail`/`senderName`/`shopName`
    missing, like `newsletter-notifier.tsx`), plain HTML + text from `src/_config/interest.mts`,
    link `${baseUrl}/${locale}/${INTEREST_CONFIRM_PATHS[locale]}/?token=…`, `baseUrl =
    process.env.PUBLIC_URL ?? process.env.URL` (core's precedence). Skip sending when
    `SKIP_AUTH_EMAILS === 'true'` (core convention for tests).
  - **always return a generic success**, even when Sanity or the mail fails (log, then success),
    exactly like `newsletter-subscribe.ts`. No enumeration.
  - `newsletter: true` → stored only; applied on confirm.
- `netlify/functions/interest-confirm.mts` (`/api/interest/confirm`, **POST `{ token }`**, called by
  the landing page; same per-IP `rateLimit`): find by token. `pending` → `confirmed`, unset the
  token, set `confirmedAt`. If `newsletter` → `const { send, token: nlToken } = await
  prepareSubscription(email, locale)`; if `send`, `confirmSubscription(nlToken)` (the **subscriber's**
  token, not the interest token; the visitor just confirmed this address; creates `source:
  'standalone'`). A newsletter failure is logged and doesn't fail the confirm. Returns
  `success({ ok: true })`. Unknown token → `errorResponse(ErrorCode.INVALID_INPUT, …, 400)`, like
  `newsletter-confirm.ts`. Because the token is cleared on confirm, a second click on the same link
  lands in that branch, so its page text says "link invalid or already used" (no separate
  already-confirmed state).
- `netlify/functions/interest-cleanup.mts` (`schedule: '@daily'`, pattern: core
  `order-meta-cleanup.ts`): delete `*[_type == "interestedPerson" && source == 'form' &&
  status == 'pending' && submittedAt < $cutoff]`, cutoff from `INTEREST_PENDING_RETENTION_DAYS`
  (7, exported from `src/_config/interest.mts`; the privacy text matches it). Log counts only, never names or emails.
- Remove the `user-*` wrappers (`user-register/login/logout/confirm/recover/reset`) and
  `supabase-keep-alive`. Keep the Supabase env vars and Supabase-side hooks (phase 2); note that in
  the Schuster `CLAUDE.md`.

### Step 4 — Schuster frontend: UI ✅ done 2026-11-04

(As built: scoped `blocks/interest-form.css` instead of core's `form.css` — that one would
restyle the newsletter dialog; error text darkened for AA; `user.css` deleted with the user
overrides. Live regions stay in the DOM, emptied instead of `hidden`. Not yet checked in a
browser — step 5.)


- `src/_config/interest.mts`: `INTEREST_CONFIRM_PATHS` (`{ de: 'interesse/bestaetigt', en:
  'interest/confirmed' }`), `INTEREST_PENDING_RETENTION_DAYS = 7`, the mail texts (de formal + en:
  subject, text, button label). Plain TS, no Eleventy or Sanity imports, so the Netlify bundler can
  include it in the functions (import it with the extension, `../../src/_config/interest.mts`, as
  `eleventy.config.mts` already does for `filters.mts`).
- `features.users: false` in `itsshops.config.mts` (drop `registrationFields`; fix the newsletter
  comment there, "Register/recover keep it" no longer applies). Leftovers that go
  with it (checked 2026-11-04): delete `overridable/user-register.njk` and
  `overridable/user-confirm-success.njk` (core no longer builds those pages), the translations
  `customer.goToRegistration` and `staticPages.userConfirmSuccess.*`; **rename**
  `customer.registerInfo` → `customer.interest.nonBindingNote` (same de/en text, see Decided).
  `overridable/modules/productList.njk` links "Zur Registrierung" to `cms[_locale].registerUrl`,
  which becomes `'#'`. Replace it with the editor-chosen link (see Decided, step 2):
  `src/_config/extensions.mts` → `modules.page.productList.extraFields` gets
  `p.actionsField('actions', { includeTitle: true })` (as `stdContentWithCarousel`), **and** the
  `productList` branch of `resolve.module` returns `actions: ctx.resolveActions(module.actions)`
  next to `image`/`content` — core merges the hook result over the raw module
  (`src/data/resolve/modules.ts`), so without it `internalLinkTitle` stays an unresolved i18n
  array and `action.title` is empty. The template
  renders `module.actions` the way `overridable/modules/stdContentWithCarousel.njk` does
  (`action.internal._id | pageUrl`, `action.title`, class `btn`), and nothing when the array is
  empty. Header and footer overrides contain no account links (checked).
- Form: `overridable/modules/interestForm.njk` + `src/assets/scripts/interest-form.ts`.
  - Scripts are wired into Schuster's entry `src/assets/scripts/index.ts` (it replaces core's
    default entry) with a DOM guard + lazy import, like the map:
    `if (document.querySelector('[data-interest-form]')) import('./interest-form.js').then(m =>
    m.initInterestForm())`; same for `[data-interest-confirm]` → `interest-confirm.js`.
  - Reuse the core register form's markup and validation patterns: labelled fields, `countryList`
    filter for the country select, `autocomplete` attributes, per-field error spans plus an
    `aria-live` status, `aria-busy` on submit and focus moved to the first invalid field.
    WCAG 2.2 AA.
  - No captcha (see Decided).
  - Newsletter: an unticked checkbox with its own label and core's note below it, as in the core
    register form (`forms.fields.registerForNewsletter.privacyNotice` with `{url:
    cms[_locale].privacyUrl}`, `core/components/user/user-register.njk`). Above the submit button,
    the non-binding note (`customer.interest.nonBindingNote`, a `<p>`, as today in italics); below
    the submit button, a short consent note (`customer.interest.privacyNote`) also linking `cms[_locale].privacyUrl`.
  - Posts JSON with `x-locale` to `/api/interest/register`.
  - Success state: "Bitte bestätigen Sie Ihre E-Mail-Adresse", announced in the live region.
    Replace the form with the message and move focus to it (`tabindex="-1"`).
- Editors create the CMS page with the module and link to it (contact page text, menu).
- Confirm landing page (`/de/interesse/bestaetigt` + en): a customer page template
  `src/pages/standard/interest-confirm.njk` (any name core's `pages/` doesn't use — core throws on a
  name clash), a copy of core's `pages/standard/newsletter-confirm.njk` + its component: pagination
  over `coreConfig.locales`, permalink `"/{{ _locale }}/{{ interestPaths[_locale] }}/"`, where
  `interestPaths` is `INTEREST_CONFIRM_PATHS` registered with
  `eleventyConfig.addGlobalData('interestPaths', …)` in `eleventy.config.mts` (the register function
  builds the mail link from the same constant). `noindex: true`, `eleventyExcludeFromCollections`,
  `titleKey: customer.interest.confirm.title` (system pages need it for `<title>`), a visible h1.
  Like core (`scripts/newsletter-action.ts`), it confirms on a **button click**, not on load
  (JS-running mail scanners), and without a `token` param it redirects home. Then it shows success
  or "link invalid or already used" in place: success in a `role="status"` region, error in
  `role="alert"`, like core's component. Script: `src/assets/scripts/interest-confirm.ts`.
- UI translations in `itsshops.config.mts` → `translations.<locale>.common.customer.interest.*`
  (used as `'customer.interest.…' | trans`, like `customer.fundingNotice`; de formal + en). Mail
  texts and URL segments are **not** here: they live in `src/_config/interest.mts` (see Decided).
- **Privacy:** an editor extra section "Interessentenliste" (purpose, legal basis Art. 6(1)(a)
  consent, retention 7 days pending / confirmed until deleted, recipients: Netlify / Sanity / mail
  provider; Schuster is responsible for consent of people it adds by hand). "7 days" = after the
  last form submit (`submittedAt`). The generated account section disappears with `users` off. No hCaptcha section needed.

### Step 5 — verify and deploy (staging)

- Check the Sanity dataset is **private** (personal data → paid plan, core-front
  `netlify-plans.md`).
- Delete the Supabase test users (and optionally the test `customer` docs).
- On staging, check: register → mail → landing page → entry `confirmed` in the Studio. Also:
  re-register with the same email (same link still works), double submit (one doc), invalid token,
  second click on a used link ("invalid or already used"), form submit for an address Schuster
  added by hand (no second doc, no mail), the `productList` button (editor link set → renders and
  follows a slug change; unset → no button),
  newsletter opt-in lands in `newsletterSubscriber`, rate limit, an internal link to the interest
  page from the contact page, keyboard-only + screen-reader pass, CSP has no violations.
- **Cleanup:** scheduled functions only run on the production deploy, not on the `staging` branch
  deploy — trigger it by hand (`netlify functions:invoke` locally, or a unit test with a fake clock).
- Core pushed first, then swap the lockfile `#<commit>` (Schuster `CLAUDE.md` → Deploy).
- Docs: `/itsshops-update-docs` (Schuster frontend + backend `CLAUDE.md`, core-front
  `commerce-and-netlify.md` for the new exports). In the Schuster frontend `CLAUDE.md`, also rewrite
  the bullets that describe the removed `users` setup ("Wired & features" `users` line, the
  `user-confirm-success.njk` mention under "One h1 per page", and the "No online sales" list of
  wired functions). In the backend `CLAUDE.md`, replace "`src/structure/` is empty and not wired".

## Phase 2 — invites (mostly Schuster code)

- **core-front (the only core part):** `users: { registration: 'invite' }` (default `'open'`).
  Core builds no public register page and no register link and drops the register captcha route.
  Login, recover, reset and invite-accept stay. A `user-register` wrapper must not be wired. Needs
  core because core builds those pages itself. Plus: add any Supabase/customer helpers the invite
  function needs (Supabase admin client, `storeCustomer`, auth mail sending) to the
  `./functions/utils` export — exports only.
- **Schuster frontend:** `user-invite` function.
  - **Auth:** verify the caller's Sanity user token (from the Studio request) against Sanity
    (`/users/me` + project role). **No shared secret** — the Studio is a browser bundle, any
    `SANITY_STUDIO_*` value is public. How the Studio obtains that token is open question 1.
  - Create the invite via Supabase `admin.generateLink({ type: 'invite' })` and send it through the
    shop's own mailer (as `user-register`'s direct-send path does) — not `inviteUserByEmail`, which
    uses Supabase's rate-limited mailer (2/h on free).
  - `storeCustomer(..., { status: 'invited' })` with address + `customerGroups` from the payload.
    `auth-webhooks` `onUserInvited` / first login → `active`. Check what the existing invite mail
    (`en_server.ts` "You're invited") and the set-password page already cover.
- **Schuster backend:** document action "Einladen" on `interestedPerson` (only for `confirmed`):
  calls `user-invite`, sets `status: 'invited'` on success.
- Schuster: `users` back on with `registration: 'invite'`; add a per-IP `rateLimit` to the
  login/recover wrappers. Privacy account section returns.
- Tests: function unit tests (mock Supabase).
- Promote the invite function/action to core only when a second shop needs it.

## Phase 3 — prices + reservations (separate plan, scope open)

To be designed before building. **Where it lives is not decided** — the plan must look for the
fewest core hooks that let a customer gate prices, not put reservations into core by default.
Known constraints:
- Static site: prices must **not** be in the built HTML, the `searchIndex` or schema.org JSON-LD for
  gated shops. Fetch them client-side from an authenticated function that checks session + customer
  group. This likely needs core hooks (templates, search index, JSON-LD, cart) — keep them minimal.
- A reservation is roughly a checkout without payment. Look at reusing `orderMeta`/order docs with
  a `reservation` type vs a separate doc. Mails to customer and Schuster.
