# Go-live checklist (every shop)

What every shop must have in place before it goes live — and re-check when the item's source
changes. Generic only: each customer `CLAUDE.md` records its **own** state (what's done / open) and
links here. Mechanisms behind the items: `architecture/commerce-and-netlify.md` ("Withdrawal",
"Order confirmation content", "Legal texts"), `architecture/i18n.md` ("Form of address").
Not legal advice — the owner confirms the legal choices (WKO templates / lawyer).

## Netlify (site settings)

- [ ] **Paid plan** — the withdrawal function's only abuse guard besides the honeypot is the
      per-IP `rateLimit` in the customer wrapper, which needs a paid plan.
- [ ] **`SHOP_FORMALITY`** set for **all scopes** (`formal` default "Sie", `informal` "Du") — before
      the first deploy of a core with the switch; build-only gives a "Du" site with "Sie" mails.
- [ ] `SHOP_TIMEZONE` only if not `Europe/Vienna`.
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
- [ ] **"Versand & Zahlung" page** with the `shippingInfoModule` + a rich-text block listing the
      **payment methods enabled in Stripe live mode**; selected as `shopSettings.shippingInfoPage`
      (the checkout links it at the top and above the order button); linked in the footer menu.
- [ ] Footer: the withdrawal function link ("Vertrag widerrufen") is present (core appends it if
      missing) and the policy pages are linked.
- [ ] Customer page `modules` array (backend `schema/extensions.ts`) includes
      `withdrawalPolicyModule` and `shippingInfoModule`; the site's CSS lays them out like its text
      modules.

## Owner approval

- [ ] The owner has read and approved the generated withdrawal instructions + model form (for a
      "Du" shop explicitly the **"Du" version** — it differs from the literal model text in forms
      of address only).
- [ ] Return costs, return address, period start and exceptions confirmed by the owner.

## Tests on the live configuration

- [ ] Test orders (card, Apple/Google Pay, EPS; pickup if offered): confirmation shows order date,
      payment method, shipping method, full withdrawal instructions, warranty notice, company footer.
- [ ] Test withdrawal (matched + one with a made-up order number): receipt with date/time, shop
      notification to the shop inbox; delete the test records in the Studio afterwards.
- [ ] `npm run check:functions` passed for the core version being deployed.

## Ongoing (after go-live)

- [ ] Payment-methods text re-checked **whenever payment methods change in the Stripe Dashboard**.
- [ ] Unmatched withdrawals: assign to an order or delete **within 30 days** (editor rule).
- [ ] New statutory wording (FAGG Anhang I/II, Directive Annex I) → update core's translations
      verbatim, never per shop.
