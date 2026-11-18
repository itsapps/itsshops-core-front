# Plan — wc-api: an ERP's `completed` can mean "accepted", not "shipped"

Status: **built** (2026-11-18) on branch `feat/wc-api-erp-accepted` in core-front + core-back
(steps 1–7 + tests done), merged to `main` (core-front `cc7fe57`, core-back `4c6284e`).
Rollout: 1 done; 2 done on Tinhof staging (2026-11-18, order 000019 — PUT, both filters,
repeat PUT; Studio check by the owner open); 3–5 wait — released together with store pickup. Refined 2026-11-18 (round 1, 90/100; checked against `wc-api.ts`,
core-back order schema / `OrderView.tsx` / history labels). Spans **core-front** (wc-api option, status
mapping, list filter) and **core-back** (order field, history entry, Studio display). Tinhof
(wineNET) is the first user. **Prerequisite for store pickup** (`store-pickup.md`, decision 10):
without it, wineNET turns a pickup order "Abholbereit" when it becomes an Auftrag.

## Problem

wineNET sends `PUT orders/:id {status: completed}` as soon as Tinhof turns a Vormerkung into an
Auftrag — automatically, Tinhof can't pick a status (Tinhof `CLAUDE.md` → wineNET; seen again
2026-11-17 on order 13). The wc-api maps `completed` → `shipped` (`STATUS_FROM_WC`), so the order
is "Versendet" days before dispatch. Since frontend 1.9.4 the wrapper passes no `notify`, so no
early shipping mail — but then the shipping mail (with tracking code) has to go via Studio "Send
mail", because the status dialog can't move an order that's already `shipped`.

**Why not just keep reporting `processing`:** wineNET polls
`GET orders?status=pending,processing,on-hold&after=<now − 2 days>&before=<now − 10 min>`
(log 2026-11-17; `after`/`before` filter `_createdAt`, `wc-api.ts` `handleListOrders`). An order
that stays `processing` after wineNET marked it `completed` would come back in every poll until it
is 2 days old. Whether wineNET de-duplicates by order id is unknown, and wineNET doesn't answer
(asked 2026-10-23). So we must not change what wineNET sees.

## Decisions (owner, 2026-11-18)

1. **wineNET keeps seeing its own status.** After its `PUT completed` the wc-api reports
   `completed` for that order exactly as today — list, filter and PUT response. Nothing changes
   from wineNET's side, so there's no re-import risk, whatever its de-duplication does.
2. **Internally the order isn't shipped.** It becomes (or stays) `processing`, and the wc-api stores
   that the ERP accepted it. The shop moves it to `shipped` itself in the Studio status dialog
   (tracking code + shipping mail, the normal flow), or for pickup to "Abholbereit".
3. **Opt-in per shop** — option on the core factory, default = today's behaviour:
   `createWcApiHandler({ completedMeans: 'shipped' | 'accepted' })`, default `'shipped'`. A core
   option is fine here: the wc-api is core and can't be overridden (core-front `CLAUDE.md` →
   "What goes into core"). Tinhof's wrapper (`netlify/functions/wc_api.mts`) sets `'accepted'`.
4. **No migration.** Tinhof's existing orders that wineNET already moved to `shipped` stay as they
   are (they're reported `completed` either way).

## Mechanism (`completedMeans: 'accepted'`)

- **New order field `erpAcceptedAt`** (datetime, core-back, read-only). Set by the wc-api on the
  first `PUT completed` (`setIfMissing`, so a repeat never overwrites it).
- **`PUT completed`** (`handleUpdateOrder`):
  - same guard as today (refunded / open withdrawal / `canceled` → 409) — an Auftrag for a
    withdrawn order must still be refused. In code the guard keys on `internalStatus ===
    'shipped'`; in `accepted` mode check `wcStatus === 'completed'` instead (internally nothing
    becomes `shipped` any more);
  - status: `created` → `processing`; **every other status unchanged** (`processing`, `shipped`,
    `delivered`, `returned` — never moved by an accept);
  - patch: `setIfMissing({ erpAcceptedAt: now })`, plus `set({ status: 'processing' })` only when
    it was `created`;
  - history (only when `erpAcceptedAt` was unset before — a repeat PUT appends nothing):
    `{ type: 'erp', status: 'accepted', source: 'wc-api' }`; when the status changed
    `created` → `processing`, also the usual `{ type: 'fulfillment', status: 'processing',
    source: 'wc-api' }` (every status change keeps its fulfillment entry, as today);
  - **no** `notify` in this mode (also when the wrapper passes one — accepting isn't shipping);
  - response: `mapOrder({ ...order, status: newStatus, erpAcceptedAt: order.erpAcceptedAt ??
    now }, tz, 'accepted')` → reported `completed`.
- **`PUT processing`:** `unset(['erpAcceptedAt'])` (the ERP took it back) + status as today.
  **`PUT cancelled` / `refunded`:** as today (`erpAcceptedAt` stays; the new status isn't
  pre-dispatch, so rule 3 below doesn't apply).
- **Reported status (`mapOrder`)**, precedence:
  1. fully refunded → `refunded` (today; same as today for a shipped+refunded order);
  2. **new:** `completedMeans === 'accepted'` and `erpAcceptedAt` set and status
     `created`/`processing` → `completed`;
  3. open withdrawal on a pre-dispatch order → `cancelled` (today);
  4. otherwise `STATUS_TO_WC` (today; `shipped`/`delivered` → `completed`).
  Rule 2 comes **before** the withdrawal rule because of decision 1: today a withdrawn order
  wineNET already accepted is `shipped` and reports `completed`, and the list filter below keeps
  accepted orders out of wineNET's `processing` poll anyway, so a `cancelled` would never reach
  it. A withdrawal on an accepted order is cancelled in wineNET by hand — as today (tell Tinhof,
  Rollout 4).
  Signature: `mapOrder(order, tz, completedMeans: 'shipped' | 'accepted' = 'shipped')` — the
  existing two-argument calls (tests) stay valid.
- **List filter (`handleListOrders`)** must match the reported status, not only the internal one
  (only in `accepted` mode; `shipped` mode keeps today's filter byte-for-byte):
  - requested `processing`: exclude pre-dispatch orders with `erpAcceptedAt`;
  - requested `completed`: also include pre-dispatch orders with `erpAcceptedAt`.
  Pushed as **one** parenthesised element of `filters` (they're joined with ` && `), replacing
  `status in $statuses`:
  `((status in $statuses && !(defined(erpAcceptedAt) && status in ["created","processing"]))
   || ($wantsCompleted && defined(erpAcceptedAt) && status in ["created","processing"]))`,
  `params.wantsCompleted = requestedWcStatuses.includes('completed')`. The `count(...)` reuses
  the same `base`, so `x-wp-total` stays right. Build the filter in a small exported pure helper
  (`statusFilter(requestedWcStatuses, completedMeans)` → `{ filter, params }`) so it's unit-tested.
- **Concurrency:** no `ifRevisionId` — same as today's PUT (a Studio change in the same second
  could be overwritten by `created` → `processing`; accepted risk, unchanged).
- **History entry `type: 'erp'`** (decided while refining — verified that nothing reads history by
  `type` except the display: `StatusIcon` uses only `status`/`paymentStatus`, `orderRefunds.ts`
  only writes, `InvoicePdf`/`OrderEmail` read `statusHistory[0].timestamp` only, the pickup plan's
  deadline reads the latest `shipped` entry). Label "Warenwirtschaft" / "ERP", status
  "Übernommen" / "Accepted".

## Steps — core-back

1. `schemas/documents/orders/order.ts`, `fieldsMap.order` (order only, not `orderMeta` — the
   shared fields file is `orderAndOrderMetaFields.ts`): `f('erpAcceptedAt', 'datetime', {
   readOnly: !ctx.config.isDev, hidden: !ctx.config.isDev, options:
   ctx.format.dateFormat('datetime') })` — like `orderDate`/`status` (the editor sees orders
   through `OrderView`). Label in `fields_de/en.ts` next to `orderDate` (~l.939):
   "Von Warenwirtschaft übernommen" / "Accepted by ERP".
2. `schemas/objects/orders/orderStatusHistory.ts`: type list `+ { value: 'erp' }`; in `prepare`,
   an `erp` branch for `statusString` (like the `mail` one) →
   `componentT('order.statusHistory.erpStatus.accepted')`. Labels:
   - `fields_de/en.ts` `orderStatusHistory.fields.type.options.erp`: "Warenwirtschaft" / "ERP";
   - `components_de/en.ts` `order.statusHistory.type.options.erp` (same text — `OrderView`'s
     `tHistoryType` reads this one) and `order.statusHistory.erpStatus.accepted`:
     "Übernommen" / "Accepted"; `order.erpAccepted`: "In der Warenwirtschaft übernommen am
     {{date}}" / "Accepted by the ERP on {{date}}".
3. `components/OrderView.tsx`:
   - `OrderDocument` `+ erpAcceptedAt?: string`; `StatusHistoryEntry` union
     `+ | { type: 'erp'; status: 'accepted' }`;
   - header (after the date / payment lines, ~l.358–368): `<Text muted>` with `order.erpAccepted`
     (`format.date(..., { dateStyle: 'medium', timeStyle: 'short' })`) while `erpAcceptedAt` is
     set and status is `created`/`processing` — so the shop knows "wineNET has it, still to ship".
     Plain text, no colour-only cue;
   - history list (~l.599): an `entry.type === 'erp'` branch →
     `${tHistoryType('erp')} - ${t('order.statusHistory.erpStatus.accepted')}` (today's fallback
     would print the raw `accepted`, since `getStateTranslationKey` doesn't know it).
4. `npm run types` (extract + typegen → `src/types/sanity.types.ts`), `npm run build`,
   CHANGELOG `## Unreleased` (minor: new read-only order field + history type, nothing to do for
   customers).

## Steps — core-front

5. `src/netlify/functions/wc-api.ts`: `WcApiConfig.completedMeans?: 'shipped' | 'accepted'` with a
   doc comment (use `'accepted'` when the ERP sends `completed` on acceptance, not dispatch;
   `notify` is then ignored for `completed`); `ResolvedWcApiConfig.completedMeans` (default
   `'shipped'`, set in `createWcApiHandler`); `SanityOrder.erpAcceptedAt: string | null`;
   `ORDER_PROJECTION` `+ erpAcceptedAt`; `mapOrder` third param; `statusFilter` helper; PUT as
   above (`handleUpdateOrder` already gets `config`). Pass `config.completedMeans` to every
   `mapOrder` call (list + PUT response).
6. `src/netlify/types/checkout.ts` `OrderStatusHistoryEntry.type` `+ 'erp'` (core-front has no
   generated `sanity.types` — the order types are hand-written there and in `wc-api.ts`).
   CHANGELOG `## Unreleased` (minor, opt-in, no customer change needed).
7. Docs: `wc-api.md` — "Setup" options (`completedMeans`), "Status" (mapping in `accepted`
   mode, the new precedence, the list filter), "wineNET behaviour" → "Status PUT on Auftrag"
   (replace "Open (asked wineNET)…" with the option), the poll from the 2026-11-17 log.
   `commerce-and-netlify.md` only points to `wc-api.md` — no change.

## Tests (vitest, `src/netlify/__tests__/wc-api.test.ts`)

Today the file mocks `sanityClient` as `{}`; the PUT tests need a mock with `fetch` (returns a
fixture order) and a chainable `patch()` (`set` / `setIfMissing` / `unset` / `append` / `commit`
as `vi.fn`s returning the chain) to assert what's written.

- `mapOrder` `accepted`: `erpAcceptedAt` + `created`/`processing` → `completed`; + open withdrawal
  → still `completed`; + `paymentStatus: refunded` → `refunded`; same order with mode `shipped`
  (or no third arg) → `processing` / `cancelled` as today.
- `statusFilter`: `accepted` + `pending,processing,on-hold` → excludes accepted pre-dispatch;
  `completed` → includes them (`wantsCompleted: true`); `shipped` mode → exactly today's
  `status in $statuses`.
- PUT `accepted`: `completed` on `created` → `set({status:'processing'})`,
  `setIfMissing({erpAcceptedAt})`, history `erp` + `fulfillment/processing`, `sendOrderNotification`
  not called even with `notify: {}`, response `status: 'completed'`; on `shipped` → no `set`,
  only `erp` entry; repeat on an order with `erpAcceptedAt` → no history entry.
- PUT `accepted`: `completed` on a refunded / withdrawn / canceled order → 409 (as today).
- PUT `accepted`: `processing` → `unset(['erpAcceptedAt'])`.
- `shipped` (default): every existing test unchanged; PUT `completed` still sets `shipped`.
- Integration: Tinhof's `tests/integration/wc-api.test.ts` (not a `test-utils` suite) — "filter
  by status" asserts every `status=processing` result reports `processing`; an accepted order on
  staging is excluded by the filter, so it still holds (it already fails while a staging order has
  an open withdrawal — known, Tinhof `CLAUDE.md`).

## Rollout (Tinhof)

1. Build core-back + core-front (feature branches), push them, link; Tinhof frontend wrapper
   `netlify/functions/wc_api.mts`: `completedMeans: 'accepted'`, comment rewritten (wineNET sends
   `completed` on Auftrag → stored as accepted; still no `notify`). Tinhof backend: pin the
   core-back commit (no schema change of its own).
2. "release tinhof staging": staging order → simulate wineNET with `PUT orders/:id
   {status: completed}` (curl with the staging keys) → Studio shows "In Bearbeitung" + "Von
   Warenwirtschaft übernommen"; `GET orders?status=processing` doesn't return it,
   `?status=completed` does; set "Versendet" with tracking code in the Studio → shipping mail.
   If wineNET tests on staging (access was offered), let a real conversion run through it.
3. Release (core tags, Tinhof frontend + backend), production.
4. Tell Tinhof (in the pickup mail, point 10): after converting to an Auftrag in wineNET the order
   stays "In Bearbeitung" in the Studio; set "Versendet" (tracking code) when the parcel leaves —
   only then does the customer get the mail. Nothing changes in wineNET. No more "Send mail" for
   the shipping mail. A withdrawal on an order already turned into an Auftrag: cancel the Auftrag
   in wineNET by hand (as today — wineNET keeps seeing `completed`).
5. Update Tinhof `CLAUDE.md` → wineNET (interim process replaced; the question to Andi about
   `processing` on conversion is moot) and core-front `wc-api.md`; `store-pickup.md` decision 10's
   prerequisite is met.

## Open

- Owner, nice to have: should the Studio order list show accepted-but-unshipped orders
  differently (e.g. own icon in `StatusIcon`)? Recommendation: not now — the order view's
  "übernommen am" line is enough; revisit if Tinhof asks.
- If wineNET ever answers that it de-duplicates by id, nothing needs to change — the mode stays
  correct either way.
