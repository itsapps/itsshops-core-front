# Commerce & Netlify backend

The dynamic side of the shop — checkout, users, newsletter — runs as **Netlify Functions** in
`src/netlify/`, with typed client counterparts in `src/scripts/` talking to them through
`src/shared/*-api.ts`.

## How customer projects use these functions

Core does **not** auto-register functions in the customer's Netlify site. Instead core builds each
function to its own `dist/<name>.js` (tsup entries in `tsup.config.*`) and exposes it as a **package
subpath export** `@itsapps/itsshops-core-front/functions/<name>`, each exporting a **factory**
`create<Name>Handler(config?)`.

A customer opts a function in by dropping a **thin wrapper** in its own `netlify/functions/<name>.mts`
that sets the Netlify route and re-exports the handler:

```ts
// netlify/functions/newsletter-confirm.mts (customer project)
import type { Config } from '@netlify/functions'
import { createNewsletterConfirmHandler } from '@itsapps/itsshops-core-front/functions/newsletter-confirm'

export const config: Config = { path: '/api/newsletter/confirm' }
export default createNewsletterConfirmHandler()
```

Rules of thumb:
- **One wrapper file per function you want live.** Omit the wrapper → that endpoint doesn't exist on
  that site. (Jurtschitsch's frontend wires newsletter, payment-create/-webhooks/-refund,
  order-notify/-withdraw/-withdraw-notify, preview.)
- **`config.path` must match the route core's client code calls.** The browser scripts
  (`src/scripts/*`) + `src/shared/*-api.ts` call fixed `/api/...` paths; copy the paths from a
  reference customer (`jurtschitsch/webshop-frontend/netlify/functions/`) as the canonical set.
- Some factories take an optional config object (`create...Handler(config)`); most are zero-arg.
- The functions need their server env vars at runtime (Stripe secret, Supabase, Mailgun/Resend,
  Sanity token, `SANITY_STUDIO_NETLIFY_*` etc.) — set them on the Netlify site, not in client config.
- `netlify.toml` controls bundling: the preview function declares `included_files` and excludes the
  bundler/React/Stripe node_modules it doesn't need (see the customer's `netlify.toml`).

### Function catalog (subpath → factory)

| Subpath `@itsapps/itsshops-core-front/functions/…` | Factory | Purpose |
|---|---|---|
| `preview` | (default preview handler) | Sanity visual-editing preview render |
| `payment-create` | `createPaymentHandler` | Create a Stripe payment / checkout intent |
| `payment-webhooks` | `createWebhookHandler` | Stripe webhook receiver (order fulfilment) |
| `payment-refund` | `createRefundHandler` | Refund a payment |
| `order-notify` | `createNotifyHandler` | Send order confirmation email |
| `order-withdraw` | `createOrderWithdrawHandler` | Process a right-of-withdrawal request |
| `order-withdraw-notify` | `createWithdrawNotifyHandler` | Withdrawal notification email |
| `user-register` / `-login` / `-logout` / `-confirm` / `-recover` / `-reset` | `createUser…Handler` | Supabase-backed auth flows |
| `auth-webhooks` | `createAuthWebhookHandler` | Supabase auth webhook receiver |
| `newsletter-subscribe` / `-confirm` / `-unsubscribe` | `createNewsletter…Handler` | Double-opt-in newsletter |
| `wc-api` | `createWcApiHandler` | WooCommerce API bridge |
| `supabase-keep-alive` | `createKeepAliveHandler` | Scheduled ping to keep Supabase warm |

The full built set is the tsup `entry` map; the exposed set is the `exports` map in `package.json`.

### Adding a new function — what to update

All four are required (verified against the current wiring); miss one and customers can't consume it:
1. `src/netlify/functions/<name>.ts` exporting a factory `create<Name>Handler(config?)`.
2. A tsup **`entry`** line in `tsup.config.ts`: `'<name>': 'src/netlify/functions/<name>.ts'`
   (builds `dist/<name>.js`).
3. A **`package.json` `exports`** subpath:
   `"./functions/<name>": { "types": "./dist/<name>.d.ts", "import": "./dist/<name>.js" }`.
   Unlike CSS, functions *are* consumed through `exports` (normal JS module resolution), so this is
   mandatory.
4. Shared request/response types in `src/shared/` if the browser side calls it.
Then each customer adds a thin `netlify/functions/<name>.mts` wrapper (set `config.path`,
`export default create<Name>Handler()`).

> Note: the JS `exports` subpaths are the public API and are in active use across the ecosystem —
> `.` (~30 files), `./core`, `./scripts`, `./test-utils`, and the `./functions/*` set (all wired by
> customers except `auth-webhooks`, which is exposed but currently unused). Keep them, `auth-webhooks`
> included — it's a valid endpoint a customer may wire. Only the **CSS** export subpaths were unused
> (removed 2026-10-02); CSS ships via `dist/` + the `onSuccess` copy instead.

## Functions (`src/netlify/functions/`)

HTTP entry points, one file per endpoint:

- **payments**: `payment-create.ts`, `payment-refund.ts`, `payment-webhooks.ts`
- **orders**: `order-notify.ts`, `order-withdraw.ts`, `order-withdraw-notify.ts`
- **users/auth**: `user-register.ts`, `user-login.ts`, `user-logout.ts`, `user-confirm.ts`,
  `user-recover.ts`, `user-reset.ts`, `auth-webhooks.ts`
- **newsletter**: `newsletter-subscribe.ts`, `newsletter-confirm.ts`, `newsletter-unsubscribe.ts`
- **misc**: `preview.ts` (Sanity preview, built to `dist/preview.js`), `wc-api.ts`,
  `supabase-keep-alive.ts`

## Business logic (`src/netlify/lib/`) — unit-tested

Pure-ish logic, covered by `src/netlify/__tests__/` (vitest — `npm run test`):

- `cart-validator.ts` — re-validates the client cart server-side (never trust client prices)
- `totals.ts`, `tax.ts`, `shipping.ts`, `coupon.ts` — money math
- `order-builder.ts`, `order-item-display.ts` — order construction
- `*-notifier.tsx` — React-email templates (auth, order, newsletter, withdraw)
- `email-settings.ts`, `auth-urls.ts`, `newsletter-urls.ts`

When touching pricing/tax/shipping/coupon math, **update or add a test in `__tests__/`** — this is
the one part of core-front with real coverage, keep it that way.

## Services (`src/netlify/services/`)

External integrations: `stripe.ts`, `supabase.ts` (users), `sanity.ts`, `email.ts` dispatching to
`mailgun.ts` / `resend.ts`. Config/keys come from env (see plugin-and-config doc) — Stripe publishable
key is the only one surfaced client-side.

## Utils & types (`src/netlify/utils/`, `src/netlify/types/`)

`utils/`: `response.ts`, `retry.ts`, `server-auth.ts`, `captcha.ts`, `i18n.ts`, `logger.ts`,
`validation.ts`, helpers. `types/`: `api.ts`, `checkout.ts`, `config.ts`, `errors.ts`,
`orderTransitions.ts` (order state machine).

## Client ↔ server contract (`src/shared/`)

`src/shared/{checkout,newsletter,order,user}-api.ts` + `validation.ts` are imported by **both** the
browser scripts and the functions, so request/response shapes and validation rules stay in sync. When
changing an endpoint's payload, change it in `src/shared/` and both sides follow.

## Gating

Checkout, users, and newsletter are feature-flagged (`shop.checkout`, `users`, `newsletter`). CSP /
Permissions-Policy for payment is tied to checkout being enabled (`setupHeaders`). A customer with
checkout disabled ships none of the payment surface.
