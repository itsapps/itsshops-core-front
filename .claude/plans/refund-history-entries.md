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

## Tests

core-front: `payment-webhooks.test.ts` / a sanity-service test — Studio refund with an `admin`
entry carrying its `refundId` → no `stripe` entry; dashboard refund → one entry; the same event
twice → one entry; status still updated in all cases. core-back: none beyond types (dialogs and the
translated history source by hand on staging).

## Ship

core-back first (schema), then core-front. CHANGELOG entries (minor each). Docs: core-front
`commerce-and-netlify.md` → Refunds (history entries linked by `refundId`), core-back
`schemas.md`. Delete this file when done.
