# Mail history entries are written by core-front after the send

Status: accepted · Date: 2026-11-09 (next core-front / core-back minor, unreleased)

## Context
`order.statusHistory` recorded payment and fulfillment changes but not which mails a customer got.
The Studio status dialog stored the "message to customer" on its own status entry, written
**before** the mail was sent (the order is patched first so the shipped mail shows the tracking
code) — a failed mail left a message in the history that never went out. "Send mail" and the
webhook confirmation left no trace at all.

## Decision
- Every customer order mail gets a `mail` history entry (`status` = `MailType`, `source`,
  `customerMessage`), appended by `sendOrderNotification` (`lib/order-notifier.tsx`) **only after
  `sendMail` succeeded** — the one place every customer mail passes through (owner, 2026-11-09).
  The caller names the source via `historySource` (`admin` default, `system`, `wc-api`).
- The customer message lives on the `mail` entry only; the status dialog's entry keeps just the
  internal note. Old entries keep their message (no migration).
- A failed append is logged and does **not** fail the send: the mail is out, so reporting an error
  would invite a resend.
- Duplicate refund entries (a Studio refund's `admin` entry plus the `charge.refunded` webhook's
  `stripe` entry, one more per resent event) are **not** deduplicated: statuses are right and
  `order.refunds` ([order-refunds-rebuilt-from-stripe.md](order-refunds-rebuilt-from-stripe.md))
  is the authoritative refund record. Linking history entries to refunds by `refundId` was dropped.

## Consequences
- core-back must know the `mail` type before entries appear → release core-back first.
- The shop-inbox mail writes no entry. The withdrawal receipt is a customer mail too: it writes a
  `mail` entry (`withdrawalReceipt`) on the linked order (owner, 2026-11-09, after a staging test
  showed the Studio-created withdrawal's receipt missing from the history); an `unmatched`
  withdrawal has no order, so none.
- Live `orderNotifyTests` leave a `mail` entry on the fixed `TEST_ORDER_ID` order per mail sent.
