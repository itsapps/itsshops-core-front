# Plan — free-shipping threshold in the checkout (reason + "noch X € bis Gratis-Versand")

Status: **draft** (2026-11-20), nothing implemented, not refined (run `/itsshops-refine-plan`
before building). **core-front** only (checkout API + client); every shop with checkout and a
`shippingMethod.freeShippingThreshold`. Raised on Tinhof staging while testing the discounts
model (`discounts-model.md`).

## Problem

When the threshold makes shipping free, the checkout shows only "Versand kostenlos" (totals row)
and "kostenlos" in the method list — the customer sees *that*, not *why*. Below the threshold
nothing says how close the cart is. The threshold itself is only on the "Versand & Zahlung" page
(`shippingInfoModule`). Mails show "Versand 0,00 €"; the Studio order view shows the reason.

## Goal

1. **Reason:** "Versand (ab 100,00 € Bestellwert) kostenlos" in the totals row when the threshold
   (not a shipping discount) waived the selected delivery method. A shipping discount keeps its
   own wording ("Versand (<title> · <code>) kostenlos", `ui-contracts.md` → Checkout discounts).
2. **Progress hint (optional, decide):** below the threshold, "Noch 12,00 € bis zum
   Gratis-Versand" near the totals (and maybe in the cart), as a polite live region.

## What exists

- `resolveShippingMethods` (`netlify/lib/shipping.ts`) computes `isFree` per method via
  `isFreeShipping(threshold, subtotal, discount, freeShippingCalculation)` and sets
  `freeReason: 'threshold'`; the method's `freeShippingThreshold` is known there.
- Pass 2 (`afterDiscount`) compares `itemsOrderTotal` (subtotal − items/order discounts) —
  `payment-create.ts` `run()`.
- `CalculateResponse.shippingMethods[]` has `isFree` but neither the reason nor the threshold;
  `renderTotals` (`scripts/order-totals.ts`) gets `totals` + `appliedDiscounts` only.

## Open questions

- Response shape: `freeReason` + `freeShippingThreshold` per method, or one
  `freeShipping: { reason, threshold, missing }` for the selected method?
- Several delivery methods with different thresholds (DPD AT 100, DE 150): the hint follows the
  selected method; what before a country/method is chosen?
- Wording with `beforeDiscount` (Tinhof): €105 − 10 % = €94.50 still ships free, so "ab 100 €
  Bestellwert" can read wrong — "Warenwert" / "vor Rabatt"? With `afterDiscount` the missing amount
  must use the discounted basis.
- Hint also in the cart drawer (no shipping country there yet) or checkout only?
- Thanks page (order snapshot) and mails: show the reason there too, or checkout only?
- Interaction with a shipping discount that already made shipping free (no hint then).

## Accessibility

Hint as text in a polite `aria-live` region (no colour-only progress bar; a bar, if any, is
decorative next to the text). Totals row text via `textContent` as today.

## Tests (sketch)

Reason row on/off (threshold vs. discount vs. none), missing amount for `beforeDiscount` /
`afterDiscount`, method switch updates the hint, pickup (no threshold).
