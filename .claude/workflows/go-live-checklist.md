# Go-live checklist (every shop)

What every shop must have in place before it goes live — and re-check when the item's source
changes. Generic only: each customer `CLAUDE.md` records its **own** state (what's done / open) and
links here. Mechanisms behind the items: `architecture/commerce-and-netlify.md` ("Withdrawal",
"Order confirmation content", "Legal texts"), `architecture/i18n.md` ("Form of address").
Not legal advice — the owner confirms the legal choices (WKO templates / lawyer).

## Netlify (site settings)

- [ ] **Paid plan (Personal or Pro) with auto recharge** — running out of credits pauses the site.
      The per-IP `rateLimit` wrappers (withdrawal's only abuse guard besides the honeypot) work on
      every plan, but Free/Personal allow only 2 rules per site. See `netlify-plans.md`.
- [ ] **`SHOP_FORMALITY`** set for **all scopes** (`formal` default "Sie", `informal` "Du") — before
      the first deploy of a core with the switch; build-only gives a "Du" site with "Sie" mails.
- [ ] `SHOP_TIMEZONE` only if not `Europe/Vienna`.
- [ ] `SANITY_STUDIO_URL` = the deployed Studio, scope incl. **Functions** (the shop's new-order mail
      links the order in the Studio; unset → no button).
- [ ] Function wrappers wired: `order-withdraw` (+ `rateLimit`), `order-withdraw-notify`,
      `order-status`, `payment-webhooks`; no `notifyEmail` / `captcha` options passed.

## Studio — settings

- [ ] **Settings → Company:** name, address, email, phone, **VAT ID** (no placeholder), owner;
      register number + court only if registered. Shown in every mail footer and in the generated
      withdrawal instructions (missing name/address/email → the mail falls back to a short notice).
- [ ] **Settings → Notifications:** sender name/email; `shopNotificationEmail` if the shop inbox
      differs from the sender.
- [ ] **Shop settings → Returns:** return costs (`returnShippingBorneBy` — owner decision), return
      address if different from the company address, **start of the withdrawal period**,
      **exceptions** (§ 18), optional return note.
- [ ] Shipping methods: delivery time (optional) and realistic rates — the "Versand & Zahlung" page
      shows them as they are.

## Studio — pages & menus

- [ ] **Withdrawal policy page** (`shopSettings.withdrawalPolicyPage`) contains the
      `withdrawalPolicyModule`; any old hand-typed policy text removed (page and order mail must not
      say different things).
- [ ] **"Versand & Zahlung" page** with the `shippingInfoModule`, its "Zahlungsarten" field
      (`paymentInfo`, every locale) listing the **payment methods enabled in Stripe live mode**;
      selected as `shopSettings.shippingInfoPage`
      (the checkout links it at the top and above the order button); linked in the footer menu.
- [ ] **Privacy page** (`settings.privacyPage`) contains the `privacyPolicyModule` (old hand-typed
      text removed); an **extra section** for every external service the shop adds itself — each
      host in `headers.extra` (e.g. map tiles) needs one; DPO contact only if one is appointed.
      Env `EMAIL_PROVIDER` / `MAILGUN_USE_EU_REGION_URL` / `WC_CONSUMER_KEY` visible to the
      **build** (the policy reads them). Owner: data processing agreements (AVV) with the processors
      named there that aren't covered by the provider's own terms (e.g. wineNET).
- [ ] `netlify/functions/order_meta_cleanup.mts` wrapper (`schedule: '@daily'`) — the privacy
      policy states that unpaid checkout data is deleted after 30 days.
- [ ] Footer: the withdrawal function link ("Vertrag widerrufen") is present (core appends it if
      missing) and the policy pages are linked.
- [ ] **SEO texts** (every locale): each page has a meta description (an empty one falls back to
      `settings.siteShortDescription` — the same text on every page, and in the default language on
      other locales unless that field is translated); meta titles only where they should differ
      from the page title; `settings.siteTitle` is the brand name (it suffixes every title).
      Fallback chain: `architecture/templates-and-assets.md` → "SEO head".
- [ ] Customer page `modules` array (backend `schema/extensions.ts`) includes
      `withdrawalPolicyModule`, `shippingInfoModule` and `privacyPolicyModule`; the site's CSS lays
      them out like its text modules.

## Owner approval

- [ ] The owner has read and approved the generated withdrawal instructions + model form (for a
      "Du" shop explicitly the **"Du" version** — it differs from the literal model text in forms
      of address only).
- [ ] Return costs, return address, period start and exceptions confirmed by the owner.

## Tests on the live configuration

- [ ] Test orders (card, Apple/Google Pay, EPS; pickup if offered): confirmation shows order date,
      payment method, shipping method, full withdrawal instructions, warranty notice, company footer;
      the shop inbox gets the separate new-order mail (German, Studio button, Reply-To customer).
- [ ] Test withdrawal (matched + one with a made-up order number): receipt with date/time, shop
      notification to the shop inbox; delete the test records in the Studio afterwards.
- [ ] `npm run check:functions` passed for the core version being deployed.
- [ ] **Rich Results Test** (<https://search.google.com/test/rich-results>) on a product page with
      sibling variants and one without: product/merchant listing valid, shipping details and return
      policy recognised. Needs `company.name`, shipping methods with a delivery time in days ("2 – 5
      Werktage") and the return settings (`templates-and-assets.md` → "schema.org").

## Data safety

- [ ] Weekly **production dataset backup** running (own private `sanity-backups` repo) and one
      restore test done (decrypt + unpack): `workflows/sanity-dataset-backups.md`.

## Relaunch & search engines (right after go-live)

- [ ] **Relaunch: old URLs redirected** via `config.redirects` (`configuration.md` → "Redirects";
      `netlify.toml` rules don't work — core's 404 catch-alls match first). Old URL sources: the old
      `sitemap.xml`; Search Console → Performance → Pages (16 months, data predates verification)
      and Indexing → "Not found (404)" (keeps filling as Google re-crawls); Wayback
      `web.archive.org/cdx/search/cdx?url=<domain>/*&collapse=urlkey`; the old host/agency.
- [ ] **Google Search Console** domain property (DNS TXT on the root — host field empty or `@`,
      next to the existing SPF record, never replacing it; keep it after verifying), submit
      `sitemap.xml`. **Bing Webmaster Tools**: "Import from GSC" (also feeds DuckDuckGo, Yahoo,
      Ecosia, Copilot/ChatGPT search).

## Ongoing (after go-live)

- [ ] Payment-methods text re-checked **whenever payment methods change in the Stripe Dashboard**.
- [ ] Unmatched withdrawals: assign to an order or delete **within 30 days** (editor rule).
- [ ] New statutory wording (FAGG Anhang I/II, Directive Annex I) → update core's translations
      verbatim, never per shop.
