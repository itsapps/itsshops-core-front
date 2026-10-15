# wc-api mirrors WooCommerce's amounts exactly, not the "best" rounding

Status: Accepted
Date: 2026-10-13

## Context

The ERP (wineNET) consumes our orders through the WooCommerce-compatible `wc-api`. The first
Tinhof order arrived as €112.02 instead of €100: line-item `price` was the gross unit price, and
wineNET adds VAT to it.

While fixing it, several "better" roundings were compared. A simulation over 200k random orders
showed that no single representation is correct for every way an ERP might compute: exact net
`price` is always right when the ERP recomputes gross from the rate, but off by a cent in ~8 % of
orders when it adds the line `total_tax`; gross − rounded tax is the reverse. Our checkout also
rounds VAT per rate, while line taxes are rounded per line, so line taxes and `total_tax` didn't
reconcile in ~25 % of multi-line orders, and `tax_lines[].tax_total` included shipping tax.

wineNET (and any WC-speaking ERP) was built and tested against real WooCommerce, so the
representation it handles correctly is WooCommerce's own.

## Decision

`mapOrder` reproduces WooCommerce's amounts as found in its source (`class-wc-cart-totals.php`,
`abstract-wc-order.php`, `class-wc-tax.php`, REST orders v2 controller), for prices entered incl.
tax: line net = gross − unrounded tax, `price` = net / quantity unrounded (a number); line tax
rounded per line; `tax_lines[].tax_total` = item line taxes only, shipping tax only in
`shipping_tax_total`; a shipping line lists its rate even at 0.00; `total_tax` = sum of tax lines.
`total` stays the charged amount. Rules and invariants: `.claude/architecture/wc-api.md` →
"Rounding"; tested in `src/netlify/__tests__/wc-api.test.ts`.

Tax rate ids follow WC too (since 3.0.0): a rate is per country, so `tax_lines[].rate_id` is a
fixed id per (tax country, rate) and line `taxes[].id` refer to it. Not per rate alone — AT 20 %
and another country's 20 % are different rates in WC and in an ERP's books (destination-country
VAT); not per order position — an ERP may map the id to its own tax codes, as wineNET does with
`product_id`. Changing the id scheme again needs a heads-up to the ERP.

ERP quirks are reported to the ERP vendor rather than worked around by deviating from WC (e.g.
wineNET deriving the VAT rate from tax ÷ net — sending extra tax decimals would "fix" it but break
parity).

## Consequences

- Behaviour questions are answered by checking WooCommerce's source, not by reasoning about which
  rounding is nicer. Changing the response shape needs a heads-up to wineNET.
- `total_tax` can differ by a cent from the VAT on our invoice/email (per-rate rounding) on orders
  with several items at one rate; the gross `total` always matches. Switching checkout to per-line
  rounding would remove that, but changes invoices for every shop — not done.
- Known WC features still missing: `refunds` array, `dp` param.
