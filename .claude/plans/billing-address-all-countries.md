# Parked — checkout billing address with every country

Status: **parked** (2026-11-05). Nobody has asked for it; do it when a shop needs it.

**Today.** The checkout's billing country select gets the same list as shipping — the shop's
tax/shipping countries (`populateCountries` in `src/scripts/checkout.ts`). Express checkout
(Apple/Google Pay) already passes the wallet's billing address, any country. Orders store it as
`addressStrict` (core-back, the shop's country list).

**Why it could change.** VAT for consumer goods follows the delivery country, which core already
uses (`taxCountry` from the shipping address in `payment-create.ts`); the billing address only goes
on the invoice. Real cases: a gift from Switzerland to Vienna, a holiday home, a UK company.

**What it would take.**
- core-front: billing select from all countries (`countryList`-style source), server accepts any
  ISO code for `billing.country` (shipping unchanged).
- core-back: order `billingAddress` uses `ctx.constants.allCountryOptions`; shipping stays on
  `countryOptions` (needs its own field options, both use `addressStrict` today).
- **Ask first:** does wineNET (reads billing addresses via `wc-api`) accept non-European
  countries?
- B2B reverse charge (VAT ID abroad) stays unsupported either way.

Rule behind it: core-back `.claude/architecture/plugin-and-config.md` → "Which country list".
