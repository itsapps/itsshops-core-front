# Netlify plans — which plan a shop needs

Netlify's credit-based plans (checked 2026-10-16; prices change — re-check
<https://www.netlify.com/pricing/> before advising a customer). Each customer site runs on the
customer's own Netlify account (see `consuming-core-and-deploy.md`), so the customer pays.

## Plans

| Plan | Price / month | Credits / month | Extra credits (auto recharge) |
|---|---|---|---|
| Free | $0 | 300 | none — hard limit |
| Personal | $9 | 1,000 | 500 for $5 |
| Pro | $20 (unlimited members) | 3,000 | 1,500 for $10 |

Bought or recharged credits roll over to later months.

**Credits run out → every site on the account is paused** ("Site not available"). For a live shop
that means lost orders and a dead `wc_api`, so on Personal/Pro **enable auto recharge** (Team Owner
only, applies to all projects of the team). Never run a live shop on Free.

## What costs credits

([How credits work](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/))

| Usage | Credits |
|---|---|
| Production deploy (successful) | 15 — failed deploys, rollbacks, deploy previews and branch deploys (`staging`) are free |
| Bandwidth | 20 per GB |
| Compute (functions, incl. the Studio `preview` function) | 10 per GB-hour |
| Web requests | 2 per 10,000 (edge functions count as requests, not compute) |
| Form submissions | free |

Shop specifics that keep usage low:
- Product/content images come from the Sanity CDN, not Netlify — Netlify bandwidth is only
  HTML/CSS/JS.
- Production deploys happen only on a push to `production` or the Studio deploy dialog
  (core-back `DeployDialog` → Netlify build API); there is no per-publish build hook. **Deploys are
  usually the biggest item** — ~65 deploys alone use up Personal's 1,000 credits.
- Functions are short (checkout, Stripe webhooks, `wc_api` polling by the ERP, daily
  `order_meta_cleanup`).

Rough small-shop month: 20 deploys (300) + a few GB (50–150) + requests/compute (50–100) ≈
400–550 credits → **Personal is enough**; move to Pro if usage regularly exceeds ~800 or the shop
needs more than 2 rate-limit rules.

## Rate limits (`config.rateLimit` in function wrappers)

([Rate limiting](https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/))
"All plans support rate limiting rules in code for serverless functions, edge functions, and
redirects." — but the number of code-based rules is capped **per project (site)**:

| Plan | Code-based rules per site |
|---|---|
| Free / Personal | 2 |
| Pro / Enterprise | 5 |
| Enterprise with High-Performance Edge | 100 (+ UI rules) |

The docs don't say explicitly how rules are counted; assume **one per function `rateLimit`
config**. A shop with the usual two rate-limited wrappers (`order_status`, `order_withdraw`) uses
exactly 2 — the Personal limit. A third rate-limited endpoint needs Pro.

## Other plan differences that matter here

- **Private repos owned by a GitHub organization** → Pro only. Repos under a personal GitHub user
  (e.g. `ErwinTinhof/…`) work on Personal.
- Observability: Personal 1 day; Pro 30-day analytics/metrics.
- Pro is the team plan (unlimited members); Personal is meant for one person — fine, since the
  customer account only deploys via the `user` remote PAT.

## Per shop

| Shop | Plan | Rate-limit rules |
|---|---|---|
| Tinhof | paid (2026-10-08); Personal considered 2026-10-16 | 2 (`order_status`, `order_withdraw`) |
| Jurtschitsch | paid (2026-10-08) | 2 (`order_status`, `order_withdraw`) |
