# WooCommerce REST API Compatibility

Exposes Sanity orders through a WooCommerce v3-compatible API so third-party tools (e.g. wineNET) can consume them without code changes.

---

## Setup

### 1. Netlify Function

Create a thin wrapper in your customer project:

```ts
// netlify/functions/wc_api.mts
import type { Config } from "@netlify/functions";
import { createWcApiHandler } from '@itsapps/itsshops-core-front/functions/wc-api';

export const config: Config = {
  path: "/wp-json/wc/v3/*"
};

export default createWcApiHandler({
  timezone: 'Europe/Vienna',
});
```

### 2. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `WC_CONSUMER_KEY` | Yes | API key shared with third party (e.g. `ck_abc123`) |
| `WC_CONSUMER_SECRET` | Yes | API secret shared with third party (e.g. `cs_xyz789`) |
| `SANITY_PROJECT_ID` | Yes | Already set from checkout |
| `SANITY_DATASET` | Yes | Already set from checkout |
| `SANITY_TOKEN` | Yes | Already set from checkout (needs read+write) |

### 3. Config Options

```ts
createWcApiHandler({
  timezone: 'Europe/Vienna',  // IANA timezone for date_created fields (default: Europe/Vienna)
  version: '9.0.0',           // Reported WC plugin version in system_status (default: 9.0.0)
})
```

---

## Endpoints

### `GET /wp-json/wc/v3/system_status`

Returns basic system info. wineNET uses this as a connectivity check.

**Response:**
```json
{
  "environment": {
    "version": "9.0.0",
    "default_timezone": "Europe/Vienna"
  },
  "settings": {
    "api_enabled": true,
    "currency": "EUR"
  }
}
```

### `GET /wp-json/wc/v3/orders`

Lists orders with pagination and filtering.

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `per_page` | int | 10 | Results per page (max 100) |
| `status` | string | | Filter by WC status (`processing`, `completed`, `cancelled`, `refunded`) |
| `after` | ISO date | | Only orders created after this date |
| `before` | ISO date | | Only orders created before this date |

Date format for `after`/`before`: ISO 8601 with offset, e.g. `2026-04-10T10:15:30+01:00`. Internally converted to UTC for comparison against Sanity `_createdAt`.

**Response headers:**
- `x-wp-total` — total number of matching orders
- `x-wp-totalpages` — total number of pages

**Response body:** Array of order objects (see [Order Shape](#order-shape) below).

### `PUT /wp-json/wc/v3/orders/:id`

Updates an order's status.

**Request body:**
```json
{ "status": "completed" }
```

Accepted WC statuses and their internal mapping:

| WC Status | Internal Status |
|-----------|----------------|
| `processing` | `processing` |
| `completed` | `shipped` |
| `cancelled` | `canceled` |
| `refunded` | `returned` |
| `on-hold` | `processing` |

A `statusHistory` entry with `source: "wc-api"` is appended automatically.

**Response:** The updated order object.

---

## Authentication

Both methods are supported:

**Query parameters** (preferred by wineNET):
```
GET /wp-json/wc/v3/orders?consumer_key=ck_xxx&consumer_secret=cs_xxx
```

**Basic auth header:**
```
Authorization: Basic base64(consumer_key:consumer_secret)
```

---

## Order IDs

WooCommerce requires integer IDs. The numeric suffix of the `orderNumber` field is used:

| `orderNumber` | WC `id` | WC `number` |
|---------------|---------|-------------|
| `TH-000001` | `1` | `TH-000001` |
| `TH-000123` | `123` | `TH-000123` |

For `PUT /orders/:id`, the ID is padded back to 6 digits and matched against `orderNumber` via GROQ.

---

## Dates and Timezones

Sanity stores `_createdAt` in UTC (e.g. `2026-04-10T09:58:17Z`).

The WC API returns two fields:
- `date_created` — converted to the configured timezone (e.g. `2026-04-10T11:58:17` for Vienna UTC+2 in summer)
- `date_created_gmt` — UTC (e.g. `2026-04-10T09:58:17`)

The `default_timezone` in `system_status` tells consumers which timezone `date_created` values are in.

Incoming `after`/`before` filter values support any ISO 8601 format with offset (e.g. `2026-04-10T10:15:30+01:00`) and are converted to UTC for Sanity queries.

---

## Order Shape

Each order maps Sanity fields to the WC format:

| WC Field | Source |
|----------|--------|
| `id` | Numeric suffix of `orderNumber` |
| `number` | `orderNumber` |
| `status` | `status` mapped to WC status |
| `currency` | `totals.currency` |
| `total` | `totals.grandTotal` (as decimal string) |
| `total_tax` | Sum of line taxes + shipping tax (WooCommerce rounding, see below) |
| `subtotal` | `totals.subtotal` |
| `discount_total` / `discount_tax` | Net / tax part of `totals.discount` (line `subtotal` − `total`) |
| `shipping_total` | `fulfillment.shippingCost` minus shipping tax |
| `shipping_tax` | `fulfillment.taxSnapshot.vat` |
| `billing` | `customer.billingAddress` + `customer.contactEmail` |
| `shipping` | `customer.shippingAddress` |
| `line_items` | `orderItems[]`: net `price` per unit, `subtotal`/`total` net, per-line tax, sku, quantity |
| `tax_lines` | One per rate: `tax_total` = item line taxes, `shipping_tax_total` = shipping tax |
| `shipping_lines` | `fulfillment` method + cost |
| `fee_lines` | always `[]` (packaging is part of the shipping price) |
| `payment_method` / `_title` | `payment.type` + readable label (`"stripe"` for old orders) |
| `transaction_id` | `paymentIntentId` |

All price values are decimal strings (e.g. `"12.34"`), matching WC convention — except line-item `price`, which (as in WC) is the **net** unit price after discount as an unrounded number (e.g. `13.275`). Prices in Sanity are stored in cents as integers.

---

## Status Mapping

| Internal (Sanity) | WC API |
|--------------------|--------|
| `created` | `processing` |
| `processing` | `processing` |
| `shipped` | `completed` |
| `delivered` | `completed` |
| `canceled` | `cancelled` |
| `returned` | `refunded` |


## Rounding (mirrors WooCommerce)

The ERP (wineNET) was built against real WooCommerce, so amounts follow WooCommerce's own logic
for prices entered incl. tax (checked against WC source: `class-wc-cart-totals.php`,
`abstract-wc-order.php`, REST orders controller):

- **Line net** = gross − *unrounded* tax. `price` = line net / quantity, an unrounded **number**
  (e.g. `13.274336…`), never the gross price — wineNET adds VAT to it. `total`/`subtotal` are the
  line net rounded to cents.
- **Line tax** (`total_tax`/`subtotal_tax`) is rounded **per line**.
- **`tax_lines[].tax_total`** = sum of the item line taxes of that rate — **without shipping**.
  Shipping tax (rounded on its own) is only in `shipping_tax_total` / `shipping_tax`.
- **Order `total_tax`** = sum of all tax lines incl. shipping. **`total`** is always
  `totals.grandTotal` (the amount charged).
- **Coupons:** the gross discount is spread proportionally over the lines (rounding remainder on
  the last line). `subtotal`/`subtotal_tax` are pre-discount, `total`/`total_tax` post-discount;
  `discount_total`/`discount_tax` are the differences.

Invariants (tested in `src/netlify/__tests__/wc-api.test.ts`):
- `tax_lines[r].tax_total` == sum of `line_items[].total_tax` with rate r
- sum of `tax_lines[].tax_total + shipping_tax_total` == `total_tax`
- `price × quantity` rounds to the line `total`; `price × quantity × (1 + rate)` rounds to the line
  gross — both up to 1 cent at an exact half-cent (WooCommerce has the same tie)

**Known difference:** the checkout rounds VAT once per rate (`totals.vatBreakdown`, shown in the
order email and invoice PDF), WooCommerce per line. On orders with several items at the same rate,
`total_tax` here can differ from the shop's VAT by a cent; the gross `total` always matches.
