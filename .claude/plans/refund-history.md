# Plan — refund history on the order

Status: **planned** (2026-11-06), nothing implemented, no decision open (A, B, C decided 2026-11-06). Generic core behaviour, every shop with
checkout (core-front + core-back). Origin: a partial-refund mail sent from the Studio's "Send mail"
stated the order total — fixed minimally the same day (the mail now needs `refundAmount`, "Send
mail" asks for it; core-front `4223cf8` / core-back `c3e9c97` on `feature/bundle-checkout`). This
plan fixes the cause: the order doesn't know its refunds.

## Current state (verified 2026-11-06)

- A refund is created only through `payment-refund` (`stripe.refunds.create`, `amount` in cents,
  omitted = full) — called from core-back's status dialog (`OrderActions.tsx` → "Status
  aktualisieren") and the withdrawal "Refund & close" (`WithdrawalActions.tsx`). Refunds made in the
  **Stripe dashboard** bypass both.
- The order stores only `paymentStatus` (`refunded` / `partiallyRefunded`) and `statusHistory`
  entries (no amount): the Studio patches them itself (`source: 'admin'`), and the `charge.refunded`
  webhook (`handleChargeRefunded` → `updateOrderPaymentStatus`, `services/sanity.ts`) appends its own
  entry (`source: 'stripe'`), status from `charge.amount_refunded === charge.amount`.
- Refund mails (`orderRefunded`, `orderRefundedPartially`, `SIMPLE_MAIL_TYPES`) print
  `refundAmount` (`templates/email/index.tsx`, `renderMailFor`), else the grand total — the
  full-refund mail after an earlier partial refund states the whole total "in voller Höhe".
  Partial without amount is refused since the minimal fix. Dashboard refunds send no mail.
- wc-api: no `refunds` (`wc-api.md` → Known gaps); Tinhof enters partial refunds in wineNET by
  hand (Tinhof frontend `CLAUDE.md` → wineNET).

## Phase 1 — Store refunds (core-back schema + core-front webhook)

1. core-back: new object `orderRefund` `{ refundId, amount, createdAt, source: 'admin' | 'stripe' |
   'withdrawal', reason?, status }` (cents; read-only outside dev, like `orderItem`), array
   `order.refunds[]`; regenerate `sanity.types.ts`. Studio labels de/en.
2. core-front webhook `charge.refunded`: list the payment intent's refunds
   (`stripe.refunds.list({ payment_intent })` — `charge.refunds` isn't included in the event by
   default in current Stripe API versions; verify against the pinned `stripe` version) and **upsert
   by `refundId`** into `order.refunds` (idempotent: Stripe retries, the Studio and the webhook both
   report the same refund). Keep setting `paymentStatus` from the summed `amount` of succeeded
   refunds vs. `totals.grandTotal` (same result as today's `amount_refunded` check).
3. `payment-refund` returns the refund (already: `refundId`, `amount`); the Studio refund flow writes
   the entry right away (`source: 'admin'`, or `'withdrawal'` from "Refund & close") so the order
   view doesn't wait for the webhook — same upsert key, so the webhook's later write is a no-op.
4. Existing orders: no migration needed for the mails (they keep working with an explicit amount);
   optional one-off backfill from Stripe for orders with `paymentStatus` refunded/partiallyRefunded
   (read-only check first, per dataset).

## Phase 2 — Use them

1. Mails: `renderMailFor` takes the amount from the order when no `refundAmount` is passed — latest
   refund for `orderRefundedPartially`, the sum of all refunds for `orderRefunded`; `refundAmount`
   stays as an explicit override. Then "Send mail" no longer needs the amount field (keep it
   pre-filled from the latest refund, editable) and the 400 guard only applies to orders without
   refunds.
2. Dashboard refunds (`source: 'stripe'`): recorded, **no automatic mail** (decision A) — the
   editor sends it via "Send mail", amount pre-filled from that refund.
3. Studio order view (`OrderView.tsx`): refunds list (date, amount, source) + "refunded / remaining".
(wc-api `refunds` dropped for now — decision B.)

## Tests

Webhook upsert (same refund twice, Studio-then-webhook, several partial refunds, full after
partial → status `refunded`); mail amounts from the order (latest / sum / explicit override);
order view only by hand.

## Decisions (2026-11-06)

- **A — Mail for dashboard refunds:** manual. A refund made in the Stripe dashboard is recorded,
  but sends no mail by itself (refunds there can have other reasons — disputes, tests); "Send mail"
  pre-fills its amount.
- **B — wc-api `refunds`:** not built. wineNET (most likely) doesn't read WooCommerce refunds —
  Tinhof corrects refunds by hand in wineNET (owner, 2026-11-06). Revisit only when an ERP reads
  them; then WC's `refunds: [{ id, reason, total: "-12.50" }]` on the order. `wc-api.md` keeps the
  known gap.
- **C — Credit notes:** out of scope until an owner or tax advisor asks (shops with core invoices
  only; Tinhof's come from wineNET).

## Ship & docs

core-back first (schema), then core-front. Update `commerce-and-netlify.md` → Refunds, core-back `schemas.md` (orders) + `studio-components.md` (order view, "Send mail"),
Tinhof frontend `CLAUDE.md` (wineNET: partial refunds by hand), CHANGELOGs; then delete this file.
