# Plan — withdrawals: guided editor flow + `liveEdit`

Status: **planned** (2026-11-09), nothing implemented. **core-back only** (plus docs); core-front
reads published withdrawals already. Every shop with checkout. Goal (owner, 2026-11-09): editors
handle a withdrawal **correctly and know what to do next** — today they get a flat list, no next
step, no deadline, and two statuses (withdrawal + order) to keep in step by hand.

## Today (checked 2026-11-09)

- **Withdrawal** (`orderWithdrawal`, `src/schemas/documents/orders/orderWithdrawal.ts`): own
  document, linked via `orderRef`. `status` = worklist only: `unmatched` / `received` (automatic),
  `processing` / `rejected` (dropdown), `refunded` (dropdown **or** "Refund & close"). Changing it
  does nothing to the order.
- **"Refund & close"** (`WithdrawalResolveAction`, `components/actions/WithdrawalActions.tsx`):
  **full** refund only (`frontendClient.refundPayment` without amount = the rest), sets the order
  `paymentStatus: refunded` (+ `canceled` if undispatched, `refundCancelsFulfillment`), withdrawal
  → `refunded`, optional `orderRefunded` mail. Partial refunds and "returned" go through the
  order's "Status aktualisieren" (`OrderActions.tsx`), after which the editor sets the withdrawal
  to "Erstattet" by hand.
- **Lists:** `config/structure.ts` → one "Widerrufe" list (`mapItems([… 'orderWithdrawal' …])`),
  open and closed mixed.
- **Order view** (`components/OrderView.tsx`): a "Widerrufe" card (tone caution) lists the
  order's withdrawals with a status badge and links to them. The order's refund dialog says
  nothing about an open withdrawal.
- **Drafts:** withdrawals aren't `liveEdit`. Stopgap (2026-11-09): "Refund & close" disabled
  while a draft exists (`props.draft`, key `actions.orderWithdrawal.resolve.draftOpen`) — publishing
  an older draft reverted `refunded`. Part D removes it.
- **Deadline:** none shown. FAGG §14: refund within 14 days of receiving the declaration; the
  shop may hold it back until the goods are back or the customer proves dispatch. Unmatched
  records: delete after checking, at the latest after 30 days (existing rule, field description).

## A — Next step + deadline on every withdrawal

A guide box above the form, rendered by a document-level `components.input` wrapper on
`orderWithdrawal` (`renderDefault` below it; no stored field). Reads the linked order
(`status`, `paymentStatus`, refunds via `utils/orderRefunds.ts`). Pure function
`withdrawalNextStep(withdrawal, order) → { step, dueDate?, overdue }` in `utils/` (testable):

| Withdrawal | Order | Text (de, gist) |
|---|---|---|
| `unmatched` | – | Assign the order (action "Bestellung zuordnen") or delete after checking — by 〈declaredAt + 30 d〉 |
| `received` / `processing` | undispatched (`created` / `processing`) | Not shipped → "Erstatten & abschließen" |
| `received` / `processing` | `shipped` / `delivered` | Wait for the goods (set "In Bearbeitung"); once back or proof of dispatch → "Erstatten & abschließen" |
| `refunded` | – | Done: refunded €X on 〈date〉 (from `order.refunds`) |
| `rejected` | – | Closed as rejected (see internal note) |

Open ones also show the **deadline with the legal hint** (owner, 2026-11-09):

> Erstattung bis 〈declaredAt + 14 d〉 (14 Tage ab Eingang des Widerrufs). Zurückhalten erlaubt,
> bis die Ware zurück ist oder der Versand nachgewiesen wird.

`tone="caution"` from 3 days before; overdue: `critical` + "Überfällig seit 〈due + 1 d〉" — the
state is in the text, not colour alone (a11y). en alongside; `componentT` keys under
`actions.orderWithdrawal.guide.*`.

**Owner guide in the Studio** (owner, 2026-11-09): a collapsible "So geht's" section at the end of
the guide box — the whole flow in a few steps (assign or delete unmatched; not shipped → refund;
shipped → wait, then refund full or partial, "Ware ist zurück"; reject with a note; the deadline).
A native `<details>`/`<summary>` (keyboard + screen reader without extra ARIA), closed by default,
same texts for every shop (de + en). No separate document to keep in sync.

## B — "Refund & close" covers every case

Extend `ResolveWithdrawalContent`:
1. **Amount:** "Full (rest €X)" (default) or "Partial" with an amount field — same rules as the
   order dialog (integer cents, `0 < amount < remaining`, `remainingAmount` from
   `utils/orderRefunds.ts`). Extract the shared refund step (refund → patch `paymentStatus` +
   history, cancel if undispatched on full) from `OrderActions.tsx` / `WithdrawalActions.tsx`
   into one helper so both dialogs behave the same. Mail: `orderRefunded` or
   `orderRefundedPartially` with `refundAmount` (core-front `order-notify`).
2. **"Ware ist zurück"** checkbox, only for a **full** refund of a `shipped` / `delivered` order
   (`getAllowedFulfillmentTransitions` allows `returned` there once `refunded`): also sets the
   order `returned` (+ history entry; no separate `orderReturned` mail — the refund mail covers it).
3. Withdrawal → `refunded` in both cases (partial = the shop's decision that the rest is kept).
4. **`refunded` no longer in the status dropdown:** a small custom status input offers
   `received` / `processing` / `rejected`; `refunded` and `unmatched` show read-only when set.
   So "Erstattet" only comes from the action that actually refunds.

## C — Worklist and the order side

1. **Structure:** "Widerrufe" becomes a list with two filtered children — **"Offen"**
   (`status in ["unmatched","received","processing"]`, ordered `declaredAt asc` = nearest
   deadline first) and **"Erledigt"** (`refunded`, `rejected`, `declaredAt desc`). A `custom`
   structure item like `productsMenu` (check `ITSStructureItem` supports it the same way).
2. **Order refund dialog** (`OrderActions.tsx`): when the order has an open withdrawal
   (`hasOpenWithdrawal`, exists in `WithdrawalActions.tsx`), show a notice above the refund
   options: "This order has an open withdrawal — handle the refund there" with an `IntentLink`
   to it. A notice, not a block (a refund for another reason stays possible).
3. **Order view card:** show the due date (from A's helper) next to the badge for open ones.

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

1. Schema: `liveEdit: true` from `build` (as `order.ts`); `orderRef` read-only (set by actions);
   its validation moves into the action; `WithdrawalOrderInput` becomes read-only (or is dropped).
2. **`WithdrawalAssignAction`** (registered in `config/actions.ts` next to Resolve/Resend), while
   `unmatched`: dialog with the suggestions (move `SUGGESTIONS_QUERY` + `SuggestionCard` from
   `WithdrawalOrderInput.tsx`) + an order-number search; before "Confirm" the dialog shows the
   picked order's number, date, **customer name and email** (a wrong pick would mail the receipt
   to a stranger — the undo can't take that back) → confirm → re-check
   `hasOpenWithdrawal`, refuse with `create.alreadyOpen`; one patch
   `set({ orderRef, status: 'received', assignedAt })`; checkbox "send confirmation to the order's
   email" (default on) → `withdrawNotify` (core-front writes the `withdrawalReceipt` history entry).
3. **`WithdrawalUnassignAction`** (undo a wrong pick): shown **only** while `status ===
   'received'` **and** `assignedAt` is set (assigned in the Studio) → unset `orderRef` +
   `assignedAt`, `status: unmatched`; append a line to `note` ("Zuordnung zu #〈n〉 aufgehoben,
   〈date〉") so the record keeps a trace. Gone once `processing` / `refunded` / `rejected`;
   web-matched records (no `assignedAt`) can never be unassigned. `assignedAt`: datetime,
   read-only, hidden outside dev.
4. Remove the stopgap (`hasDraft` + `draftOpen` keys).
5. Draft check before the upgrade, per dataset, raw perspective
   `*[_id in path("drafts.**") && _type == "orderWithdrawal"]` (HTTP API `perspective=raw`;
   core-front's `itsshops sanity` CLI doesn't see drafts — core-back ADR `orders-live-edit.md`):
   carry wanted edits over, then **discard**. Tinhof development + production, Jurtschitsch,
   Rosi Schuster.

## Order of work

D first (it changes the flow A's texts describe), then B, A, C — one core-back minor. A without D
would have to say "publish first"; avoid writing texts twice.

## Tests

core-back unit tests (`tests/`, pure helpers in `utils/`): `withdrawalNextStep` (every row of A's
table, due/overdue boundaries, shop timezone not needed — dates only), the action visibility rules
(assign / unassign / resolve), the shared refund helper's amount rules (reuse the existing
`orderRefunds.test.ts` style). By hand on staging: each row of A's table; full + partial refund
from the withdrawal (amounts, mails, history entries, order status, "Ware ist zurück"); dropdown
without "Erstattet"; "Offen"/"Erledigt" lists; notice in the order's refund dialog; assign with a
wrong pick + unassign; no Publish button.

## Ship

core-back **minor**, **Upgrading:** resolve withdrawal drafts (D.5); tell shop owners: no
"Publish" for withdrawals, orders are assigned via "Bestellung zuordnen", refunds (also partial)
via "Erstatten & abschließen". CHANGELOG. Docs: core-back `schemas.md` (`liveEdit`,
`assignedAt`, status input), `studio-components.md` (guide box, Assign/Unassign, extended
Resolve, structure lists, order dialog notice; drop the stopgap paragraph), ADR
`withdrawals-live-edit.md` (assign action replaces the publish step) — or extend
`orders-live-edit.md`. Customers: no code change;
the draft check per dataset. Delete this file when done.
