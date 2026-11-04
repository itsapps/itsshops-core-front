# Plan — interest list → invite → gated prices/reservations (Rosi Schuster first)

Status: **Planned** (2026-11-04, revised after review the same day). All phase 1 decisions made;
nothing built yet. Origin: Rosi Schuster sells by allocation, not online. Today, visitors register a
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
- **Retention:** a daily scheduled cleanup deletes `pending` entries after **7 days**. Confirmed
  entries stay until Schuster deletes them or the person asks. The privacy section states both.
- **No extras in phase 1:** no notification mail to Schuster (they check the Studio), no free-text
  field, no fields on the `interestForm` module (intro text goes in a text module above it). The
  Supabase keep-alive is removed with the `user-*` wrappers; the free project may pause and is
  restored (or recreated) at the start of phase 2. Supabase env vars and Supabase-side hooks are
  **kept** (phase 2 needs them).
- **Re-signup of a confirmed/invited address:** no mail, generic success (like newsletter).
- **Hand-created entries** (no recorded opt-in): no extra field; the privacy section states that
  Schuster is responsible for the consent of people it adds by hand.
- **Interest mail:** built in Schuster with `sendMail` (no `sendSimpleEmail` refactor in core).

## Phase 1 — interest list

### Step 1 — core-front: exports only

- New package export `./functions/utils` — **re-exports only, no new behaviour**:
  - `sanityClient`, `fetchEmailSettings`, `buildEmailShopSettings`
  - `sendMail`
  - `validateEmail` (+ the other shared validators), `normalizeEmail`, `serverT`, the response
    helpers (`success`, `badRequest`, `errorResponse`, `methodNotAllowed`), `ErrorCode`, `log`
  - `prepareSubscription`, `confirmSubscription` (newsletter opt-in on interest confirm, step 3)

  Note in the export docs: importing it initialises `sanityClient`, which throws without
  `SANITY_PROJECT_ID` / `SANITY_DATASET` / `SANITY_TOKEN` (fine in functions).
  Add a tsup entry + exports entry; include it in `check:functions`.
- The interest mail is built in Schuster with `sendMail` (plain HTML + text) — no core refactor.
- **Not** in core (dropped after review): `captchaRoutes` / `captchaModules`, a privacy hCaptcha
  hook, client captcha exports, a `confirmOptIn` helper — all unnecessary without captcha.
- `npm run build`. CHANGELOG entry (minor).

### Step 2 — Schuster backend: `interestedPerson` document

- `src/schema/documents/interestedPerson.ts` via `ItsshopsConfig.documents[]`, Studio title
  **"Interessenten"** (de/en field translations):
  - **`liveEdit: true`** — no drafts. Functions write the published doc; an open editor draft would
    otherwise overwrite `status`/`token` on publish (e.g. a confirm happening while an editor assigns
    groups would be reverted to `pending`).
  - read-only (set by the function): `email`, `locale`, `status` (`pending` | `confirmed` |
    `invited`), `token`, `createdAt`, `confirmedAt`, `newsletter`
  - editable: `prename`, `lastname`, `country`, `phone`, `address` (line1, zip, city),
    `customerGroups[]` (refs to core `customerGroup`), `notes`
  - `allowCreate: true`, so Schuster can add people by hand (status `confirmed`, no token); consent
    for those is covered by the privacy text (see Decided).
  - Preview: name + country + status icon. Default ordering newest first.
- Desk structure: a list item with filters (confirmed / pending / invited) if core-back's structure
  allows customer list items. Otherwise the plain document list.
- The `interestForm` page module: a field-less module type, like `fundingNotice`.
- Desk structure: hide the core "Kunden" (`customer`) list until phase 2.
- Delete = the normal Studio delete (the person asked for removal → gone).

### Step 3 — Schuster frontend: functions

- `netlify/functions/interest-register.mts` (`/api/interest/register`, POST, `rateLimit` per IP like
  `newsletter-subscribe.mts`):
  - validate the required fields, normalise the email.
  - **deterministic `_id`** from a hash of the normalised email (`interestedPerson.<sha256>`) +
    `createIfNotExists`, so two quick submits can't create two docs.
  - new → `pending` + token + confirm mail. Existing `pending` → **same token**, mail again (update
    locale/fields). Existing `confirmed`/`invited` → no data change, no mail.
  - **always return a generic success** (no enumeration, same as newsletter-subscribe).
  - `newsletter: true` → stored only; applied on confirm.
- `netlify/functions/interest-confirm.mts` (`/api/interest/confirm`, **POST `{ token }`**, called by
  the landing page): `pending` → `confirmed`, clear the token, set `confirmedAt`. If `newsletter` →
  `prepareSubscription` then `confirmSubscription(token)` (the visitor just confirmed this address;
  `source: 'standalone'`). Returns ok / already-confirmed / invalid.
- `netlify/functions/interest-cleanup.mts` (`schedule: '@daily'`, pattern: core
  `order-meta-cleanup.ts`): delete `pending` entries older than `INTEREST_PENDING_RETENTION_DAYS`
  (7, a named constant the privacy text matches). Log counts/ids only, never names or emails.
- Remove the `user-*` wrappers (`user-register/login/logout/confirm/recover/reset`) and
  `supabase-keep-alive`. Keep the Supabase env vars and Supabase-side hooks (phase 2); note that in
  the Schuster `CLAUDE.md`.

### Step 4 — Schuster frontend: UI

- `features.users` off in `itsshops.config.mts` (drop `registrationFields`). Check the header,
  footer and menus for leftover account links.
- Form: `overridable/modules/interestForm.njk` + `src/assets/scripts/interest-form.ts`.
  - Reuse the core register form's markup and validation patterns: labelled fields, `countryList`
    filter for the country select, `autocomplete` attributes, per-field error spans plus an
    `aria-live` status, `aria-busy` on submit and focus moved to the first invalid field.
    WCAG 2.2 AA.
  - No captcha (see Decided).
  - Success state: "Bitte bestätigen Sie Ihre E-Mail-Adresse", announced in the live region.
- Editors create the CMS page with the module and link to it (contact page text, menu).
- Confirm landing page (`/de/interesse/bestaetigt` + en): a customer page template
  `src/pages/standard/interest-confirm.njk` (any name core's `pages/` doesn't use — core throws on a
  name clash), a copy of core's `pages/standard/newsletter-confirm.njk` + its component: pagination
  over `coreConfig.locales`, permalink from a `customer.interest.*` URL-segment translation (the
  confirm function builds the mail link from the same key), `noindex`, an h1 (one h1 per page rule).
  Like core, it confirms on a **button click**, not on load (JS-running mail scanners), then shows
  success / already-confirmed / invalid-link in the live region.
- Translations in `itsshops.config.mts` under `customer.interest.*` (de formal; en). Mail texts
  too.
- **Privacy:** an editor extra section "Interessentenliste" (purpose, legal basis Art. 6(1)(a)
  consent, retention 7 days pending / confirmed until deleted, recipients: Netlify / Sanity / mail
  provider; Schuster is responsible for consent of people it adds by hand). The generated account section disappears with `users` off. No hCaptcha section needed.

### Step 5 — verify and deploy (staging)

- Check the Sanity dataset is **private** (personal data → paid plan, core-front
  `netlify-plans.md`).
- Delete the Supabase test users (and optionally the test `customer` docs).
- On staging, check: register → mail → landing page → entry `confirmed` in the Studio. Also:
  re-register with the same email (same link still works), double submit (one doc), invalid token,
  newsletter opt-in lands in `newsletterSubscriber`, rate limit, an internal link to the interest
  page from the contact page, keyboard-only + screen-reader pass, CSP has no violations.
- **Cleanup:** scheduled functions only run on the production deploy, not on the `staging` branch
  deploy — trigger it by hand (`netlify functions:invoke` locally, or a unit test with a fake clock).
- Core pushed first, then swap the lockfile `#<commit>` (Schuster `CLAUDE.md` → Deploy).
- Docs: `/itsshops-update-docs` (Schuster frontend + backend `CLAUDE.md`, core-front
  `commerce-and-netlify.md` for the new exports).

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
    `SANITY_STUDIO_*` value is public.
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
