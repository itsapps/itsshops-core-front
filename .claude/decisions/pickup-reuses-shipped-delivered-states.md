# Pickup reuses the `shipped` / `delivered` states

Status: accepted
Date: 2026-11-19

## Context

A pickup order needs "ready for pickup" and "collected". New fulfillment states would ripple
through the Studio state machine, the order list icons, the wc-api status mapping, the ERP and
every mail type.

## Decision

- Reuse the states with pickup labels: `shipped` = "Abholbereit", `delivered` = "Abgeholt"
  (core-back `statusLabelKey` / `mailTypeLabelKey`; core-front `mailKey` picks pickup texts).
- But a pickup `shipped` order still has the goods at the shop. Everything that reads `shipped`
  as "handed over" asks `isHandedOver(status, methodType)` instead (core-front
  `src/shared/pickup.ts`; core-back `orderTransitions.ts`): a pickup `shipped` order can be
  cancelled (→ "Storniert", not "Retourniert"), a full refund auto-cancels it, the withdrawal
  receipt asks for no return, the withdrawal guide says "refund" instead of "wait".
- The wc-api's `PRE_DISPATCH` stays as is: an "Abholbereit" order is already `completed` for the
  ERP, so it left the ERP's queue; a withdrawal there is cancelled in the ERP by hand.
- The pickup deadline (`pickupHoldDays`) is computed from the latest `fulfillment/shipped` history
  entry, not stored — the state is set by the Studio and by the wc-api.

## Consequences

No wc-api / order list / ERP changes; the pickup differences live in a few helpers that take the
method type. Anything new that branches on `shipped` must ask `isHandedOver`.
