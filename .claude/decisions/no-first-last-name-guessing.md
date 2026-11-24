# Orders store only what the customer entered: no first/last-name guessing

**Status:** Active
**Date:** 2026-10-07

## Context

Orders require only the full `name` (`REQUIRED_ADDRESS_FIELDS`, Sanity `addressStrict`);
`prename`/`lastname` are optional. Express checkout (Apple/Google Pay) delivers just the full name;
it used to be split (last word = last name), producing wrong parts ("Maria von" / "Trapp",
"Dr. Anna") that then appeared e.g. in the thanks heading. The only consumer that needs separate
fields is the `wc-api` WooCommerce export read by Winenet (invoices/accounting), where a one-word
name used to end up with both fields empty.

## Decision

Express checkout stores only `name`. Customer-facing text uses `name`, or `prename` only when the
customer typed it. The split happens solely at export time in `netlify/utils/name.ts`
(`splitNameForExport`): typed parts win; otherwise last word → `last_name`, rest → `first_name`;
a single word → `last_name`.

## Consequences

- Stored order data stays truthful; the guess is confined to the one consumer that needs it.
- Winenet output is unchanged for multi-word names and no longer empty for one-word names.
- Older express orders keep their previously guessed parts (harmless: the printed name is equal).
- If Winenet turns out not to need a first name, `last_name = name` is the cleaner export rule.
