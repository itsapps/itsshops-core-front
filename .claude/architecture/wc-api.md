# WooCommerce API bridge (`wc-api`, read by wineNET)

`src/netlify/functions/wc-api.ts` exposes Sanity orders as a **WooCommerce REST v3** subset, so an
ERP that speaks WooCommerce works without custom code. Today that is **wineNET** (Tinhof): it polls
orders into a "Vormerkung", marks them shipped, and does invoicing/accounting. Why the amounts copy
WooCommerce exactly: ADR `../decisions/wc-api-mirrors-woocommerce.md`. **Tell wineNET before
changing the response shape.**

## Setup (customer repo)

```ts
// netlify/functions/wc_api.mts
import type { Config } from '@netlify/functions'
import { createWcApiHandler } from '@itsapps/itsshops-core-front/functions/wc-api'

export const config: Config = { path: '/wp-json/wc/v3/*' }
export default createWcApiHandler({ timezone: 'Europe/Vienna', notify: {} })
```

- **Options:** `timezone` (→ `WC_TIMEZONE` → `Europe/Vienna`; for `date_*` fields and
  `system_status`), `version` (reported WC version, default `9.0.0`), `notify` (if set, a PUT to
  shipped sends the `orderShipping` mail via `sendOrderNotification`; omit it for no mail).
- **Env:** `WC_CONSUMER_KEY` + `WC_CONSUMER_SECRET` (Netlify env, functions scope — the values given
  to the ERP), plus the usual `SANITY_PROJECT_ID` / `SANITY_DATASET` / `SANITY_TOKEN` (read+write).
- **Auth:** `consumer_key`/`consumer_secret` as query params (wineNET does this) **or** a Basic auth
  header. Missing env var or wrong credentials → 401 `woocommerce_rest_cannot_view`.

## Routes

Anything else → 404 `woocommerce_rest_no_route`; thrown errors → 500.

- **`GET system_status`** → `{ environment: { version, default_timezone }, settings: { api_enabled,
  currency } }` — the ERP's connectivity check.
- **`GET orders`** — `page`, `per_page` (≤ 100, default 10), `status` (WC status, comma list;
  unknown ones such as `pending`/`on-hold` are ignored, *only* unknown → empty list), `after` /
  `before` (any ISO 8601 with offset, compared to `_createdAt` in UTC). Newest first;
  `x-wp-total` / `x-wp-totalpages` headers.
- **`PUT orders/:id`** with `{ status }` → accepted: `processing`, `completed` (→ `shipped`),
  `cancelled` (→ `canceled`), `refunded` (→ `returned`); anything else → 400
  `woocommerce_rest_invalid_status`. Sets the internal `status`, appends an `orderStatusHistory`
  entry (`source: 'wc-api'`), returns the mapped order. **Write guard:** `completed` on a refunded,
  withdrawn (open withdrawal) or cancelled order → **409** `woocommerce_rest_order_not_fulfillable`
  (a poll→ship race; no status change, no shipping mail).

## IDs and dates

- WC `id` = the trailing digits of `orderNumber` (`TH-000123` → `123`, `number` stays
  `TH-000123`); PUT finds the order by its 6-digit zero-padded suffix.
- Line-item / `product_id` / `variation_id` are stable hashes of the Sanity ids (originals in
  `meta_data` `_sanity_product_id` / `_sanity_variant_id`). They only change if the document is
  recreated. wineNET learns its article mapping from `product_id`; `sku` is the variant SKU (often
  empty).
- `date_created` = `_createdAt` in the configured timezone, `date_created_gmt` = UTC;
  `date_paid(_gmt)` = the same when `paymentStatus` is `succeeded`, else `null`.

## Status

Internal → WC: `created`/`processing` → `processing`, `shipped`/`delivered` → `completed`,
`canceled` → `cancelled`, `returned` → `refunded`. A PUT therefore never sets `delivered`.

**Overrides on read** (only the response; Sanity is unchanged), in this order:
1. Fully refunded (`paymentStatus: refunded`) → `refunded` — a refund sets only `paymentStatus`, so
   a refunded-but-unshipped order would otherwise keep reporting `processing` and get shipped.
2. Open withdrawal (`orderWithdrawal` `received`/`processing`) on a not-yet-shipped order →
   `cancelled`, so the ERP drops it from its ship queue.

Partial refunds are **not** overridden — such orders may still ship.

## Order shape

| WC field | Source |
|---|---|
| `total` | `totals.grandTotal` — always the charged amount |
| `total_tax` | sum of all `tax_lines` (items + shipping), see Rounding |
| `discount_total` / `discount_tax` | net / tax part of the discount (line `subtotal` − `total`) |
| `shipping_total` / `shipping_tax` | `fulfillment.shippingCost` − tax / `fulfillment.taxSnapshot.vat` |
| `billing` / `shipping` | addresses (names via `splitNameForExport`, see `commerce-and-netlify.md` → "Customer names") + `contactEmail` |
| `line_items` | `orderItems[]` — see Rounding |
| `tax_lines` | one per rate: `tax_total` = item taxes, `shipping_tax_total` = shipping tax |
| `shipping_lines` | one line: `method_id` = `methodType`, `method_title`, net total, tax |
| `fee_lines` | always `[]` (packaging is part of the shipping price) |
| `payment_method` / `_title` | stored Stripe type (`card`, `link`, `eps`, …) + German label; `stripe`/`Stripe` on old orders |
| `transaction_id` | `paymentIntentId` |
| `prices_include_tax` | `true` |

Money is a decimal string with 2 places (`"12.34"`, Sanity stores cents) — except line-item
`price`, an unrounded number.

## Rounding (mirrors WooCommerce)

Checked against WooCommerce's source (`class-wc-cart-totals.php`, `abstract-wc-order.php`,
`class-wc-tax.php`, REST orders v2 controller), for prices entered incl. tax:

- **Line net** = gross − *unrounded* tax. `price` = line net / quantity, unrounded (e.g.
  `13.274336…`) — **never the gross price**: wineNET adds VAT to it (gross was sent once → Tinhof
  order 000001 showed 112.02 instead of 100). `subtotal`/`total` = line net rounded to cents.
- **Line tax** (`subtotal_tax`/`total_tax`) is rounded **per line**.
- **`tax_lines[].tax_total`** = the item line taxes of that rate, **without shipping**. Shipping tax
  (rounded on its own) is only in `shipping_tax_total` / `shipping_tax`. A shipping line lists its
  rate in `taxes` even at `0.00` (free shipping); `[]` only without a rate.
- **Coupons:** the gross discount is spread proportionally over the lines (rounding remainder on
  the last line, so lines + shipping = `total`). `subtotal*` pre-discount, `total*` post-discount.

Invariants (tested in `src/netlify/__tests__/wc-api.test.ts`):
- `tax_lines[r].tax_total` == sum of `line_items[].total_tax` at rate r
- sum of `tax_lines[].tax_total + shipping_tax_total` == `total_tax`
- `price × quantity` rounds to the line `total`; `price × quantity × (1 + rate)` to the line gross
  — both ±1 cent at an exact half cent (WooCommerce has the same tie)

**Known difference:** checkout rounds VAT once per rate (`totals.vatBreakdown`, shown in the order
email and invoice PDF), WooCommerce per line. On orders with several items at one rate,
`total_tax` can differ from the shop's VAT by a cent; `total` always matches.

## Known gaps vs WooCommerce

- No **`refunds`** array. A partial refund only sets `paymentStatus: partiallyRefunded` (the amount
  lives in Stripe, not on the order), so the ERP sees no change — enter it there by hand.
- The **`dp`** query param (decimal places) is ignored; values are always 2 dp. (WC formats the
  money strings *and* `taxes[].total`/`subtotal` with `dp`, default 2 — so at default `dp` our
  `taxes[]` match WC exactly; only `dp` > 2 would show WC's stored unrounded line taxes.)
- **`rate_id` is not stable across orders:** tax lines are numbered 1, 2, … in order of first
  appearance (`tax_lines[].id` = `rate_id`, and `taxes[].id` points at it), so 13 % may be id 1 in
  one order and 2 in another. Fine for a per-order lookup; in WC a rate id is global. Making it
  stable (e.g. derived from the rate) changes the response — tell wineNET first.

## wineNET behaviour (observed)

- **Polling:** hourly, `status=pending,processing,on-hold`, `after` ≈ now − 48 h, `before` ≈ now −
  10 min, `per_page=100`. A new order reaches wineNET within 1–2 h.
- **VAT rate per line = tax ÷ net, rounded to 1 decimal**, matched against its rates — it does not
  follow `taxes[].id` → `tax_lines[].rate_id` → `rate_percent` (in WC, `taxes[].id` is the tax
  *rate* id = `tax_lines[].rate_id`; `tax_lines[].id` is the tax line's own item id — ours are
  equal). With cent-rounded tax this misses on tiny lines
  (1 × €5.00 at 20 %: 0.83 / 4.1667 = 19.9 % → booked at 0 %, gross 4.9958). Per wineNET it reads
  `price` + `quantity` + `subtotal_tax` (or `taxes[0]`). Real WooCommerce sends the same rounded
  values (`subtotal_tax` rounded per line, `taxes[]` formatted to `dp` = 2), so this also hits
  wineNET on real WC shops — a wineNET bug. Reported to wineNET; don't work around it by sending
  more tax decimals (breaks WC parity).
- **Does not send `dp`** (request log, checked 2026-10-14), so supporting `dp` alone changes nothing
  for wineNET.

## Logging and testing

- Every request logs `Request` (debug): method, path, query-param **names**, `dp`, user agent —
  never param values (`consumer_key`/`consumer_secret` may be among them).
- Unit tests: `src/netlify/__tests__/wc-api.test.ts` (`mapOrder` on fixed + randomized orders, paid
  shipping, coupon; the request log).
- Integration: customer repos have `tests/integration/wc-api.test.ts` (Tinhof), hitting a running
  deployment at `WC_API_BASE_URL` (default `http://localhost:8888` = `netlify dev`) with the
  `WC_CONSUMER_*` from `.env`. The PUT test is `it.skip` (it would change real data), so the suite
  only reads and can run against a deployed site. `WC_API_BASE_URL` is test-only.
