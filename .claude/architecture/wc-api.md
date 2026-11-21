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
export default createWcApiHandler({ timezone: 'Europe/Vienna' })
```

- **Options:** `timezone` (→ `WC_TIMEZONE` → `Europe/Vienna`; for `date_*` fields and
  `system_status`), `version` (reported WC version, default `9.0.0`), `notify` (if set, a PUT to
  shipped sends the `orderShipping` mail via `sendOrderNotification`; omit it for no mail — **omit
  it for wineNET**, see "wineNET behaviour"). `notify: {}` = on with defaults; the object takes
  `SendOrderNotificationOptions` (`src/netlify/lib/order-notifier.tsx`). `completedMeans`
  (`'shipped'` default | `'accepted'`): what the ERP's `PUT completed` means — see "ERP accepted
  (`completedMeans: 'accepted'`)" below; **`'accepted'` for wineNET**. In `accepted` mode `notify`
  is ignored for `completed`.
- **Env:** `WC_CONSUMER_KEY` + `WC_CONSUMER_SECRET` (Netlify env, functions scope — the values given
  to the ERP), plus the usual `SANITY_PROJECT_ID` / `SANITY_DATASET` / `SANITY_TOKEN` (read+write).
- **Auth:** `consumer_key`/`consumer_secret` as query params (wineNET does this) **or** a Basic auth
  header (split at the **first** `:`, so a secret may contain `:`). Compared in constant time
  (`safeEqual`). Missing env var, wrong credentials or a malformed Basic header → 401
  `woocommerce_rest_cannot_view`.

## Routes

Anything else → 404 `woocommerce_rest_no_route`; thrown errors → 500.

- **`GET system_status`** → `{ environment: { version, default_timezone }, settings: { api_enabled,
  currency } }` — the ERP's connectivity check.
- **`GET orders`** — `page`, `per_page` (≤ 100, default 10), `status` (WC status, comma list;
  unknown ones such as `pending`/`on-hold` are ignored, *only* unknown → empty list), `after` /
  `before` (any ISO 8601 with offset, compared to `_createdAt` in UTC; an unparseable date → 400
  `rest_invalid_param`). Newest first;
  `x-wp-total` / `x-wp-totalpages` headers.
- **`PUT orders/:id`** with `{ status }` → accepted: `processing`, `completed` (→ `shipped`),
  `cancelled` (→ `canceled`), `refunded` (→ `returned`); anything else → 400
  `woocommerce_rest_invalid_status`. Sets the internal `status`, appends an `orderStatusHistory`
  entry (`source: 'wc-api'`), returns the mapped order. **Write guard:** `completed` on a refunded,
  withdrawn (open withdrawal) or cancelled order → **409** `woocommerce_rest_order_not_fulfillable`
  (a poll→ship race; no status change, no shipping mail). In `accepted` mode `completed` and
  `processing` behave differently — see "Status" → "ERP accepted".

## IDs and dates

- WC `id` = the trailing digits of `orderNumber` (`TH-000123` → `123`, `number` stays
  `TH-000123`); PUT finds the order by its 6-digit zero-padded suffix.
- Line-item / `product_id` / `variation_id` are stable hashes of the Sanity ids (originals in
  `meta_data` `_sanity_product_id` / `_sanity_variant_id`). They only change if the document is
  recreated. wineNET learns its article mapping from `product_id`; `sku` is the variant SKU (often
  empty).
- **Tax rates are per country, like WC's:** `rate_id` = stable hash of (tax country, rate) — the
  same in every order, AT 20 % ≠ DE 20 %. Tax country = shipping address country (as in checkout),
  else billing. Until core-front 3.0.0 `rate_id` was the per-order position (1, 2, …).
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

### ERP accepted (`completedMeans: 'accepted'`)

For an ERP whose `completed` means "I took the order over", not "shipped" (wineNET, see below).
The ERP keeps seeing its own status, so its poll never gets the order back (whatever its
de-duplication does); internally the order stays undispatched and the shop ships it in the Studio
(status dialog → `shipped`, tracking code, shipping mail). Why: ADR
`decisions/wc-api-erp-completed-reported-back.md`; plan `.claude/plans/wc-api-erp-completed-accepted.md`.
- **`PUT completed`:** same 409 guard (refunded / open withdrawal / `canceled`); `created` →
  `processing`, every other status stays (`shipped`, `delivered`, … are never moved);
  `setIfMissing({ erpAcceptedAt: now })` on the order. History only on the first accept:
  `{ type: 'erp', status: 'accepted' }` (+ `fulfillment/processing` when it was `created`); a
  repeat PUT appends nothing. **No mail**, even with `notify`. Response reports `completed`.
- **`PUT processing`:** the ERP took it back → `unset(['erpAcceptedAt'])` + status as usual.
  `cancelled` / `refunded`: as in `shipped` mode (`erpAcceptedAt` stays, irrelevant there).
- **Read override** (between 1. and 2. above): `erpAcceptedAt` set and status
  `created`/`processing` → `completed` — before the withdrawal rule, since the list filter keeps
  such an order out of the ERP's `processing` poll anyway; a withdrawal on an accepted order is
  cancelled in the ERP by hand.
- **List filter** follows the reported status (`statusFilter()`, unit-tested): `status=processing`
  leaves out accepted undispatched orders, `status=completed` includes them. `shipped` mode keeps
  the plain `status in $statuses`.
- Studio (core-back ≥ the matching release): read-only `erpAcceptedAt`, the order view shows "In
  der Warenwirtschaft übernommen am …" while undispatched, history "Warenwirtschaft - Übernommen".
- No migration: orders the ERP moved to `shipped` before the switch stay `shipped` (reported
  `completed` either way).

## Order shape

| WC field | Source |
|---|---|
| `total` | `totals.grandTotal` — always the charged amount |
| `total_tax` | sum of all `tax_lines` (items + shipping), see Rounding |
| `discount_total` / `discount_tax` | net / tax part of the discount (line `subtotal` − `total`) |
| `shipping_total` / `shipping_tax` | `fulfillment.shippingCost` − tax / `fulfillment.taxSnapshot.vat` |
| `billing` / `shipping` | addresses (names via `splitNameForExport`, see `commerce-and-netlify.md` → "Customer names") + `contactEmail` |
| `line_items` | `orderItems[]` — see Rounding |
| `tax_lines` | one per rate: `tax_total` = item taxes, `shipping_tax_total` = shipping tax; `id` = 1, 2, … (the line's own id), `rate_id` = stable hash of tax country + rate, `rate_code` = `AT-20` (`TAX-20` without a country) |
| `line_items[].taxes[].id` / `shipping_lines[].taxes[].id` | the `rate_id` (as in WC), not `tax_lines[].id` |
| `shipping_lines` | one line: `method_id` = `methodType` (pickup: `pickup_location`), `method_title`, net total, tax |
| `fee_lines` | always `[]` (packaging is part of the shipping price) |
| `payment_method` / `_title` | stored Stripe type (`card`, `link`, `eps`, …) + German label; `stripe`/`Stripe` on old orders |
| `transaction_id` | `paymentIntentId` |
| `prices_include_tax` | `true` |

Money is a decimal string with 2 places (`"12.34"`, Sanity stores cents) — except line-item
`price`, an unrounded number.

### Pickup orders

Shaped like a WooCommerce block-checkout **Local Pickup** order (checked in WC `trunk`,
2026-11-18): `shipping_lines[0].method_id` = `pickup_location`, line `meta_data`
`pickup_location` (method title), `pickup_address` (one line, `", "`-joined) and
`pickup_details` (instructions) — WC's own keys, `id`s via `stableId`. The order's `shipping`
address is a **copy of billing** (pickup orders store no shipping address; WC does the same), the
tax country (`rate_id`s, `rate_code`) is the pickup location's country. The status mapping is
unchanged: "Abholbereit" (`shipped`) is `completed`; an open withdrawal on it stays `completed`
(it has left the ERP's queue — cancel it there by hand).

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
- **Discounts:** each line's discounted gross = its gross − its **stored** discount
  (`orderItem.discount`, for an expanded bundle item its own `orderItemBundleItem.discount`; unset
  = 0) — the allocation checkout wrote (core-front 6.0.0, discounts model), never recomputed, so
  lines + shipping = `total` by construction (no factor, no remainder). `subtotal*` pre-discount,
  `total*` post-discount. Orders from before 6.0.0 got their line discounts from the migration
  (`itsshops sanity migrate-discounts`), computed with the **old** wc-api algorithm (proportional,
  `Math.round`, remainder on the last line), so their output is byte-identical to what the ERP
  already received (tested against `__tests__/fixtures/wc-api-legacy-orders.json`). An old-shape
  coupon order **not** migrated yet has no line discounts — its lines then don't add up to `total`
  (Rollout: run the migration right after the frontend publish).

Invariants (tested in `src/netlify/__tests__/wc-api.test.ts`):
- `tax_lines[r].tax_total` == sum of `line_items[].total_tax` at rate r
- sum of `tax_lines[].tax_total + shipping_tax_total` == `total_tax`
- `price × quantity` rounds to the line `total`; `price × quantity × (1 + rate)` to the line gross
  — both ±1 cent at an exact half cent (WooCommerce has the same tie)

**Known difference:** checkout rounds VAT once per rate (`totals.vatBreakdown`, shown in the order
email and invoice PDF), WooCommerce per line. On orders with several items at one rate,
`total_tax` can differ from the shop's VAT by a cent; `total` always matches.

## Known gaps vs WooCommerce

- No **`refunds`** array. The order stores its refunds (`order.refunds`, core-front 3.10.0), but the
  wc-api doesn't send them: wineNET most likely doesn't read WooCommerce refunds (Tinhof corrects
  refunds by hand there, owner 2026-11-06). Build it when an ERP reads them — WC's
  `refunds: [{ id, reason, total: "-12.50" }]` on the order.
- The **`dp`** query param (decimal places) is ignored; values are always 2 dp. (WC formats the
  money strings *and* `taxes[].total`/`subtotal` with `dp`, default 2 — so at default `dp` our
  `taxes[]` match WC exactly; only `dp` > 2 would show WC's stored unrounded line taxes.)
- No **`coupon_lines`** (WC lists code + net/tax discount per coupon there). The discount — code
  and automatic discounts alike — is only in the line amounts and `discount_total`/`discount_tax`
  — enough for wineNET (see below).
- **Bundles** are sent as **their items, as ordinary line items** (`expandOrderLines` in
  `wc-api.ts`; decision C): no parent line, no €0 lines, no `bundled_by`/`bundled_items`. Per item:
  `product_id`/`variation_id` = `stableId` of the item's own product/variant (same as bought loose,
  so the ERP's learned mapping applies), `sku`, `name` = `title - subtitle`, `quantity` = bundle qty
  × item qty, gross = stored share × bundle qty (`lineGross`, which all amounts use; its discount = the
  item's own stored `discount`), its own `taxes`; `meta_data` adds `_bundle_title`, `_bundle_sku`,
  `_bundle_variant_id`. Line id = `stableId(orderNumber:lineKey:bundleItemKey)`; ids are unique per
  order (on a hash clash re-hashed with `:1`, `:2`, … — deterministic). Older bundle orders without
  `bundle.items` stay one line.

## wineNET behaviour (observed)

- **Polling:** hourly, `status=pending,processing,on-hold`, `after` ≈ now − 48 h, `before` ≈ now −
  10 min, `per_page=100` (confirmed in the log of 2026-11-17). A new order reaches wineNET within
  1–2 h. Whether it de-duplicates by order id is unknown (asked 2026-10-23, no answer) — so an
  order it marked `completed` must not come back as `processing`.
- **VAT rate per line = tax ÷ net, rounded to 1 decimal**, matched against its rates — it does not
  follow `taxes[].id` → `tax_lines[].rate_id` → `rate_percent` (in WC, `taxes[].id` is the tax
  *rate* id = `tax_lines[].rate_id`; `tax_lines[].id` is the tax line's own item id). With
  cent-rounded tax this misses on tiny lines (1 × €5.00 at 20 %: 0.83 / 4.1667 = 19.9 % → booked at 0 %, gross 4.9958). Per wineNET it reads
  `price` + `quantity` + `subtotal_tax` (or `taxes[0]`). Real WooCommerce sends the same rounded
  values (`subtotal_tax` rounded per line, `taxes[]` formatted to `dp` = 2), so this also hits
  wineNET on real WC shops — a wineNET bug. Reported to wineNET; don't work around it by sending
  more tax decimals (breaks WC parity). **Bundles make it frequent:** their items become lines at
  small price shares, and roughly any line under ~€10 net can miss, depending on the exact cent
  (Tinhof test bundle at €50: 3 of 4 lines miss on staging 000029/000030, 2026-11-21; recomputed
  at €200 the juice share still misses, at €150 none).
- **Status PUT on Auftrag:** turning a Vormerkung into an Auftrag in wineNET immediately sends
  `PUT orders/:id {status: completed}` — automatic, the shop can't choose a status (Tinhof,
  2026-10-23; user agent = the operator's browser). So `completed` means "accepted", not shipped:
  with `notify` set the customer gets the shipping mail before dispatch and without tracking code.
  Handled by `completedMeans: 'accepted'` (above): the order stays `processing` with
  `erpAcceptedAt`, wineNET keeps seeing `completed`, the shop sets "Versendet" in the Studio.
  Without that option: don't pass `notify`, send the shipping mail via Studio "Send mail".
- **Does not send `dp`** (request log, checked 2026-10-14), so supporting `dp` alone changes nothing
  for wineNET.
- **Coupons** (per wineNET, 2026-10-21): it distinguishes *Rabatt-Gutscheine* — a discount on the
  item lines, not listed separately on the wineNET invoice, standard process — from
  *Wert-Gutscheine* (gift vouchers: a negative-quantity item line with a VAT rate, or a means of
  payment without VAT; the latter needs a separate talk with wineNET). Core's coupons (`percent`,
  `fixed`, `freeShipping`) are all Rabatt-Gutscheine; core sells no vouchers and takes none as
  payment. wineNET skips orders whose status is `completed`.
- **Open:** whether its rate derivation works on discounted lines — `price` is after the discount,
  `subtotal_tax` before it, so `subtotal_tax ÷ price` gives no valid rate (13 % line: 14.5 %);
  `total_tax ÷ total` or `subtotal_tax ÷ subtotal` would. Being checked by wineNET on Tinhof
  staging orders.

## Logging and testing

- Every request logs `Request` (debug): method, path, query-param **names**, `dp`, user agent —
  never param values (`consumer_key`/`consumer_secret` may be among them).
- A PUT logs `Update order` (debug): `orderId`, `wcStatus` (raw, as the ERP sent it),
  `internalStatus`; refused/invalid PUTs log warn/error (`Shipping notification failed` if the mail
  throws). The debug lines only appear with `LOG_LEVEL=debug` (default `info`) — the durable record
  is the order's `statusHistory` entry (`source: 'wc-api'`); a shipping mail sent with `notify` adds
  a `mail` entry with the same source. Only `status` is read from the body; other
  body fields are never logged.
- Unit tests: `src/netlify/__tests__/wc-api.test.ts` (`mapOrder` on fixed + randomized orders, paid
  shipping, coupon; the request log).
- Integration: customer repos have `tests/integration/wc-api.test.ts` (Tinhof), hitting a running
  deployment at `WC_API_BASE_URL` (default `http://localhost:8888` = `netlify dev`) with the
  `WC_CONSUMER_*` from `.env`. The PUT test is `it.skip` (it would change real data), so the suite
  only reads and can run against a deployed site. `WC_API_BASE_URL` is test-only.
