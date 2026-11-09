# Plan — status history: readable sources and mail entries

Status: **planned** (2026-11-09), nothing implemented. Refined 2026-11-09 (checked against the
code: view types, stale doc comments, live tests). Cut down 2026-11-09 from "one
status-history entry per refund" (duplicates accepted, see Decided); mail entries added back the
same day. Refined again 2026-11-09 (tests, stale comments); third pass the same day (all `statusHistory` readers/writers, docs anchors). Generic core behaviour, **core-front + core-back**, every shop with checkout. No data
migration (old orders simply have no mail entries).

## Decided

- **Duplicate refund entries stay.** A Studio refund shows its payment entry twice in
  `order.statusHistory` (the dialog's `admin` entry, then the `charge.refunded` webhook's `stripe`
  entry), and every resent `charge.refunded` adds another (`updateOrderPaymentStatus`, core-front
  `services/sanity.ts`, appends unconditionally). Not fixed: amounts and statuses are right, and
  the order view's "Rückerstattungen" card (`order.refunds`) is the authoritative refund record.
  Noted in core-front `commerce-and-netlify.md` → Refunds.
- **Stored `source` values stay**; only the view translates them.
- **Every customer order mail gets a `mail` history entry** (owner, 2026-11-09), so the editor
  sees which mails a customer got. Written by core-front's notifier, only after a successful send.
- **The customer message lives on the mail entry only** (owner, 2026-11-09): the status dialog no
  longer stores `customerMessage` on its own status entry (it is written before the mail is sent,
  so a failed mail left a message that never went out). Old entries keep theirs.

## History writers (checked 2026-11-09)

| Writer | Where | `source` |
|---|---|---|
| Order created (first entry) | core-front `lib/order-builder.ts` | `stripe` |
| `charge.refunded` webhook | core-front `services/sanity.ts` `updateOrderPaymentStatus` | `stripe` |
| wineNET status update | core-front `functions/wc-api.ts` | `wc-api` |
| Status dialog | core-back `components/actions/OrderActions.tsx` | `admin` |
| Withdrawal "Refund & close" | core-back `components/actions/WithdrawalActions.tsx` | `admin` |
| **new:** customer mail | core-front `lib/order-notifier.tsx` `sendOrderNotification` | `admin` / `system` / `wc-api` |

No customer repo (Tinhof, Jurtschitsch `webshop-*`, Rosi Schuster `itsshops_*`) writes history.

## Part 1 — readable sources (core-back)

History `source` says **who wrote the entry**; the order view shows it raw
(`src/components/OrderView.tsx`, `{entry.source && <Text muted>{entry.source}</Text>}`), while the
refunds card translates its own (`order.refunds.source.*`).

1. `src/localization/resources/components_{de,en}.ts` → under `order.statusHistory` add
   `source: { admin, stripe, 'wc-api', system }` — de "Studio", "Stripe", "Warenwirtschaft",
   "Automatisch"; en "Studio", "Stripe", "ERP", "Automatic".
2. `OrderView.tsx`, history card: replace the raw line with
   ``t(`order.statusHistory.source.${entry.source}`, entry.source)`` — unknown values stay raw.

## Part 2 — mail entries

### core-front

1. `netlify/types/checkout.ts`: `OrderStatusHistoryEntry.type` becomes
   `'payment' | 'fulfillment' | 'mail'`; its `customerMessage` doc comment ("Message sent to the
   customer with the status mail") → "… with this mail (`mail` entries; older status entries may
   carry one too)".
2. `netlify/services/sanity.ts`: new
   `appendOrderHistory(orderId: string, entries: OrderStatusHistoryEntry[]): Promise<void>` —
   `sanityClient.patch(orderId).append('statusHistory', entries).commit()` (no `ifRevisionId`; a
   concurrent `syncOrderRefunds` write retries on its own 409).
3. `lib/order-notifier.tsx`:
   - `SendOrderNotificationOptions` gets `historySource?: string` (default `'admin'`).
   - In `sendOrderNotification`, after `sendMail` returned: append
     `{ _key: crypto.randomUUID(), _type: 'orderStatusHistory', type: 'mail', status: mailType,
     timestamp: new Date().toISOString(), source: options.historySource ?? 'admin',
     ...(customerMessage && { customerMessage }) }` (the trimmed message actually sent). Wrap in
     try/catch: on error `log.error('Mail history entry failed', { orderId, mailType, error })` and
     still return the result — the mail is out, the caller must not report a failure.
   - `sendShopOrderNotification` (shop inbox) appends nothing. Withdrawal mails
     (`order-withdraw-notifier.tsx`) are not touched.
   - Header comment: add `functions/wc-api.ts` (shipping mail, only with `notify`) to "Used by" and
     say a sent customer mail appends a `mail` history entry.
4. Callers:
   - `functions/order-notify.ts` (status dialog, "Send mail", "Refund & close"): nothing to change
     — the default `'admin'` applies; no request-body field (the handler spreads its factory
     `options` first, so a customer wrapper could set `historySource` — harmless, not documented).
   - `functions/payment-webhooks.ts` `handlePaymentSucceeded`: pass
     `{ ...notifyOptions, historySource: 'system' }` to the confirmation.
   - `functions/wc-api.ts` shipping mail (only when a shop passes `notify`):
     `{ ...notify, historySource: 'wc-api' }`.
5. Nothing reads history by type: `wc-api.ts` only appends; `InvoicePdf` / `OrderEmail` read
   `statusHistory[0].timestamp` (always the creation entry) — unaffected.

### core-back

1. `src/schemas/objects/orders/orderStatusHistory.ts`: `type` options gain `{ value: 'mail' }`.
   Labels "E-Mail" / "Email" in **both** `fields_{de,en}.ts`
   (`orderStatusHistory.fields.type.options.mail`) and `components_{de,en}.ts`
   (`order.statusHistory.type.options.mail`, read by the view's `tHistoryType`). The
   `customerMessage` field comment ("Message sent to the customer with the status mail
   (OrderActions dialog)") → "… with this mail (`mail` entries, written by core-front; older status
   entries may carry one)". `npm run types`.
2. `OrderView.tsx`: the local `StatusHistoryEntry` becomes a union so the title branch narrows
   (`getStateTranslationKey` takes `OrderStatus | OrderPaymentStatus`, a plain `status: string`
   wouldn't typecheck): common fields (`_key`, `timestamp`, `source?`, `note?`,
   `customerMessage?`) & (`{ type: 'payment' | 'fulfillment'; status: OrderStatus |
   OrderPaymentStatus } | { type: 'mail'; status: MailType }`), `MailType` from `../types/mail`.
   Title: `entry.type === 'mail'` →
   `tHistoryType('mail')` + " - " + ``t(`actions.order.mailTypes.${entry.status}`, entry.status)``
   (keys exist in both `components_{de,en}.ts`: "Bestellbestätigung", "Versendet", …), else the
   current `schemaT.default(getStateTranslationKey(…))` line. Result: "E-Mail - Versendet", source
   line "Studio", customer message below as today.
3. Schema preview (`orderStatusHistory.ts` `prepare`, dev only — the `statusHistory` array is
   `hidden: !ctx.config.isDev`): for `type === 'mail'` the title's status part is
   ``ctx.componentT.default(`actions.order.mailTypes.${status}`, status)`` (`FieldContext` extends
   `ITSContext`, which has `componentT`; `ctx.t` = `schemaT`); the subtitle's `source` through
   ``ctx.componentT.default(`order.statusHistory.source.${source}`, source)``.
4. `OrderActions.tsx` `handleConfirm`: drop `customerMessage` from `historyEntry` (keep `note`).
   The message still goes to `notifyOrder` and ends up on the mail entry. Update the file's header
   comment ("The history entry keeps the internal `note` and, when a mail is sent, the
   `customerMessage`") → the note only; the message lands on core-front's `mail` entry.
5. `OrderMailAction.tsx` header comment says "No document patch, no statusHistory entry" → "no
   document patch; core-front appends a `mail` history entry once the mail is sent".

## Tests

core-front `order-email.test.tsx` (add `appendOrderHistory: vi.fn()` to the `services/sanity`
mock): a successful send appends one `mail` entry (type, status, default source, `historySource`
override, customerMessage); a failing `sendMail` appends none; a failing append doesn't fail the
send; `sendShopOrderNotification` appends none. No caller tests for `historySource`:
`payment-webhooks.test.ts` only covers refund events and `wc-api.test.ts` only `mapOrder`/logging
(no `payment_intent.succeeded` or PUT setup) — building those for a one-word pass-through isn't
worth it; check the sources by hand on staging (below). Live suites (`test-utils/order-notify.ts`, `TEST_LIVE=1`)
now leave a `mail` entry (`source: 'admin'`) on the `TEST_ORDER_ID` order per sent mail —
accepted (it's a fixed test order), say so in the `commerce-and-netlify.md` test-helpers section. core-back: none beyond types; by hand on staging —
status dialog with and without mail and message, "Send mail", a new order's confirmation
("Automatisch"), translated sources on an old order.

## Ship

core-back and core-front minor releases (new history type), core-back first so the Studio knows
`mail` before entries appear. CHANGELOG entries (core-front: `historySource` option, `mail`
history entries; **Upgrading:** take it together with the new core-back minor). Docs: core-front `commerce-and-netlify.md` (email section: mail entries in the
history) ("Customer message" bullet: the message is stored on the `mail` entry) and `wc-api.md` (shipping
mail entry `source: 'wc-api'`, next to the existing `statusHistory` line in the PUT section);
core-back `schemas.md` (no history line yet: add one after the `order.refunds[]` sentence — `order.statusHistory[]` (`orderStatusHistory`: `type` payment / fulfillment / `mail`, `status` = state or mail type, `source`, `note`, `customerMessage`; written by core-front and the order actions, append-only)) and `studio-components.md` (the
`OrderDocumentAction` text says the message goes to `statusHistory[].customerMessage` and that
`OrderMailDocumentAction` "writes no history entry" — both change; order view: translated source,
mail entries). Customers: nothing to change (Tinhof's `wc_api` wrapper passes no `notify`, so no
`wc-api` mail entries there). Delete this file when done.

## Dropped

- **Linking history entries to refunds by `refundId`** (dedup, amount in the history line): the
  refunds card already shows amount, source and status per refund.
