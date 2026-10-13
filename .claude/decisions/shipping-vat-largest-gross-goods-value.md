# Shipping VAT rate = rate with the largest gross goods value

Status: Accepted
Date: 2026-10-13

## Context

Shipping is taxed at a single rate (`dominantItemVatRate`, `src/netlify/lib/tax.ts`). The rule
used to be "the rate contributing the most VAT". That systematically favours the higher rate: in
Tinhof order 000002 the 13 % goods were worth €39.00 and the 20 % goods €37.00, yet shipping got
20 % because 20 % produced more VAT.

Alternatives considered: the largest **net** goods value (the tax base, slightly less biased
towards the higher rate), the largest **gross** goods value (the shop prices), and splitting the
shipping proportionally across rates (needs per-rate shipping tax in totals, order snapshot and
wc-api). Which method Austrian tax law requires was not confirmed with a tax advisor.

## Decision

The shop owner chose the **gross** goods value: shipping takes the rate whose items have the
largest sum of price × quantity incl. VAT. Ties go to the higher rate; 0 % items are ignored; a
coupon can't change the result (it reduces every item by the same factor). The shipping method's
`taxCategoryCode` is not used.

## Consequences

- In close cases gross favours the higher rate a little (gross €39 at 13 % vs €40 at 20 % → 20 %,
  where net would give 13 %) — accepted.
- Applies to new orders only; stored orders keep `fulfillment.taxSnapshot`.
- If a tax advisor requires a proportional split, that is a larger change (totals, order shape,
  wc-api `shipping_tax_total` on several tax lines), not a tweak of this function.
