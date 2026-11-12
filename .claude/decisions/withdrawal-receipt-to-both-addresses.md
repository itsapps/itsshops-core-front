# Withdrawal receipt to the order's and the submitted address when they differ

Status: accepted
Date: 2026-11-12

## Context

A web withdrawal is matched to an order only when order number **and** email match; otherwise it is
stored `unmatched` and its submitter gets a short "we'll check" receipt at the typed address. An
editor then assigns it to the order and sends the full receipt (return instructions or "not
dispatched → refund"). Until now that receipt went **only to the order's** email.

Two concerns pull apart: FAGG §13a / CRD Art. 11(3) want the acknowledgement to reach the consumer
who withdrew — who chose the typed address, often because they don't use the order mailbox; but
that address isn't verified by the order (the submitter could be someone else who knows the order
number), and the buyer should learn about a withdrawal of their order.

## Decision

Matched record whose submitted email differs (case-insensitive) from the order's → the same receipt
goes to **both**, as two separate mails (neither address sees the other). Same address or unmatched
→ one mail as before. Owner's decision, 2026-11-12 (Tinhof staging test showed the resend going only
to the order's address).

## Consequences

- The declarant gets the return instructions; the buyer is warned at the verified address.
- An unverified address receives what the receipt shows (order number, the declarant's own reason,
  shipped or not, the shop's return address) — only after an editor assigned the record.
- Each of the two mails greets its own recipient (order's address → the order's customer name,
  submitted address → the submitted name); the details always repeat the declaration as submitted,
  so the buyer sees the declarant's name — the signal that someone else may have withdrawn.
- One `withdrawalReceipt` history entry per send; if the second mail fails, the call throws naming
  both addresses (the Studio shows it, a resend sends both again).
- The Studio dialogs ("Bestellung zuordnen", "Bestätigung erneut senden") and toasts name both
  addresses.
