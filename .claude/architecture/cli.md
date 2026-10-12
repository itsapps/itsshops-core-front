# The `itsshops` CLI

Source: `src/bin/itsshops.ts` (commander) → built to `dist/itsshops.js`, exposed via
`"bin": { "itsshops": … }` in `package.json`.

## Which binary runs

- **In a customer frontend:** npm scripts call it (`dev` = `itsshops eleventy --env=.env --serve --dev`,
  `build` = `itsshops eleventy`, `clean`, `netlify`, `preview`/`maintenance` = `--mode=…`).
- **Anywhere else (e.g. a customer backend):** `npm link` in core-front also installs a global
  symlink (`~/.nvm/versions/node/<v>/bin/itsshops` → core-front `dist/itsshops.js`), so `itsshops` is
  on the PATH in every folder.
- Either way it runs core-front's **built** `dist/` — after changing `src/bin/itsshops.ts`, run
  `npm run build` (or keep `npm run dev` watching).

## Commands

| Command | What it does |
|---|---|
| `eleventy [-e <path>] [--serve] [--watch] [--mode normal\|preview\|maintenance] [--dev] [--debug [ns]]` | Runs Eleventy with `--env-file`. A one-off build (no `--serve`/`--watch`) deletes `dist/` first (Netlify's build cache would otherwise redeploy stale pages). `--mode` sets `IS_PREVIEW`/`MAINTENANCE`, `--dev` sets `ITSSHOPS_DEBUG`, `--debug` sets `DEBUG=Eleventy…` namespaces. |
| `netlify` | `netlify dev` (needs the global netlify CLI); `URL` defaults to `http://localhost:8888`. Env files come from `netlify.toml` (`[dev] envFiles`), not from a CLI flag. |
| `init [--force]` | Writes a default `netlify.toml` (skips existing unless `--force`). |
| `clean` | Removes `dist`, `src/_includes/css`, `src/_includes/scripts`. |
| `sanity [-e <path>] query <groq>` | Runs a GROQ query, prints JSON to stdout. |
| `sanity [-e <path>] count <type1,type2>` | Document count per type. |
| `sanity [-e <path>] delete <type1,type2> [--dry-run] [-y\|--yes]` | Deletes **all** documents of those types (incl. drafts) in **one transaction**, after a typed confirmation. |

## Examples

```bash
# frontend (customer npm scripts call these)
itsshops eleventy --env=.env --serve --dev          # local dev server with debug features
itsshops eleventy --env=.env --serve --mode=preview # preview build locally
itsshops eleventy --debug Benchmark                 # one-off build with Eleventy benchmark output
itsshops eleventy                                   # production build (cleans dist/ first)
itsshops netlify                                    # netlify dev (functions on :8888)
itsshops init                                       # scaffold netlify.toml in a new project
itsshops clean

# sanity data ops (from a customer frontend folder, default .env)
itsshops sanity count order,orderMeta
itsshops sanity query '*[_type == "order"][0...5]{_id, orderNumber, _createdAt}'
itsshops sanity query 'count(*[_type == "product"])'
itsshops sanity query '*[_type == "order"]' 2>/dev/null > orders.json   # JSON only, no status lines

# another env file (e.g. production vars, or from a backend folder)
itsshops sanity -e .env.production count order
itsshops sanity count order -e ../webshop-frontend/.env                 # option after the subcommand works too

# delete: dry-run first, check the printed "Sanity: <project> / <dataset>" line
itsshops sanity -e .env.production delete orderWithdrawal,orderMeta,order --dry-run
itsshops sanity -e .env.production delete orderWithdrawal,orderMeta,order   # prompts: type "production" to confirm
itsshops sanity delete orderWithdrawal,orderMeta,order --yes               # scripts: no prompt (no TTY → required)

# one-off override without editing a file (shell vars win over the env file)
SANITY_DATASET=development itsshops sanity count order
```

## `sanity` commands — env & safety

- Need `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_TOKEN`. A customer **frontend** `.env` has
  them (core-front reads them for content). A customer **backend** `.env` does not — it uses
  `SANITY_STUDIO_*` names — so from a backend folder add the three vars or point `-e` at a file
  that has them.
- `-e, --env <path>` (default `.env`, resolved against the cwd) selects the env file, e.g.
  `itsshops sanity -e .env.production count order`. Accepted before or after the subcommand. A
  missing default `.env` is skipped; a missing custom file exits 1.
- Variables **already set in the shell win** over the file (same as Node `--env-file`).
- Status lines (`✅ Env loaded`, `Sanity: <projectId> / <dataset>`) go to **stderr**, so
  `sanity query … > out.json` stays clean JSON. A `SANITY_*` shell var that differs from the file
  prints `⚠️  SANITY_DATASET from the shell overrides <file>`. Check the dataset before deleting —
  a customer's plain `.env` may point at `production`.
- `delete` guards (`src/bin/itsshops.ts`):
  - prints per-type counts, then asks to **type the dataset name**; anything else (or Ctrl+C/D)
    aborts with nothing deleted. `--yes` skips the prompt; without a TTY (piped/CI) it refuses
    unless `--yes`. `--dry-run` stops after the counts.
  - all deletes go in **one transaction** — all or nothing. A failure (e.g. a remaining reference
    from a type you didn't list: deleting `order` alone while an `orderWithdrawal` points to it)
    deletes nothing. Referrer and referenced doc in the same run are fine in any order.
  - needs a token with write access (a read-only token makes `query`/`count` work, `delete` fail).
  - one transaction holds all IDs; for very large deletes (thousands of docs) it may hit Sanity's
    request-size limit — split by type then.
- There is **no write/patch command.** For bulk content edits use a one-off Node script with
  `@sanity/client` (resolve it from the customer frontend's `node_modules` via `createRequire`, run
  with `node --env-file=.env`): fetch each doc, edit `internationalizedArray*` entries by
  `language` (append new ones with a fresh `_key`), `set` the whole field in one transaction, and
  dry-run + guard the dataset name first.
- The CLI **bypasses studio guards.** E.g. the studio only lets editors delete *unmatched*
  withdrawals (matched ones are the legal proof a declaration was received —
  core-back `src/schemas/documents/orders/orderWithdrawal.ts`); `delete orderWithdrawal` removes all
  of them. Use it for test data; on a live shop's production data only deliberately.
- `*[_type == $type]` with a token also matches drafts (`drafts.…`), so those are deleted too.
