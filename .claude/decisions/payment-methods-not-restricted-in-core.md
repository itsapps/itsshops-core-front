# Core doesn't restrict Stripe payment methods; delayed methods are unsupported by convention

**Status:** Active
**Date:** 2026-10-07

## Context

`payment-create` uses `automatic_payment_methods` and the Payment Element is created without
`paymentMethodTypes`, so whatever a shop owner enables in the Stripe Dashboard is offered — no
deploy needed. Delayed-notification methods (SEPA Direct Debit; voucher/transfer methods behave
similarly) return `redirect_status=processing`, but the order flow only reacts to
`payment_intent.succeeded`: until the money arrives (days) there is no order in Sanity, no
confirmation email, no stock decrement, and a later failure (`payment_intent.payment_failed`) is
not handled. Stripe would allow excluding them (`excludedPaymentMethodTypes` on Elements +
`excluded_payment_method_types` on the PaymentIntent; both in the installed SDKs).

## Decision

Don't exclude anything in code. Shop owners are told not to enable delayed methods. The thanks page
still handles `processing` correctly (own text, cart cleared, no order-number lookup).

## Consequences

- The Stripe Dashboard stays the single control for payment methods.
- If an owner enables SEPA anyway, orders appear only once paid and failures go unnoticed. Proper
  support would need an "awaiting payment" order on `processing`, stock reservation,
  `payment_failed` handling and core-back order statuses — a separate feature.
