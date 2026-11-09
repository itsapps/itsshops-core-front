# Plan — refund history on the order

Status: **implemented, not released** (2026-11-09) on `feature/refund-history` in core-back and
core-front (Phases 1–2 + tests; uncommitted). Open: CHANGELOGs + docs, order drafts per dataset,
`refund.updated` on the Stripe endpoints, Tinhof staging test (see Ship & docs). History: planned (2026-11-06; refined three times the same day, then simplified with the owner:
`liveEdit` orders instead of a draft double-write (F), refund source set server-side, no
`refund.updated`/`refund.failed` events, "Send mail" without an amount field, no backfill script
(G–J)); fourth refine the same day reviewed the webhook events: H changed to also subscribe
`refund.updated` (step 1.6, owner OK 2026-11-07); fifth refine 2026-11-07 (all touched files read
in full): open drafts are discarded, not published (step 0 / Ship); core-back helpers take
`(grandTotal, refunds)` (the withdrawal projection flattens `grandTotal`); refunds card in the
order view at `h4` like its neighbours; 409 detection, mocks and leftovers spelled out. Sixth
refine 2026-11-09 against core-front 3.9.0 / core-back 5.2.0 (all touched files re-read, nothing
had moved): CHANGELOG wording aligned with "discard drafts", the status dialog's refunded amount
named; then (owner OK, same day) a second sync conflict throws instead of returning null (so
Stripe retries the webhook), and the orders' lost "Publish" step goes into the customer docs and
owner notice. Seventh refine 2026-11-09 (no code commits since the sixth; webhook, refund,
notifier, mail render, stripe/sanity services, order schema + factory + action resolver, all
three Studio actions and the order view re-read): `OrderActions` deps list corrected, the new
test files' setup (server secret, `stripe` package mock, notifier mock) spelled out. Nothing implemented. A–L decided
2026-11-06/07, no decision open. Generic core behaviour,
every shop with checkout (core-front + core-back). Origin: a partial-refund mail sent from the
Studio's "Send mail" stated the order total — fixed minimally the same day (the mail now needs
`refundAmount`, "Send mail" asks for it; core-front `4223cf8` / core-back `c3e9c97`, on `main`).
This plan fixes the cause: the order doesn't know its refunds.

## Current state (verified 2026-11-06)

- A refund is created only through `payment-refund` (`createRefundHandler` →
  `refundPayment(paymentIntentId, amount?)` in `services/stripe.ts` → `stripe.refunds.create({
  payment_intent, amount? })`, cents, omitted = full = the remainder; returns the `Stripe.Refund`,
  which the handler maps to `{ refundId, status, amount }`) — called only from core-back: the
  status dialog (`OrderActions.tsx` → "Status aktualisieren") and the withdrawal "Refund & close"
  (`WithdrawalActions.tsx`, always a full refund, no amount). Refunds made in the **Stripe
  dashboard** bypass both. `payment-refund` doesn't touch Sanity today.
- The order stores only `paymentStatus` (`refunded` / `partiallyRefunded`) and `statusHistory`
  entries (no amount): the Studio patches them itself (`source: 'admin'`), and the `charge.refunded`
  webhook (`handleChargeRefunded` in `functions/payment-webhooks.ts` → `updateOrderPaymentStatus`,
  `services/sanity.ts`) sets the status from `charge.amount_refunded === charge.amount` and appends
  its own entry (`source: 'stripe'`) on **every** event (not deduplicated). Stripe charges
  `totals.grandTotal` (`payment-create.ts`).
- Payment transitions (`core-back utils/orderTransitions.ts`): `succeeded → refunded |
  partiallyRefunded`, `partiallyRefunded → refunded`. A **second partial refund is impossible from
  the Studio** (only via the dashboard). The partial-amount input is capped at `grandTotal`, not at
  what's left.
- Refund mails (`orderRefunded`, `orderRefundedPartially`) render `SimpleEmail` via `renderMailFor`
  (`templates/email/index.tsx`): `{{amount}}` = `refundAmount ?? totals.grandTotal`. Text de:
  "Wir haben Ihnen {{amount}} in voller Höhe zurückerstattet" / "… einen Teilbetrag von {{amount}}
  …". After an earlier partial refund **every** full-refund path passes/falls back to the grand
  total: `OrderActions` passes `refundAmount = grandTotal`, `WithdrawalActions` passes
  `order.grandTotal` and its dialog says "This will refund {{amount}}" with the grand total, while
  Stripe refunds only the remainder. `orderRefundedPartially` without `refundAmount` → 400 (guard in
  `sendOrderNotification`, `lib/order-notifier.tsx`, before `fetchOrderById`). Dashboard refunds
  send no mail.
- **Bug (existing):** the plain-text part of every refund mail is
  `ctx.t(\`emails.${mailType}.text\`)` **without params** (`order-notifier.tsx`, `const intro`), so it
  contains a literal `{{amount}}` (`serverT` keeps unknown placeholders). Fixed in Phase 2.1.
- `fetchOrderById` is `getDocument` (whole doc) — a new `refunds` field arrives without a projection
  change; only `OrderDocument` (`netlify/types/checkout.ts`) needs the type.
- **Drafts:** `order` is not `liveEdit` today, and some fields are editable in production (e.g.
  `fulfillment.trackingCode` — Tinhof's interim wineNET process edits and publishes it). An open
  draft is a copy of the published doc from when it was started; publishing it overwrites what a
  function wrote to the published doc meanwhile (today already a risk for `paymentStatus` /
  `statusHistory`). core-front's client is `perspective: 'published'` (`services/sanity.ts`).
  Fixed in Phase 1.0 by `liveEdit: true` (decision F). The core schema factory spreads `build()`'s
  return into `defineType` (`src/schemas/index.ts`), so `liveEdit` needs no new option on
  `ITSDocumentDefinition`.
- Studio side, verified in full: `OrderActions` reads `props.published` (type `OrderActionDoc`, no
  `refunds`), the partial input is valid for `0 < cents ≤ grandTotal`, the refund mail passes
  `refundAmount = grandTotal` for `refunded`. `WithdrawalActions` → `ResolveWithdrawalContent`
  fetches its own projection `{ _id, orderNumber, paymentIntentId, status, paymentStatus,
  "grandTotal": totals.grandTotal }` and calls `refundPayment(paymentIntentId)` with no options.
  `OrderMailAction` shows the amount field **only** for `orderRefundedPartially` and sends
  `refundAmount` only for it. `OrderView` reads `props.document.displayed ?? published` (live), its
  doc type is inline (`OrderDocument` in the file); headings: `h2` order number, `h4` inside cards
  (withdrawals, coupons, addresses), `h3` for items and status history.
- Tests: there are **no** tests for `payment-webhooks` or `payment-refund`; the notifier's refund
  tests are in `__tests__/order-email.test.tsx` (`describe('partial-refund mail')`, mocks
  `services/sanity` + `services/email`). Function-handler test pattern: `order-status.test.ts`
  (`vi.mock` of the service module + `utils/logger`).
- **Webhook events.** `createWebhookHandler` handles `payment_intent.succeeded` and
  `charge.refunded`; any other type falls through the `switch` and gets 200. Which events reach it
  is set **per shop in the Stripe dashboard** (one endpoint per mode: test = staging, live =
  production; path `/api/payment/webhooks` in Tinhof's wrapper), and **no doc records it** — the
  go-live checklist only lists the `payment-webhooks` wrapper, `configuration.md` only
  `STRIPE_ENDPOINT_SECRET`. Shops with payment functions: Tinhof, Jurtschitsch (Rosi Schuster has
  none). Stripe semantics (SDK 21 event docs): `charge.refunded` fires when a refund is **created**
  (pending refunds included, `amount_refunded` counts them); a later status change — `pending →
  succeeded`, `→ failed` (Stripe then lowers `amount_refunded` and returns the money to the
  balance), `→ canceled` — sends **`refund.updated`** (all payment methods; `refund.failed` only for
  failures, `charge.refund.updated` is the legacy "selected payment methods" variant), **not**
  `charge.refunded`. So today a failed refund leaves the order at `refunded` / `partiallyRefunded`
  with nothing on record. `Stripe.Refund` has `payment_intent: string | PaymentIntent | null`,
  `status: string | null`, `failure_reason?: string`. Disputes (`charge.dispute.*`) are not
  handled either — out of scope (Stripe mails the account owner; see Decisions → K).
- wc-api: no `refunds` (`wc-api.md` → Known gaps); Tinhof enters partial refunds in wineNET by
  hand (Tinhof frontend `CLAUDE.md` → wineNET).

## Phase 1 — Store refunds (core-back schema + core-front)

Design: **Stripe is the source of truth and core-front is the only writer of `order.refunds`.**
One helper rebuilds the whole array from Stripe; both `payment-refund` (right after creating the
refund, so the Studio shows it at once) and the `charge.refunded` / `refund.updated` webhooks
call it. No Studio
writes, no upsert merging, idempotent by construction. Whether a refund came from the Studio
travels in the Stripe refund's `metadata`, so the webhook knows it too.

0. **core-back: `order` becomes `liveEdit`** (decision F). In `src/schemas/documents/orders/order.ts`
   return `liveEdit: true` from `build` (next to `fields`/`groups`). Edits in the Studio (tracking
   code) then save straight to the published doc — no draft, no "Publish" button for orders; the
   frontend only reads orders through functions, so nothing renders early. All Studio writers
   (`OrderActions`, `WithdrawalActions`) already patch the published id; `OrderView` reads
   `displayed ?? published` (same doc now). Existing order drafts are **not** migrated by code and
   are **discarded, not published**: a draft is a stale copy, and publishing it would revert the
   `paymentStatus` / `statusHistory` that functions wrote meanwhile (see "Drafts" above). Per
   dataset before deploying (development, then production): open each draft, compare it with the
   published version (Studio "Review changes"), copy an edit the editor wants (e.g. a tracking
   code) into the published doc with a patch, then delete the draft. Development had no order
   drafts on 2026-11-07; production not checked. Ships in the same core-back release as the schema
   below.
1. **core-back schema.** New object `src/schemas/objects/orders/orderRefund.ts` (pattern:
   `orderStatusHistory.ts`; register in `src/schemas/objects.ts`), all fields
   `readOnly: !ctx.config.isDev`:
   - `refundId` string (Stripe `re_…`, required), `amount` number (cents, integer, required),
     `createdAt` datetime (Stripe `created`), `status` string (`pending` | `succeeded` | `failed` |
     `canceled` | `requires_action`, Stripe's values — kept current by `refund.updated`, step 6),
     `failureReason` string (optional, Stripe's `failure_reason`, e.g. `expired_or_canceled_card`;
     shown in the order view for a failed refund),
     `source` string (`studio` | `stripe`, decision G), `reason` string (optional, Stripe's enum
     `duplicate` | `fraudulent` | `requested_by_customer` | `expired_uncaptured_charge` (SDK 21
     `Refund.Reason`) — internal notes stay in `statusHistory.note`).
   - Preview: "date · amount · source" (`ctx.format.date`, `ctx.format.currency(amount / 100)`).
   - `order.ts`: `f('refunds', 'array', { of: [{ type: 'orderRefund' }], hidden: !ctx.config.isDev })`
     in the `history` group — hidden like `statusHistory` (the order view shows it, step 2.5; it is
     written by core-front only). Labels de/en in `localization/resources/fields_{de,en}.ts`:
     `order.fields.refunds.title` ("Rückerstattungen" / "Refunds") and a new top-level
     `orderRefund` block (`title` + `fields.<name>.title` per field), shaped like
     `orderStatusHistory` there.
   - `npm run types` (extract + typegen → `src/types/sanity.types.ts`, committed; core-back
     `.claude/decisions/typegen-coexists-with-handwritten-types.md`).
2. **core-front type.** `OrderRefund = { _key, _type: 'orderRefund', refundId, amount, createdAt,
   status, source: 'studio' | 'stripe', reason?, failureReason? }`; `refunds?: OrderRefund[]` on `OrderDocument`
   (`netlify/types/checkout.ts`). Optional — orders refunded before this release have none
   (decision J).
3. **core-front sync helper** `syncOrderRefunds(paymentIntentId): Promise<OrderRefund[] | null>` in
   **`lib/order-refunds.ts`** (with `latestRefund` of Phase 2; a lib module so tests can
   `vi.mock('../services/sanity')` / `vi.mock('../services/stripe')` like the other tests). New
   service functions:
   - `services/stripe.ts`: `listRefunds(paymentIntentId)` → `stripe.refunds.list({ payment_intent,
     limit: 100 })`, returns `.data`;
   - `services/sanity.ts`: `fetchOrderRevision(paymentIntentId)` → `{ _id, _rev } | null`
     (`*[_type == "order" && paymentIntentId == $pid][0]{ _id, _rev }`, default `published`
     perspective — `order` is `liveEdit`, step 0);
   - `services/sanity.ts`: `writeOrderRefunds({ _id, _rev }, refunds)` →
     `sanityClient.patch(_id).set({ refunds }).ifRevisionId(_rev).commit()`.
   Flow: (1) `fetchOrderRevision` — none → `log.warn`, return null; (2) `listRefunds` **after**
   reading the revision (a stale Stripe list then always loses to a newer write); (3) map every
   refund to an entry, `_key = refund.id` (stable key → identical array on every run), `source =
   refund.metadata?.itsshopsSource === 'studio' ? 'studio' : 'stripe'` (dashboard refunds have no
   metadata), `createdAt = new Date(created * 1000).toISOString()`, `status = refund.status ??
   'pending'` (the SDK types it `string | null`), `reason` only when non-null, `failureReason`
   only when `failure_reason` is set, sorted by
   `created`; (4) `writeOrderRefunds`. On a revision conflict (the patch throws `@sanity/client`'s
   `ClientError` with `statusCode === 409` — check `(err as { statusCode?: number }).statusCode`,
   as `utils/retry.ts` does) repeat
   (1)–(4) **once** (two webhooks / webhook + `payment-refund` / a Studio patch at the same
   moment); a second 409 is **thrown** (not swallowed): returning null there would let the
   webhook answer 200, so Stripe wouldn't retry and `refunds` could stay empty/stale until the
   next event for that payment, which may never come. Thrown, `payment-refund` only logs it
   (step 4) and the webhook answers 400 → Stripe retries minutes later (safe: the sync runs
   before anything is appended, step 5). Any other error (Stripe, Sanity) is thrown the same way.
   `null` means only "no order for this payment" (refunds of another system on the same Stripe
   account, a deleted test order) — callers return normally on it.
4. **`payment-refund`**: `refundPayment(paymentIntentId, amount?)` always passes `metadata: {
   itsshopsSource: 'studio' }` to `refunds.create` (the function is only called from the Studio —
   decision G; no new body field, no core-back client change). After a successful create call
   `syncOrderRefunds` inside its own try/catch; a throw is logged (`log.error`, with `requestId`),
   **not** returned as an error (the money is already refunded; the webhook syncs again). Response
   unchanged. Update the header comment (the function now writes `refunds`).
5. **Webhook** (`functions/payment-webhooks.ts`). `handleChargeRefunded`: call
   `syncOrderRefunds(paymentIntentId)` **first**, then the unchanged `updateOrderPaymentStatus`
   (status from `amount_refunded === amount`, no grandTotal comparison). Order matters:
   `updateOrderPaymentStatus` appends a history entry on every run, so a sync throw after it would
   make Stripe's retry append a duplicate; sync first, and a throw retries before anything was
   appended (the existing catch returns 400 → Stripe retries; the sync is idempotent).
6. **Webhook `refund.updated`** (decision H). New `case 'refund.updated'` →
   `handleRefundUpdated(event.data.object as Stripe.Refund)`: `paymentIntentId` from
   `refund.payment_intent` (string or `.id`, same pattern as `handleChargeRefunded`); none →
   `log.warn`, return; else `syncOrderRefunds(paymentIntentId)` (throw → existing catch → 400 →
   retry). When `refund.status === 'failed'` also `log.error('Refund failed asynchronously', {
   paymentIntentId, refundId, failureReason })` (not plain "Refund failed" — `payment-refund`
   already logs that for a failed create, and the two must be told apart in the log) (Netlify function log; no mail — decision L). Nothing else:
   **`paymentStatus` / `status` / `statusHistory` are not reverted** — core-back has no
   `refunded → succeeded` transition and the full-refund cancel of an undispatched order stays
   right. The order view shows the failed entry and "Offen" rises (failed isn't counted, Phase 2),
   the editor refunds again in the Stripe dashboard; that refund's `charge.refunded` then sets
   `paymentStatus` from the already-lowered `amount_refunded`, so the status heals itself. Event
   order doesn't matter (each event re-reads the whole Stripe list), and `refund.updated` arriving
   for a refund whose order doesn't exist (another system on the same Stripe account, deleted
   test order) is a `log.warn` + 200 via the sync's null. Only `refund.updated` is subscribed:
   it covers `pending → succeeded`, `failed` and `canceled` (`refund.failed` is a subset,
   `refund.created` duplicates `charge.refunded`). A shop whose endpoint lacks the event keeps
   working, with statuses as of the last `charge.refunded` — so core and the dashboard change
   needn't ship together.

## Phase 2 — Use them

"Counted" refunds = entries with `status` other than `failed` / `canceled` (Stripe counts pending
refunds in `amount_refunded`). "Refunded" = sum of their `amount`; "remaining" = `grandTotal −
refunded` (no `refunds` → `grandTotal`); "latest" = the counted entry with the newest `createdAt`.
Each repo gets only what it uses: core-front `latestRefund(order)` (in `lib/order-refunds.ts`, for
the mail amount); core-back `utils/orderRefunds.ts` with `type RefundLike = { amount: number;
status?: string }`, `refundedTotal(refunds?: RefundLike[]): number` and
`remainingAmount(grandTotal: number, refunds?: RefundLike[]): number` (clamped at 0) — dialog cap,
withdrawal intro, order view (decision I). They take the grand total as a number, not the order,
because the three callers hold it differently (`totals.grandTotal` in `OrderActions` /
`OrderView`, a flattened `grandTotal` in the withdrawal projection).

1. **Mails (core-front).**
   - `templates/email/index.tsx`: new exported `refundMailText(ctx, mailType, order, amountCents)`
     → the localized body: `emails.orderRefunded.textRemainder` with `{ amount, total }` when
     `mailType === 'orderRefunded'` and `amountCents < order.totals.grandTotal` (decision E — keyed
     on the amount, not on the number of refunds), else `emails.${mailType}.text` with
     `{ amount }` (amounts through `ctx.formatPrice`). `renderMailFor` uses it for the simple mails
     (replacing its inline `refundAmount ?? grandTotal` text); its `extras.refundAmount` then is
     the resolved amount.
   - `lib/order-notifier.tsx` `sendOrderNotification`: move the `orderRefundedPartially` guard to
     **after** `fetchOrderById`; for the two refund mail types resolve the amount once:
     `options.refundAmount` (explicit, from the status dialog / "Refund & close") ??
     `latestRefund(order)?.amount` ("Send mail", dashboard refunds) ?? (`orderRefunded` only)
     `grandTotal`. Nothing resolves (partial mail, no stored refund, no `refundAmount`) → 400
     `INVALID_INPUT` "No refund is stored for this order — the partial-refund mail can't state an
     amount" (shown by the Studio as the mail error). Pass the amount to `renderMailFor`, and build
     the plain-text `intro` with `refundMailText(...)` for the refund mails (fixes the literal
     `{{amount}}`); other mail types keep `ctx.t(\`emails.${mailType}.text\`)`. Update the comment
     above the guard and the `refundAmount` JSDoc ("explicit override; default: the latest stored
     refund").
   - New key `emails.orderRefunded.textRemainder` in `de_server.ts` ("Wir haben Ihnen den Restbetrag
     von {{amount}} zurückerstattet; damit ist Ihre Zahlung von {{total}} vollständig erstattet. Die
     Gutschrift erfolgt …" — rest as in `text`), `de_server.informal.ts` (Dir/Deine/Deinem — the
     informal file overrides `text` per key, so the new key needs its own entry), `en_server.ts`
     ("We've refunded the remaining {{amount}}, so your payment of {{total}} has now been refunded
     in full. …").
2. **Studio refund flows (core-back)** — stop passing the grand total:
   - `OrderActions.tsx`: `OrderActionDoc` gains `refunds?: { amount: number; status?: string;
     createdAt?: string }[]`; `remaining = remainingAmount(grandTotal, order.refunds)` (the
     existing `grandTotal = order.totals?.grandTotal ?? 0`). Partial input valid for
     `0 < cents < remaining` (step 3); the partial input's hint uses a new key
     `actions.order.updateStatus.enterAmountBelowRemaining` (de "Bitte geben Sie einen Betrag unter
     dem offenen Betrag von {{remaining}} ein — für den ganzen Rest „Refundiert“ wählen", en "Enter
     an amount below the remaining {{remaining}} — choose “Refunded” for the whole rest"), params
     `{ remaining: format.currency(remaining / 100) }` (`format` from `useITSContext`, as in
     `WithdrawalActions`), in `components_{de,en}.ts`. Refund mails pass the
     amount of the refund just created instead of `grandTotal` / `partialAmountCents`: declare
     `let refundedCents: number | undefined` in `handleConfirm` before step 1, set it inside the
     refund block after the error check (`refundedCents = result.data.amount ?? undefined` —
     `amount` is `number | null`; `result` is a `const` scoped to that block), and in step 3
     replace the `if/else if` on `newState` with `refundAmount = refundedCents` for both refund
     states. Update the `useCallback` deps: drop `grandTotal` (no longer read inside
     `handleConfirm`); keep `partialAmountCents` / `isPartialRefund` / `isPartialRefundValid` (the
     refund call still uses them); don't add `remaining` (only `isPartialRefundValid`, computed
     outside, reads it).
   - `WithdrawalActions.tsx` (`ResolveWithdrawalContent`): add `"refunds": refunds[]{ amount,
     status, createdAt }` to the order projection and `refunds?` to `ResolveOrder`; the intro's
     `{{amount}}` = `remainingAmount(order.grandTotal ?? 0, order.refunds)` instead of
     `grandTotal` (keep the existing "no grandTotal → empty string" guard); the mail passes
     `refundAmount: result.data.amount ?? undefined` (`number | null`, as in `OrderActions`) — store
     it in a `let refundedCents: number | undefined` declared before the `if (order.paymentStatus
     !== 'refunded')` block and set inside it, and add `refundAmount` to the notify options only
     when it is a number. `alreadyRefunded` path unchanged.
   - `OrderMailAction.tsx` ("Send mail"): **remove the amount field** (decision I) — the
     `partialAmount` state, `partialAmountCents` / `isPartialAmountValid`, `handleAmountChange`,
     the input block, the Send button's `isPartialRefundMail` condition, the comment above
     `partialAmount`, the now unused `grandTotal`, `OrderMailActionDoc.totals` and the `TextInput`
     import (nothing else in the file uses it); the send passes no
     `refundAmount` (core-front uses the latest stored refund, step 2.1). If the order has no
     stored refund, the partial-refund mail fails with core-front's 400 message (old orders,
     decision J). `actions.order.updateStatus.enterValidAmount` is then unused (its other
     user, `OrderActions`, switches to `enterAmountBelowRemaining` above): remove it from
     `components_{de,en}.ts`. `refundAmount` / `refundAmountLabel` stay
     (status dialog).
3. **Second partial refund** (decision D): `partiallyRefunded: ['refunded',
   'partiallyRefunded']` in `orderTransitions.ts`; the dialog caps at remaining (step 2); an amount
   equal to remaining is invalid (the hint says to use "Refunded") — otherwise the Studio would set
   `partiallyRefunded` while the webhook sets `refunded`.
4. **Dashboard refunds** (`source: 'stripe'`): recorded, **no automatic mail** (decision A) — the
   editor sends it via "Send mail", which states that refund's amount (step 2.1).
5. **Studio order view (`OrderView.tsx`)**: add `refunds?: OrderRefund[]` (inline type, like
   `StatusHistoryEntry`) to the file's `OrderDocument`. Directly after the totals card, a card
   "Rückerstattungen" / "Refunds" shaped like the coupons card right below it (`Card padding={3}
   radius={2} shadow={1} tone="transparent"`, `Stack gap={3}`, `Heading as="h4" size={1}`) —
   `h4` like the neighbouring cards (withdrawals, coupons, addresses); an `h3` here would make the
   coupon/address `h4`s read as sub-sections of "Refunds". (The view's existing `h2 → h4` skip is
   out of scope.) Rendered only when `refunds` is non-empty: a list (`Stack as="ul"` with
   `margin: 0, paddingLeft: '1.25em'`, one `Text as="li"` per refund, oldest first — as the bundle
   contents list in `OrderItemRow`): `format.date(createdAt, { dateStyle: 'medium', timeStyle:
   'short' })` · `money(amount)` · translated source · translated status when not `succeeded`
   (for `failed` followed by `failureReason` when set, raw Stripe code in parentheses — no
   translation table for Stripe's codes);
   then a `Text` "Erstattet X · Offen Y" (`refundedTotal(order.refunds)` /
   `remainingAmount(totals.grandTotal, order.refunds)`). Plain text, no
   colour-only meaning (status as words). Keys under `order.refunds` in `components_{de,en}.ts`:
   `title`, `refunded`, `remaining`, `source.{studio,stripe}` ("Studio", "Stripe-Dashboard"),
   `status.{pending,failed,canceled,requires_action}`.
(wc-api `refunds` dropped for now — decision B.)

## Tests

core-front (vitest; `vi.mock` of `../services/sanity`, `../services/stripe`, `../utils/logger` as in
`order-status.test.ts`). **New files** (none exist today): `__tests__/order-refunds.test.ts` —
`syncOrderRefunds`: same refunds twice → identical array; refund with `itsshopsSource: 'studio'` →
`studio`, without metadata → `stripe`; several partials + full, sorted; `status: null` →
`pending`; 409 → one full retry (revision **and** Stripe list re-read), second 409 → throws
(the 409 error); order not found → null → no write; `latestRefund` (failed/canceled skipped, newest wins, no
`refunds` → undefined). Test files live in `src/netlify/__tests__/`.
`__tests__/payment-refund.test.ts` — mock the **`stripe` package** (`vi.mock('stripe', () => ({
default: vi.fn(() => ({ refunds: { create } })) }))`, `vi.stubEnv('STRIPE_SECRET_API_KEY', 'sk_test')`)
so the real `refundPayment` runs, plus `../lib/order-refunds` (`syncOrderRefunds`) and
`../utils/logger`; `vi.stubEnv('SERVER_FUNCTIONS_SECRET', …)` and send the same value as
`x-server-secret` (`requireServerSecret` answers 500/401 otherwise). Cases: `create` gets
`metadata: { itsshopsSource: 'studio' }` (with and without `amount`); sync called after create
with the body's `paymentIntentId`; sync throw → still 200 with the refund body; create throw →
502, no sync.
`__tests__/payment-webhooks.test.ts` (mock `../services/stripe` with `constructWebhookEvent`
returning the event, `../services/sanity` with `updateOrderPaymentStatus`, `../lib/order-refunds`
with `syncOrderRefunds`, `../lib/order-notifier` and `../utils/logger`; with
`constructWebhookEvent` mocked no `STRIPE_ENDPOINT_SECRET` is needed; send a `stripe-signature`
header, the handler returns 400 without one) —
`charge.refunded` calls sync **before** `updateOrderPaymentStatus`, a sync throw (incl. the second-409 throw) → 400 and no
status update; `refund.updated` (step 6) → sync called with the refund's `payment_intent` (string
and expanded object), no `updateOrderPaymentStatus`, `status: 'failed'` → `log.error` with
`failureReason`, `payment_intent: null` → no sync, 200, sync throw → 400; an unhandled type
(e.g. `refund.created`) → 200 without calls. `order-refunds.test.ts` also: `failure_reason` →
`failureReason`, absent → no key. Mails — extend `order-email.test.tsx` (`describe('partial-refund mail')` →
`'refund mails'`; the file's `vi.mock('../services/sanity')` factory only defines
`fetchOrderById` / `fetchEmailSettings` — add `fetchOrderRevision: vi.fn()` / `writeOrderRefunds:
vi.fn()` to it (the notifier now imports `lib/order-refunds`, which imports them; the real
`latestRefund` is used), and the existing partial-refund 400 test now runs **after**
`fetchOrderById`, so its mock must return an order without `refunds`): latest stored refund used /
explicit `refundAmount` wins / no stored refunds
(full → grandTotal, partial → 400) / `orderRefunded` with an amount below the total → remainder
text naming both amounts / plain-text part (`sent().text`) contains the amount, no `{{`.
core-back: new `tests/orderTransitions.test.ts` (decision D: `partiallyRefunded →
partiallyRefunded`) + `tests/orderRefunds.test.ts` (`refundedTotal`/`remainingAmount`:
failed/canceled not counted, no `refunds` → remaining = grandTotal, refunds above the total →
remaining 0) — core-back's tests live in
top-level `tests/` (e.g. `tests/countries.test.ts`; `npm test` = vitest). Order view and dialogs by
hand on staging (Tinhof): partial → partial → full (each mail's amount), a dashboard refund +
"Send mail", "Refund & close" after a partial, editing the tracking code (saves without Publish),
a failed refund (Stripe test card `4000 0000 0000 5126` — "refund fails asynchronously": the
order view switches the entry to failed via `refund.updated`, a dashboard re-refund heals
`paymentStatus`). Webhook deliveries per event: Stripe dashboard → Webhooks → the endpoint's
event log.

## Decisions (2026-11-06; H revised, L added 2026-11-07)

- **A — Mail for dashboard refunds:** manual. A refund made in the Stripe dashboard is recorded,
  but sends no mail by itself (refunds there can have other reasons — disputes, tests); "Send mail"
  states its amount.
- **B — wc-api `refunds`:** not built. wineNET (most likely) doesn't read WooCommerce refunds —
  Tinhof corrects refunds by hand in wineNET (owner, 2026-11-06). Revisit only when an ERP reads
  them; then WC's `refunds: [{ id, reason, total: "-12.50" }]` on the order. `wc-api.md` keeps the
  known gap.
- **C — Credit notes:** out of scope until an owner or tax advisor asks (shops with core invoices
  only; Tinhof's come from wineNET).
- **D — Second partial refund from the Studio:** yes (Phase 2.3), capped at the remaining amount.
- **E — Full-refund mail after a partial refund:** the remainder text (Phase 2.1), naming the
  remainder and the total.
- **F — Drafts:** `order` becomes `liveEdit` (Phase 1.0) instead of writing `refunds` to the
  published doc and its draft; this also protects `paymentStatus` / `statusHistory`. Existing
  drafts: before the deploy the owner carries over wanted edits and discards them (no migration
  script; publishing a stale draft would revert function writes — corrected 2026-11-07).
- **G — Refund source:** `studio` | `stripe` only, set by `payment-refund` itself (it is only
  called from the Studio). Whether it was "Refund & close" shows on the withdrawal record.
- **H — Webhook events (2026-11-07, revised from 2026-11-06):** also
  subscribe **`refund.updated`** in addition to `payment_intent.succeeded` + `charge.refunded`
  (step 1.6). Without it a failed refund — the customer was told the money is back, it isn't —
  stays recorded as succeeded and counted, and a pending one (insufficient Stripe balance, or a
  bank-based method's async refund) never turns succeeded. Cost: one event added to the endpoint
  in test and live mode for Tinhof and Jurtschitsch; optional per shop (without it the shop just
  keeps statuses as of creation). Not subscribed: `refund.created` (= `charge.refunded`),
  `refund.failed` (⊂ `refund.updated`), `charge.refund.updated` (legacy),
  `payment_intent.payment_failed` / `processing` (delayed methods unsupported —
  `decisions/payment-methods-not-restricted-in-core.md`). Original H (2026-11-06): no new events,
  status as of the last sync — replaced because a failed refund would stay recorded as refunded.
- **I — "Send mail" has no amount field:** the mail states the latest stored refund; the status
  dialog and "Refund & close" pass the amount they just refunded.
- **J — No backfill:** orders refunded before the release have no `refunds`. Consequences (few
  orders, e.g. one Tinhof DE order): the dialog cap stays at the grand total (Stripe refuses an
  excess), the withdrawal intro shows the grand total, "Send mail" can't send the partial-refund
  mail (400 message) and the full-refund mail states the grand total. Any new refund on such an
  order syncs its full Stripe list, old refunds included (`source: 'stripe'`).
- **K — Disputes (`charge.dispute.*`):** out of scope. A chargeback isn't a refund (no
  `refunds` entry, money withdrawn by the bank); Stripe mails the account owner and the dispute
  is answered in the dashboard. Revisit if an owner wants it on the order.
- **L — No mail on a failed refund (2026-11-07):** a failed refund shows only in the order view
  and the function log (`log.error`), no mail to the shop inbox — card/wallet refunds rarely fail;
  revisit after the first one.

## Ship & docs

Before deploying core-back per shop: the owner resolves all `drafts.order-*` in that dataset
(development, then production) as in step 1.0 — carry over wanted edits, then **discard** the
draft (never publish it). Find them with `*[_id in path("drafts.order-**")]{_id, orderNumber,
_updatedAt}` (raw perspective, e.g. Vision, or `npx itsshops sanity query` in the customer repo;
order ids are `order-<uuid>`). Tinhof development: none (2026-11-07). core-back first (`liveEdit`, schema, types, Studio
flows), then core-front (it writes the new field; a Studio without the schema shows it as unknown
field). Build both, push `main`, pin on staging per `consuming-core-and-deploy.md`, test on Tinhof
staging. **Stripe dashboard** (decision H): add `refund.updated` to the webhook
endpoint — test mode before the staging test, live mode before the production release — for
Tinhof and Jurtschitsch (Developers → Webhooks → endpoint → events; the signing secret stays,
`STRIPE_ENDPOINT_SECRET` unchanged). Record it in each customer `CLAUDE.md` (Tinhof go-live
status). CHANGELOG entries in both cores (core-back: "orders are
`liveEdit` — before upgrading, carry wanted edits from open order drafts into the published order
and **discard** the drafts (publishing one reverts webhook writes)"; core-front: "subscribe
`refund.updated` on the Stripe webhook endpoint"; minor bump each — core-back 5.2.0 → 5.3.0,
core-front 3.9.0 → 3.10.0 unless something else ships first). Docs: core-front
`commerce-and-netlify.md` → "Refunds (Studio order action → `payment-refund`)" rewritten (single
writer, `liveEdit` orders, `studio`/`stripe` source via metadata, webhook order, `refund.updated`
keeps statuses current and doesn't revert `paymentStatus`, mail amount resolution + remainder
text; drop "the order stores no refund amounts"); core-front `go-live-checklist.md` → new
"Stripe" item: webhook endpoint `https://<site>/api/payment/webhooks` (the wrapper's `path`) in
test **and** live mode, events `payment_intent.succeeded`, `charge.refunded`, `refund.updated`,
signing secret → `STRIPE_ENDPOINT_SECRET` (today undocumented anywhere);
core-back `schemas.md` (orders: `liveEdit`, `refunds`), `studio-components.md` (order view, status
dialog cap, "Send mail" without amount, withdrawal dialog); Tinhof frontend `CLAUDE.md`
(wineNET: partial refunds by hand — unchanged, just point to the order's refund list; the interim
shipping process loses its publish step — "enter the tracking code on the order (saves at once,
no Publish), then Studio 'Send mail' → shipping mail"; same check in Jurtschitsch's `CLAUDE.md`
if it describes a publish step for orders). **Tell the owners** (Tinhof, Jurtschitsch) with the
release: order edits save immediately, there is no "Publish" button on orders any more. Then
delete this file.
