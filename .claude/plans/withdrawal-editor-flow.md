# Plan — withdrawals: guided editor flow + `liveEdit`

Status: **implemented, tested on Tinhof staging, merged to core-back `main`** (2026-11-10;
A–E, unit tests, docs, CHANGELOG `Unreleased`); not released.
Changed while testing: unmatched withdrawals show the 14-day refund deadline too, the guide's
unmatched step is two options (assign / delete with the data-protection reason); the box colour
follows the deadline only; "So geht's" sits below the box (never tinted); the status input writes
with a sync client commit (ADR core-back `live-edit-preview-fields-written-by-client.md`). Open:
the D.5 draft check per dataset (Tinhof development: 0; production, Jurtschitsch), the release
("Ship"); delete this file then. Goal (owner, 2026-11-09): editors handle a
withdrawal **correctly and know what to do next**. The sections below describe the state
**before** the change.

## Today (checked 2026-11-09)

- **Withdrawal** (`orderWithdrawal`, `src/schemas/documents/orders/orderWithdrawal.ts`): own
  document, linked via `orderRef`. `status` = worklist only: `unmatched` / `received` (automatic),
  `processing` / `rejected` (dropdown), `refunded` (dropdown **or** "Refund & close"). Changing it
  does nothing to the order. `OPEN_STATUSES = ['received', 'processing']` is defined there; the
  same list is inlined in `WithdrawalActions.tsx` (`OPEN_WITHDRAWAL_QUERY`),
  `WithdrawalOrderInput.tsx` (`SUGGESTIONS_QUERY`) and core-front (`services/sanity.ts`, the web
  endpoint's dedupe).
- **"Refund & close"** (`WithdrawalResolveAction` / `ResolveWithdrawalContent`,
  `components/actions/WithdrawalActions.tsx`): **full** refund only (`frontendClient.refundPayment`
  without amount = the rest), patches the order `paymentStatus: refunded` + a `payment` history
  entry (+ `status: canceled` and a `fulfillment` entry if `refundCancelsFulfillment`), withdrawal
  → `refunded`, optional `orderRefunded` mail with `refundAmount` = what Stripe returned. Already
  refunded order → only closes. Partial refunds and "returned" go through the order's "Status
  aktualisieren" (`OrderDocumentAction` / `OrderActionContent`, `OrderActions.tsx`), after which
  the editor sets the withdrawal to "Erstattet" by hand.
- **Lists:** `config/structure.ts` → one "Widerrufe" list (`mapItems(['order', 'orderWithdrawal',
  'orderMeta'])`, a plain `document` item), open and closed mixed.
- **Order view** (`components/OrderView.tsx`): a "Widerrufe" card (tone caution,
  `useOrderWithdrawals`) lists the order's withdrawals with a status badge (`WITHDRAWAL_TONES`) as
  `IntentLink`s. The order's status dialog says nothing about an open withdrawal.
- **Drafts:** withdrawals aren't `liveEdit`. Stopgap (2026-11-09, core-back `add6aaa`, unreleased):
  "Refund & close" disabled while a draft exists (`props.draft`, key
  `actions.orderWithdrawal.resolve.draftOpen`) — publishing an older draft reverted `refunded`.
  Part D removes it.
- **Assigning** (`components/WithdrawalOrderInput.tsx`): editable only while the *published*
  record is `unmatched`; suggestions (`SUGGESTIONS_QUERY`: number / email / name, excludes orders
  with an open withdrawal) + the reference picker (filter does the same); an effect sets `status`
  `received`/`unmatched` as the field changes; the editor then publishes and presses "Bestätigung
  erneut senden". The field descriptions (`fields_de/en.ts` → `orderWithdrawal.fields.orderRef` /
  `status`) say exactly that ("danach veröffentlichen …").
- **Deadline:** none shown. FAGG §14: refund within 14 days of receiving the declaration; the
  shop may hold it back until the goods are back or the customer proves dispatch. Unmatched
  records: delete after checking, at the latest after 30 days (existing rule, field description).

## A — Next step + deadline on every withdrawal

A guide box above the form, rendered by a **document-level** `components: { input:
WithdrawalGuideInput }` returned from `orderWithdrawal`'s `build` (the schema factory spreads
`build()` into `defineType`, as with `liveEdit` on `order`); it renders the box, then
`props.renderDefault(props)`. No stored field. New file `components/WithdrawalGuideInput.tsx`.

It reads the withdrawal from `props.value` and the linked order **live** (fetch + `listen` on
`*[_id == $id]`, same pattern as `useOrderWithdrawals`): `status`, `paymentStatus`,
`totals.grandTotal`, `refunds[]{amount,status,createdAt}`.

Pure helpers in a new `utils/withdrawals.ts` (exported for tests; also the new home of
`OPEN_STATUSES`, imported by the actions (`OPEN_WITHDRAWAL_QUERY` → `status in $open`), the
assign dialog's queries, `structure/withdrawals.ts` and the guide — the schema no longer needs it
once D.1 drops `orderRef`'s filter and validation):
- `withdrawalDeadline(declaredAt, today) → { dueDate, tone: 'default'|'caution'|'critical',
  overdueSince? }` — `dueDate` = the **calendar date** of `declaredAt` in the browser's timezone +
  14 days; `caution` from `dueDate − 3 d`; `critical` when `today > dueDate`, `overdueSince =
  dueDate + 1 d`. `today` is passed in (testable). Dates only, no shop timezone.
- `withdrawalNextStep(withdrawal, order) → { step, deadline? }`, `step` one of the rows below
  (first match wins):

| Withdrawal | Order | `step` · text (de, gist) |
|---|---|---|
| `unmatched` | – | `assign` · Assign the order ("Bestellung zuordnen") or delete after checking — by 〈declaredAt + 30 d〉 |
| `received` / `processing` | `paymentStatus: refunded` | `close` · Order already refunded → "Erstatten & abschließen" closes the withdrawal |
| `received` / `processing` | `created` / `processing` (undispatched) | `refund` · Not shipped → "Erstatten & abschließen" (also cancels the order) |
| `received` / `processing` | `partiallyRefunded` | `partial` · €〈refundedTotal〉 already refunded (e.g. in the order dialog or the Stripe dashboard) → "Erstatten & abschließen": refund the rest **or** close only |
| `received` / `processing` | `canceled` / `returned` (not refunded) | `refund` · Nothing more to wait for → "Erstatten & abschließen" |
| `received` / `processing` | `shipped` / `delivered` | `wait` · Wait for the goods (set "In Bearbeitung"); once back or proof of dispatch → "Erstatten & abschließen" (full or partial) |
| `refunded` | – | `done` · Refunded €〈refundedTotal〉, last on 〈latest counted refund `createdAt`〉 (from `order.refunds` via `refundedTotal`; no stored refunds → "Erstattet" without amount) |
| `rejected` | – | `rejected` · Closed as rejected (see internal note) |

Open ones (`received` / `processing`) also show the **deadline with the legal hint** (owner,
2026-11-09):

> Erstattung bis 〈declaredAt + 14 d〉 (14 Tage ab Eingang des Widerrufs). Zurückhalten erlaubt,
> bis die Ware zurück ist oder der Versand nachgewiesen wird.

`Card tone` = the helper's tone; overdue adds the text "Überfällig seit 〈overdueSince〉" — the
state is in the text, not colour alone (a11y). en alongside; `componentT` keys under
`actions.orderWithdrawal.guide.*` (`components_de.ts` / `components_en.ts`). The box is plain
text in a `Card` (no live region needed — it isn't a result of a user action in the box).

**Owner guide in the Studio** (owner, 2026-11-09): a collapsible "So geht's" section at the end of
the guide box — the whole flow in a few steps (assign or delete unmatched; not shipped → refund;
shipped → wait, then refund full or partial, "Ware ist zurück"; reject with a note; the deadline).
A native `<details>`/`<summary>` (keyboard + screen reader without extra ARIA; keep the browser's
focus outline), closed by default, same texts for every shop (de + en, `…guide.howTo.*`). No
separate document to keep in sync.

## B — "Refund & close" covers every case

1. **Shared refund step.** New `lib/shop/orderRefund.ts`:
   `refundOrder({ sanityClient, frontendClient, order, expected, amountCents?, note?,
   markReturned? }) → Promise<{ refundedCents?: number } | { error: string }>` — `expected =
   { paymentStatus, refundedCents: refundedTotal(refunds) }` is a **snapshot taken when the dialog
   opened** (`useState(() => …)` in the dialog; not the live prop: `OrderActionContent` gets
   `props.published`, which the listener updates while the dialog is open, so comparing against it
   would never differ). It first re-fetches the order's `paymentStatus` + `refunds` and refuses
   (`actions.refund.changedMeanwhile`, "Die Bestellung wurde inzwischen geändert — Dialog neu
   öffnen") when either differs from `expected`:
   `payment-refund` sends Stripe no idempotency key (core-front `services/stripe.ts`), so two tabs /
   two editors could otherwise refund a partial amount twice (core-front's `payment-refund` syncs
   `refunds` right after the refund — a failed sync is only logged, but the first dialog's
   `paymentStatus` patch still differs from a `succeeded` snapshot; two confirms in the same second
   stay a residual risk). Then calls `refundPayment(order.paymentIntentId,
   amountCents ? { amount } : undefined)`, bails on error, then commits **one** order patch built by
   a pure `buildRefundPatch(order, { refund: 'full' | 'partial' | 'none', markReturned, note,
   timestamp, newKey })` in `utils/orderRefunds.ts` → `{ set, historyEntries }`: `full` /
   `partial` → `paymentStatus` `refunded` / `partiallyRefunded` + a `payment` entry; on full +
   `refundCancelsFulfillment` → `status: canceled` + `fulfillment` entry; on `markReturned` →
   `status: returned` + `fulfillment` entry (`none` = only this, for B.4's no-refund case);
   `note` on every entry; `source: 'admin'`; `commit({ autoGenerateArrayKeys: false,
   returnDocuments: false })` (exactly what both dialogs do today). `OrderActionContent` uses it for
   its two refund transitions (it keeps its own patch for fulfillment transitions + tracking code);
   `ResolveWithdrawalContent` uses it too (its `expected` = the order it fetches on open). Mail
   stays in the callers (`OrderActions` sends `customerMessage` too).
2. **Amount** in `ResolveWithdrawalContent` (only when the order isn't `refunded` yet): radio
   group (Sanity UI `Radio` + `<label htmlFor>`, inside a `<fieldset>` with a `<legend>`) "Full
   (rest €X)" / "Partial" with the euro amount field / — only when something was refunded already
   (`paymentStatus === 'partiallyRefunded'`) — "Nur abschließen
   (€〈refundedTotal〉 bereits erstattet, keine weitere Erstattung)". Pure `resolveOptions(order)` in `utils/withdrawals.ts` decides the options and the
   default. Default "Full" only when `paymentStatus === 'succeeded'`; otherwise **no preselection**
   (Confirm disabled until one is picked), so a prior partial refund never leads to refunding the
   rest by accident. The partial option states the consequence in its hint: "Der Widerruf wird
   abgeschlossen; der Rest wird nicht erstattet." (a partial is final — further refunds then go
   through the order dialog) — same rules and a11y as the order
   dialog (`Math.round(€ × 100)`, `0 < cents < remainingAmount(grandTotal, refunds)`,
   `aria-invalid` + `aria-describedby` hint `enterAmountBelowRemaining`; Confirm disabled while
   invalid). Mail checkbox (default on): `orderRefunded` for full, `orderRefundedPartially` for
   partial, each with `refundAmount` = `result.data.amount` (core-front `order-notify` /
   `sendOrderNotification` takes it).
3. **State machine: `delivered → returned` always** (owner, 2026-11-09). In
   `utils/orderTransitions.ts` `fulfillmentTransitions.delivered` becomes `['returned']` (was `[]`;
   `shipped` already allows it), so the refunded branch of `getAllowedFulfillmentTransitions`
   needs no change. Why: Tinhof sets orders "Zugestellt" once they're done, so withdrawals usually
   arrive on `delivered` orders; a **partial** refund (deduction for a damaged/opened bottle,
   shipping) left them unable to become `returned`. Generic → core; affects "Status aktualisieren"
   for every shop (offers "Retourniert" on delivered orders, mail `orderReturned` pre-checked).
   Test in `tests/orderTransitions.test.ts` (new `describe('fulfillment transitions')`: delivered →
   returned for `succeeded` / `partiallyRefunded` / `refunded`; returned and canceled terminal).
4. **"Ware ist zurück"** checkbox, offered when `returned` is in
   `getAllowedFulfillmentTransitions(order.status, paymentStatusAfter)` (`paymentStatusAfter` =
   `refunded` for full / already refunded, `partiallyRefunded` for partial and for "Nur
   abschließen") — with B.3 that is every `shipped` / `delivered` order, full or partial. Sets the
   order `returned` + history entry in the same patch (already refunded / "Nur abschließen":
   `buildRefundPatch(…, { refund: 'none', markReturned: true })` committed on its own, no refund
   call). No separate `orderReturned` mail — the refund mail covers it.
5. Withdrawal → `refunded` in every case (partial = the shop's decision that the rest is kept).
   Order patch first, withdrawal patch second (as today); if the withdrawal patch fails, the error
   says so and the guide's `close` row lets the editor finish with a second "Erstatten &
   abschließen" (the order is then refunded → close only, no second refund).
6. **`refunded` no longer in the status dropdown:** `status` gets a custom input
   (`components/WithdrawalStatusInput.tsx`, `components.input` on the field) — a Sanity UI
   `Select` with a visible label (the field title) offering `received` / `processing` /
   `rejected`; `refunded` and `unmatched` render read-only text when set. Writes go through
   `useDocumentOperation(documentId, 'orderWithdrawal').patch.execute([{ set: { … } }])` (as
   `WithdrawalOrderInput` does today), not the field's `onChange` — the rejection also sets `note`,
   which a field input can't reach via `onChange`; the async checks run before the patch. Leaving `rejected` for
   `received`/`processing` (reopening) first re-checks the order has no **other** open withdrawal
   (`count(*[… orderRef._ref == $order && status in $open && _id != $self])`; reopening decided by
   the owner, 2026-11-09 — a mis-click on "Abgelehnt" saves at once under `liveEdit`); if it has, the
   change is refused with `create.alreadyOpen` shown below the select (`aria-live="polite"`).
   **Choosing `rejected` asks for the reason first** (a labelled required textarea below the select,
   "Begründung (intern)", + "Ablehnen" button; empty → disabled): the patch sets `status` and
   appends "Abgelehnt am 〈date〉: 〈reason〉" to `note` — a rejection without a recorded reason
   is the one manual step that would leave no trace why a declaration was refused. (Telling the
   customer stays the editor's job — "So geht's" says so.) The
   schema's `options.list` keeps all five values (labels, validation) and `readOnly` is dropped
   (the input decides). So "Erstattet" only comes from the action that actually refunds.
7. Remove `useHasOpenWithdrawal`'s boolean-only shape: it becomes `useOpenWithdrawal(orderId) →
   { _id } | null` (exported; `OrderWithdrawalCreateAction` uses `!!open`), needed by C.2.

## C — Worklist and the order side

1. **Structure:** new `structure/withdrawals.ts` → `withdrawalsMenu: ITSStructureComponent`
   (like `productsMenu`): `S.listItem().id('orderWithdrawal')` titled `orderWithdrawal.title`,
   icon `ctx.config.schemaExtensions?.orderWithdrawal?.icon ?? OrderWithdrawalIcon` (a `custom`
   item skips `fromRegistry`, which applied the extension icon), child `S.list()` with two `S.documentTypeList('orderWithdrawal')`
   children: **"Offen"** (`.filter('_type == "orderWithdrawal" && status in $open')`, params
   `unmatched` + `OPEN_STATUSES`, `defaultOrdering([{ field: 'declaredAt', direction: 'asc' }])` =
   nearest deadline first) and **"Erledigt"** (`status in ["refunded", "rejected"]`, `declaredAt
   desc`), both `.apiVersion(ctx.config.apiVersion)` and `.canHandleIntent((intent, params) =>
   intent === 'edit' && params.type === 'orderWithdrawal')` so the order view's `IntentLink`s still
   resolve. In `config/structure.ts` the shop group becomes `...mapItems(['order']), { type:
   'custom', id: 'orderWithdrawal', feature: 'shop', component: withdrawalsMenu, hidden:
   isDocHidden(ctx, 'orderWithdrawal') }, ...mapItems(['orderMeta'])` — id kept, so a customer
   manifest overriding/anchoring `orderWithdrawal` still matches (none do today). Titles:
   `orderWithdrawal.open` / `orderWithdrawal.closed` in `structure_de/en.ts` ("Offen" /
   "Erledigt"). Check in the dev Studio that opening a closed withdrawal from the order card works.
2. **Order status dialog** (`OrderActionContent`): when `useOpenWithdrawal(order._id)` returns one
   and a refund transition (`refunded` / `partiallyRefunded`) is selected, show a `Card
   tone="caution"` notice above the amount field: "This order has an open withdrawal — handle the
   refund there (it also closes the withdrawal)" with an `IntentLink` (`intent="edit"`, `{ id, type:
   'orderWithdrawal' }`) that also calls `onComplete` to close the dialog. A notice, not a block (a
   refund for another reason stays possible). Keys `actions.order.updateStatus.openWithdrawal*`.
3. **Order view card:** for open withdrawals, show "Erstattung bis 〈date〉" (from
   `withdrawalDeadline`) next to the badge, `overdue` text when past — the query already selects
   `declaredAt` and `status`.

## D — `liveEdit` (no Publish step for withdrawals)

What breaks if `liveEdit: true` is just switched on:
1. `WithdrawalOrderInput.tsx` is editable only while `editState.published.status ===
   'unmatched'`, and its effect sets `status: received` as soon as `orderRef` is set → with
   `liveEdit` the field locks on the first pick; a wrong pick can't be corrected.
2. `orderRef`'s custom validation (incl. the race guard `validation.withdrawalOrderHasOpen`) only
   blocks publishing — without a Publish step it only warns.
3. Existing withdrawal drafts must be resolved first.

**Decided:** assigning becomes an explicit action with a confirm step (replaces the publish step;
the open-withdrawal check can block). Rejected: inline field + a "still correctable" flag.
**Decided (owner, 2026-11-09): with an undo** (D.3). A wrong link is dangerous — "Erstatten &
abschließen" refunds whichever order is linked — and the workaround ("rejected" + log a new one on
the right order) would leave the original web submission (name, email, order number, time: the
proof of the declaration) stuck on the wrong order; a Studio-logged record has none of it.
Suggestions match by order number, email **or name**, so wrong picks are plausible.

1. **Schema** (`orderWithdrawal.ts`): `liveEdit: true` from `build` (as `order.ts`); `orderRef`
   `readOnly: !ctx.config.isDev`, its `components`, `options.filter`/`filterParams` and custom
   validation **removed** (the checks move into the assign action); **delete
   `WithdrawalOrderInput.tsx`**. New `assignedAt` (`datetime`, `readOnly: !isDev`, `hidden:
   !isDev`). Translations: drop `validation.withdrawalUnmatchedWithOrder` /
   `withdrawalOrderHasOpen` (`fields_de/en.ts`), move `actions.orderWithdrawal.assign.*` into the
   new dialog, add `assignedAt` field labels, rewrite the `orderRef` / `status` descriptions
   ("Nicht zugeordnet: über „Bestellung zuordnen“ zuordnen oder nach Prüfung löschen – spätestens
   nach 30 Tagen." — no "veröffentlichen").
2. **`WithdrawalAssignAction`** (new, `WithdrawalActions.tsx`; registered in `config/actions.ts`
   next to Resolve/Resend), returned only while `published.status === 'unmatched'`. Dialog:
   suggestions (`SUGGESTIONS_QUERY` + `SuggestionCard` moved from `WithdrawalOrderInput.tsx`, the
   card's button now "select" — `aria-pressed` on the chosen one) + a labelled order-number / email
   search (`TextInput`, submit on Enter or a button; query: `orderNumber == $q ||
   lower(customer.contactEmail) == lower($q)`, same open-withdrawal exclusion, `[0...5]`; result
   count in an `aria-live="polite"` line). Picking shows the order's number, date, **customer name
   and email** (a wrong pick would mail the receipt to a stranger — the undo can't take that back)
   + checkbox "send confirmation to the order's email" (default on) → "Confirm":
   re-check `hasOpenWithdrawal(order)`, refuse with `create.alreadyOpen`; then **one** patch
   `sanityClient.patch(id).ifRevisionId(published._rev).set({ orderRef: { _type: 'reference',
   _ref }, status: 'received', assignedAt: now })` (a concurrent assign/edit → revision mismatch →
   "the withdrawal changed meanwhile, reopen it"); then, if checked, `withdrawNotify(id)` (mails
   the order's email; core-front ≥ the status-history release also writes the `withdrawalReceipt`
   mail entry on the order). Mail error → `notifyError` ("Saved, but …"), the dialog stays open.
3. **`WithdrawalUnassignAction`** (undo a wrong pick): shown **only** while `status ===
   'received'` **and** `assignedAt` is set (assigned in the Studio). Confirm dialog naming the
   order → `patch(id).ifRevisionId(_rev).unset(['orderRef', 'assignedAt']).set({ status:
   'unmatched', note })` where `note` = the existing note + a line "Zuordnung zu #〈n〉 aufgehoben,
   〈date〉" (the mail entry on the wrong order stays — a mail was sent). Gone once `processing` /
   `refunded` / `rejected` (back to `received` shows it again — nothing was refunded, so that's
   safe); web-matched records (no `assignedAt`) can never be unassigned. Records created by
   "Widerruf erfassen" on an order have no `assignedAt` either (correct: logged on that order).
4. Remove the stopgap (`hasDraft` branch in `WithdrawalResolveAction`, the `draftOpen` keys in
   `components_de/en.ts`, the header comment and the `studio-components.md` paragraph) **and its
   CHANGELOG `Unreleased` → "Fixed" entry** — it ships in the same release, so it never reaches a
   customer; the `liveEdit` entry replaces it.
5. Draft check before the upgrade, per dataset, raw perspective
   `*[_id in path("drafts.**") && _type == "orderWithdrawal"]{_id, status, orderRef}` (HTTP API
   `perspective=raw`; core-front's `itsshops sanity` CLI doesn't see drafts — core-back ADR
   `orders-live-edit.md`): carry wanted edits over (a draft that assigns an order → assign it with
   the new action after the upgrade), then **discard**. Tinhof development + production,
   Jurtschitsch; Rosi Schuster has `checkout: false` (no withdrawals) — run it anyway, expect 0.

## E — "Widerruf erfassen" date (`CreateWithdrawalContent`)

The `datetime-local` input accepts any date today, and `declaredAt` (read-only afterwards) now
drives the deadline. Add `max` = now (local) and refuse in `handleConfirm` a date in the future or
an empty value (hint below the field, `aria-invalid` + `aria-describedby`, Confirm disabled); keep
"now" as the default. Past dates stay allowed (a letter received days ago) — the hint repeats the
rule: "Datum, an dem der Widerruf eingegangen ist".

## Order of work

On a core-back `feature/withdrawal-editor-flow` branch: D first (it changes the flow A's texts
describe), then B, A, C, E — one core-back minor. A without D would have to say "publish first";
avoid writing texts twice.

## Tests

core-back unit tests (`tests/`, vitest, style of `orderRefunds.test.ts`): `tests/withdrawals.test.ts`
— `withdrawalNextStep` (every row of A's table incl. "already refunded"), `withdrawalDeadline`
(day 10 default, day 11 caution, day 14 caution but not overdue, day 15 overdue + `overdueSince`;
a `declaredAt` late in the evening UTC still counts by local date); the resolve dialog's option rules (pure `resolveOptions(order)`: nothing
refunded → Full default; partially refunded → Full / Partial / Close-only, no default; refunded → close only) and `refundOrder`'s stale check (mocked clients:
snapshot equal → refunds; `paymentStatus` or refunded total changed → refuses, no `refundPayment`
call); `buildRefundPatch` (full / partial / `none` + `markReturned` / cancel-if-undispatched /
note on every entry) in `orderRefunds.test.ts`;
the "Ware ist zurück" rule via `getAllowedFulfillmentTransitions` (B.3's tests in
`orderTransitions.test.ts`); action visibility (assign: unmatched only; unassign: `received` +
`assignedAt`; resolve: open + `orderRef`) as a pure `withdrawalActionsFor(withdrawal)` in
`utils/withdrawals.ts`. `npm run lint` at 0 errors, `npm run build`.
By hand on staging: each row of A's table; full + partial refund from the withdrawal (amounts,
mails, history entries, order status, "Ware ist zurück" — also partial on a Zugestellt order);
"Status aktualisieren" on a Zugestellt order offers "Retourniert"; dropdown without "Erstattet",
reopening a rejected one while another is open is refused; rejecting needs a reason (lands in
`note`); "Nur abschließen" after a partial refund from the order dialog; a second tab's refund is
refused after the first; a future date in "Widerruf erfassen" is refused; "Offen"/"Erledigt" lists + opening a
withdrawal from the order card; notice in the order's status dialog; assign with a wrong pick +
unassign (note line, mail went to the order's email); no Publish button; keyboard-only run through
the assign and refund dialogs.

## Ship

core-back **minor**, together with core-back's `Unreleased` (status history) and the core-front
status-history minor already on core-front `main` (writes the `withdrawalReceipt` mail entry the
assign action relies on — without it the assign still works, only the order lacks the entry).
**Upgrading:** resolve withdrawal drafts (D.5); tell shop owners: no "Publish" for withdrawals,
orders are assigned via "Bestellung zuordnen" (undo: "Zuordnung aufheben"), refunds (also partial)
via "Erstatten & abschließen", "Zugestellt" orders can now be set "Retourniert" (CHANGELOG
**Changed**). CHANGELOG (core-back; drop the stopgap's "Fixed" entry, D.4). Docs: core-back `schemas.md`
(`orderWithdrawal`: `liveEdit`, `assignedAt`, status input, `WithdrawalOrderInput` gone),
`studio-components.md` (guide box, Assign/Unassign, extended Resolve + shared `refundOrder`,
status-dialog notice, `delivered → returned`; drop the stopgap paragraph), `studio-structure.md` (Widerrufe → Offen /
Erledigt custom item), ADR: extend `orders-live-edit.md` with a "Withdrawals" section (assign
action replaces the publish step + undo) rather than a new ADR; core-front `commerce-and-netlify.md`
→ "Withdrawal" (editors assign via the action, not "status follows"; "Refund & close" does full
**and** partial refunds — drop "partial refunds go through the order's refund action").
Customers: no code change; the draft check per dataset; core-back tag pinned in each backend.
Delete this file when done.

## Decided (owner, 2026-11-09, after refine)

- **`delivered → returned` always** (B.3), regardless of refunds — Tinhof sets "Zugestellt" when
  an order is done, so partially refunded withdrawals hit the old gap.
- **Reopening a rejected withdrawal** is allowed, with the open-withdrawal check (B.6).
