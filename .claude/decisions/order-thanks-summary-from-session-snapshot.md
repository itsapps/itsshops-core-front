# Order-thanks summary comes from a sessionStorage snapshot, not a server fetch

**Status:** Active
**Date:** 2026-10-07

## Context

The order-thanks page should show what was ordered (items, totals, delivery address). The page only
knows Stripe's return params (`payment_intent`, `payment_intent_client_secret`, `redirect_status`);
the order itself is created asynchronously by the payment webhook, usually not yet when the page
loads. Two sources were considered:

1. A **snapshot** the checkout writes to `sessionStorage` right before `stripe.confirmPayment`.
2. A **server fetch** of `orderMeta` (written by `payment-create` before the redirect, so it exists
   immediately; never deleted), authorised by `payment_intent` + client secret verified against
   Stripe, time-limited, POST, minimal fields. The pre-core Jurtschitsch frontend fetched the full
   order by `payment_intent` alone.

## Decision

Snapshot only (`src/scripts/order-snapshot.ts`): personal data stays in the buyer's tab
(`sessionStorage`), minimal fields (no phone, billing address, client secret, `orderMetaId`), read
back only for the matching PaymentIntent within 30 min, deleted on read, rendered via `textContent`.
The server endpoint `order-status` returns **only** the order number.

## Consequences

- The thanks link is not an access key to personal data — with a server fetch, anyone holding the
  URL (history, shared link, bank redirect) could read name/address/items for its validity window.
- No extra Stripe + Sanity call or loading state per visit; the summary renders instantly.
- Customers who return in a different browser/tab (e.g. bank app reopening the return URL in
  another browser), reload, or open the page after 30 min see the status text without the summary;
  the confirmation email carries the details. Accepted.
- Revisit only if that minority matters: a fallback endpoint must keep the safeguards above.
