# `order.refunds` is rebuilt from Stripe, core-front the only writer

Status: accepted · Date: 2026-11-09 (core-front 3.10.0 / core-back 5.3.0)

## Context
The order stored no refund amounts (only `paymentStatus` and history entries), so the refund mails
fell back to the grand total and a full-refund mail after a partial one stated the whole total.
Refunds are created in three places — `payment-refund` (Studio status dialog, "Refund & close")
and the Stripe dashboard (no core code involved) — and Stripe reports them via `charge.refunded`
and `refund.updated`, often two events in the same second.

## Decision
Stripe is the source of truth. One helper, `syncOrderRefunds(paymentIntentId)`
(`src/netlify/lib/order-refunds.ts`), lists the PaymentIntent's refunds and replaces the whole
`order.refunds` array (`_key` = refund id, `ifRevisionId`); `payment-refund` and both webhooks call
it. The Studio never writes `refunds`. Whether a refund came from the Studio travels in the Stripe
refund's `metadata.itsshopsSource`, so the webhook knows it too. Rejected: upserting single
entries from each caller (merge logic, order-dependent, not idempotent) and storing the amount on
history entries (a copy that a later `refund.updated` would make stale). A failed refund
(`refund.updated`) only updates the list — `paymentStatus` / history are not reverted (no
`refunded → succeeded` transition; the editor refunds again, whose `charge.refunded` heals it).

## Consequences
Idempotent by construction: retries, resent events and simultaneous webhooks produce the same
array. The revision must come from `getDocument`, not a GROQ query — the query index lags behind a
write, and a stale `_rev` made the conflict retry fail again (Tinhof staging, 2026-11-09); an
unchanged list isn't written. Orders refunded before 3.10.0 have no list until their next refund
event (or a one-off sync run); their old refunds then read `source: 'stripe'`, as the metadata is
missing. Mechanism: `architecture/commerce-and-netlify.md` → Refunds.
