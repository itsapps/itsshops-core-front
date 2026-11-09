# Plan — one status-history entry per refund

Status: **planned** (2026-11-09), nothing implemented. Follows the refund history (order
`refunds`, core-front 3.10.0 / core-back 5.3.0; `commerce-and-netlify.md` → Refunds). Generic core behaviour (core-back + core-front), every shop with checkout.
Cosmetic — no amount or status is wrong today.

## Problem

A refund's payment entry in `order.statusHistory` can appear more than once:

1. **Studio refunds get two entries.** The status dialog (`OrderActions.tsx`) and "Refund & close"
   (`WithdrawalActions.tsx`) append their own `admin` entry after `payment-refund`; a few seconds
   later the `charge.refunded` webhook (`handleChargeRefunded` → `updateOrderPaymentStatus`,
   `services/sanity.ts`) appends a `stripe` entry for the same refund. Seen on Tinhof staging
   order 000016 (three Studio refunds, six refund entries).
2. **Every `charge.refunded` run appends.** A Stripe retry or a manual resend of an event that had
   already gone through adds another `stripe` entry.

Dashboard refunds get one entry (`stripe`) — no dialog.

## Rejected: skip the webhook entry for Studio-marked refunds

`payment-refund` tags refunds `metadata.itsshopsSource = 'studio'`, so the webhook could skip
them. Rejected: the Studio writes its entry in a separate save *after* the refund — if that save
fails, the refund would have no history entry at all (today the `stripe` entry covers it); and it
doesn't stop duplicates from retries/resends (2).

## Approach: link entries to their refund

- **core-back schema:** optional `refundId` string on `orderStatusHistory` (Stripe `re_…`,
  `readOnly: !ctx.config.isDev`), labels de/en, `npm run types`.
- **core-front type:** `refundId?: string` on `OrderStatusHistoryEntry` (`netlify/types/checkout.ts`).
- **Studio writers:** `OrderActions` and `WithdrawalActions` put `result.data.refundId` (already in
  the `payment-refund` response) on their payment `admin` entry. The cancel entry
  (`fulfillment` / `canceled`) gets none.
- **Webhook:** `charge.refunded` keeps setting `paymentStatus` (and the cancel) as today, but
  appends a payment entry only for refunds that have none yet: after `syncOrderRefunds`, take the
  counted refunds whose `refundId` isn't on any `statusHistory` entry and append one `stripe` entry
  per refund (with `refundId`, status as computed today). None missing → no payment entry. The
  cancel entry is added only when the status actually changes to `canceled` (today it's guarded by
  `order.status` already — keep that).
- **Race:** the webhook can run before the Studio's save (the Studio saves after `payment-refund`
  returns, which includes a sync; the webhook usually arrives seconds later). If it does, both
  entries exist — same as today, no worse. Optional: the Studio re-reads and skips its entry when
  one with that `refundId` exists, but then the note/customer message would need patching into it
  — probably not worth it.
- **Old entries** (no `refundId`) stay untouched. **Open decision:** on an order refunded before
  this ships, the next `charge.refunded` would see its old refunds as "without entry" and append
  entries for them too. Options: (a) only append for refunds created after the newest payment
  entry *without* `refundId` (older ones count as covered); (b) only for the newest counted
  refund. (a) also covers two dashboard refunds before one delayed event; pick when implementing.

## Also: translate the history source in the order view

History `source` says **who wrote the entry** (`admin` = Studio dialog, `stripe` = the Stripe
webhook, `wc-api` = an ERP such as wineNET); refund `source` says **where the refund was created**
(`studio` | `stripe` = Stripe dashboard). The order view shows the history value raw
(core-back `OrderView.tsx`, `{entry.source && <Text muted>{entry.source}</Text>}`) but the refund one
translated (`order.refunds.source.*`: "Studio", "Stripe-Dashboard") — and `stripe` reads like the
dashboard in both. Keep the stored values (existing orders have them); translate the history one in
the view: keys `order.statusHistory.source.{admin,stripe,wc-api}` in `components_{de,en}.ts` — de
"Studio", "Stripe", "Warenwirtschaft"; en "Studio", "Stripe", "ERP" — unknown values stay raw
(`t(key, source)`). With one entry per refund (above), "Studio" / "Stripe" in the history then
match the refund list's meaning. core-back only, no data change.

## Also: more information on the entries

- **Refund amount — no new field.** The order view joins a payment entry to its refund by
  `refundId` (above) and shows "Teilweise refundiert · 18,00 € · Studio", plus the refund's status
  when not succeeded ("Fehlgeschlagen"). The amount and status come from `order.refunds` (Stripe's
  truth, kept current by `refund.updated`), not a copy frozen on the entry. Entries without
  `refundId` (before this) show no amount.
- **Every customer mail gets a `mail` entry** (decided 2026-11-09: "Send mail" and the automatic
  confirmation too — the history becomes the full log of mails to the customer). Today the history
  doesn't say whether a mail went out ("notify customer" without a message leaves no trace, "Send
  mail" none at all). Single writer: core-front's **`sendOrderNotification`** (`lib/order-notifier.tsx`)
  appends after `sendMail` succeeded — `{ type: 'mail', status: <mailType>, timestamp, source,
  customerMessage? }` — so a failed mail is never recorded, and all callers are covered (status
  dialog, "Send mail", "Refund & close", webhook confirmation) without Studio changes. Plain
  `append` (no `ifRevisionId`; a concurrent `syncOrderRefunds` write just retries on its 409). A
  failing history write is logged, not thrown (the mail is out — the caller must not report a
  failure and invite a resend). `source`: new notify option (core-back's `notifyOrder` passes
  `'admin'`; the webhook's confirmation passes `'system'`; default `'admin'` for the
  `order-notify` function, which only the Studio calls). The status dialog's own payment/
  fulfillment entry keeps its `customerMessage` as today. Not for the shop's new-order mail or
  withdrawal mails (not customer order mails / own records).
  - core-back: `orderStatusHistory.type` option `mail` (labels "Email" / "Email"); preview and
    order view translate a mail entry's `status` via `actions.order.mailTypes.<type>` (not
    `getStateTranslationKey`); view line e.g. "Email · Versendet · Studio". `MailType` already
    exists in `utils/orderTransitions.ts`.
  - core-front: `OrderStatusHistoryEntry.type` gains `'mail'`; the wc-api status-history read
    (`wc-api.md`) must ignore `mail` entries if it reads history — check when implementing.
- **Optional — tracking code on the shipped entry** (`trackingCode`, as set in that step). Low
  priority: the current code is on the order (`fulfillment.trackingCode`), and with wineNET's
  early `shipped` it is usually entered later without a status change (no entry then).
- Not copied onto entries: totals, addresses, anything the order already holds (copies go stale).

## Tests

core-front: `payment-webhooks.test.ts` / a sanity-service test — Studio refund with an `admin`
entry carrying its `refundId` → no `stripe` entry; dashboard refund → one entry; the same event
twice → one entry; status still updated in all cases. core-front `order-email.test.tsx`: a successful send appends one `mail` entry (type, source,
customerMessage), a failed send appends none, a failing append doesn't fail the send.
core-back: none beyond types (dialogs, the mail entries and the translated history source by hand
on staging).

## Ship

core-back first (schema), then core-front. CHANGELOG entries (minor each). Docs: core-front
`commerce-and-netlify.md` → Refunds (history entries linked by `refundId`), core-back
`schemas.md`. Delete this file when done.
