# Integration tests with side effects are opt-in (`TEST_LIVE=1`)

**Status:** Active
**Date:** 2026-10-29 (core-front 3.6.0)

## Context

The `test-utils` suites customers run from `tests/integration/` call the real handlers against the
services in their `.env`. Every plain `npm test` sent real order mails (confirmation, invoice with
PDF, shipping) for the **newest order** in the dataset, created Stripe test payments and orders
(each mailing the shop inbox and `test@example.com`) and rewrote `lastInvoiceNumber`. Running the
suite for an unrelated change on Tinhof sent ~12 mails to the owner of staging order 000008; on a
dataset with real orders "the newest order" is a customer's. The mail content itself is already
covered by unit tests (`src/netlify/__tests__/order-email.test.tsx`).

## Decision

Keep the tests, but put everything with an effect outside the run in `describeLive` blocks
(`src/test-utils/live.ts`) that only run with `TEST_LIVE=1`. `orderNotifyTests` mails a fixed test
order (`getOrderId`, default `TEST_ORDER_ID`), never the newest one. Webhook tests pass
`shopNotification: false`. Checks without side effects (auth, validation, rejected requests,
calculate) run every time.

Deleting the live tests was rejected: they are the only end-to-end check of the order path
(cart → Stripe → webhook → order), the one that costs money when it breaks.

## Consequences

- A plain `npm test` is safe to run at any time; the full run is a deliberate `TEST_LIVE=1 npm test`
  (e.g. before a release) and mails only the `TEST_ORDER_ID` address.
- Customers get this only once they pin ≥ 3.6.0; an older pin still mails on every run.
- New `test-utils` suites must put any mail / payment / dataset write in `describeLive`.
