# Payment Permissions-Policy is scoped to the checkout route

**Status:** Active (changed from site-wide → checkout-only on 2026-10-02)
**Date:** 2026-10-02

## Context

Apple Pay and Google Pay ride on the browser **Payment Request API**, governed by the `payment`
directive of the `Permissions-Policy` header. Stripe invokes it from its own iframe, so a shop has to
allow it — only for `self` and Stripe, never `*`. It fails **silently** and only on real devices.

Verified 2026-10-02: Stripe express pay is mounted **only on the checkout page** (`checkout.ts` →
`[data-checkout-express]` in `core/components/checkout.njk`); the cart overlay has no Stripe code. The
policy was previously granted site-wide (`/*`) as a precaution ("an express button might be added to
the cart later"). That argument is weak: whoever added express-pay-to-cart would be actively building
and testing express pay and would hit the CSP block immediately on a device — it wouldn't ship
silently. Express-from-cart also isn't planned (and would be non-trivial here — it's coupled to the
checkout `calculate`/shipping/PaymentIntent flow).

## Decision

Grant `payment=(self "https://js.stripe.com" "https://*.js.stripe.com")` **only on the checkout route
block** in `src/config/headers.ts`; every other route (base `/*`, captcha, custom) and all
no-checkout sites get `payment=()`. Implemented via `securityHeaders(allowPayment: boolean)` — the
checkout route passes `true`, everything else `false`. Netlify `_headers` applies the most specific
matching rule's value for a header, so the checkout page gets the grant and no other page does.

## Consequences

- Least privilege: the Payment Request API is allowed only where it's actually used.
- **If express pay is ever added elsewhere** (e.g. the cart overlay — plausible as a conversion
  optimization but unplanned; the heavy checkout calculate/shipping work is what it would *reuse*,
  via the address/rate callbacks already in `checkout-express.ts`), widen the grant to that route and
  test on a real device. Re-widening is a one-line change in `headers.ts`.
- Keep the Stripe allowlist in sync with the checkout-route Stripe `frame-src` in the same file.
  Never use `*`. See [csp-and-headers.md](../architecture/csp-and-headers.md).
