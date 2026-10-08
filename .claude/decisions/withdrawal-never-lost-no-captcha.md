# Withdrawal declarations are always stored and confirmed; no captcha

**Status:** Active
**Date:** 2026-10-08

## Context

FAGG §13a (Directive 2023/2673, in force 2026-10-01) requires an easy-to-use withdrawal function with
a receipt confirmation of what was submitted. The old endpoint rejected submissions whose order
number + email didn't match an order, and required an hCaptcha.

## Decision

- Every valid submission is stored; non-matching ones as `unmatched` (no order), confirmed to the
  submitted email (without the free-text reason) and flagged to the shop. Same response either way.
  Rejected: keep rejecting (a typo would lose a legally valid declaration).
- No captcha (ease of use). Abuse guards instead: Netlify per-IP `rateLimit` in the customer wrapper
  (paid plans), a honeypot field, URL-like name/order number rejected and length caps (both are
  echoed in a mail to any typed address). Rejected: a per-email limit counted via Sanity queries.
- Unmatched records may hold non-customers' data → editor rule: assign or delete within 30 days;
  no auto-delete (a genuine late declaration must never be lost). Matched records stay undeletable.

## Consequences

- Every shop wiring `order-withdraw` needs a paid Netlify plan for the rate limit.
- Editors get an `unmatched` worklist in the Studio (core-back: editable order field with
  suggestions, guarded delete).
