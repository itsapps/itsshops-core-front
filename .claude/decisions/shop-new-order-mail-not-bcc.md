# Shop gets its own new-order mail, not a BCC of the customer confirmation

Status: accepted
Date: 2026-10-16

## Context

The payment webhook used to BCC the shop inbox on the customer's order confirmation. Shop admins
found that confusing: the mail greets the customer ("Hallo Anna!"), is in the customer's language,
and carries customer-only legal parts (warranty graphic, withdrawal instructions, company footer).

## Decision

The webhook sends a second mail, `sendShopOrderNotification` / `ShopOrderEmail`, to
`shopNotificationEmail` (fallback sender), in its own try/catch:
- shop's `defaultLocale`, neutral wording, customer contact (email, phone, language) up front;
- order summary reused from `OrderEmail.tsx`; no greeting, warranty image, withdrawal text,
  customer message, invoice or footer;
- **Reply-To = the customer.** From and To are both the shop's address, so a plain reply would go
  back to the shop itself; replying to the customer about an order is the main reason to answer this
  mail. Accepted tradeoff: a careless reply reaches the customer — the admin can change the
  recipient, and the intro text says replies go to the customer.
- Studio button via `SANITY_STUDIO_URL` + Sanity's intent URL (works independent of the desk
  structure).

## Consequences

- Two independent sends: one failing doesn't block the other (neither blocks the webhook).
- Strings the order snapshotted at checkout (shipping method title, delivery time, item subtitles)
  stay in the customer's language — translating them would mean snapshotting every locale; the
  mail shows the customer's language instead.
- `bccSender` remains on `sendOrderNotification` for compatibility; core no longer uses it.
