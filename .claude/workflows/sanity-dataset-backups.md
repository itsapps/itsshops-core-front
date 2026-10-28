# Sanity dataset backups (per customer)

Sanity's own redundancy only covers Sanity losing data. Anything *we* cause — a CLI `sanity delete`,
a migration, a bug in a scheduled function (`order_meta_cleanup`), an editor, a leaked write token, a
deleted project — is not restorable without the paid Backups feature (Enterprise). Document history
covers single surviving documents within the plan's retention only. Orders and customers live in
Sanity, so the production dataset is not rebuildable. Hence each live shop gets its own daily backup.
Why it's shaped this way: `decisions/sanity-backups-github-artifacts.md`.

## Shape

One **private** GitHub repo per customer, next to its frontend/backend:
`web/<customer>/sanity-backups` (reference: `web/tinhof/sanity-backups` — copy it; its `README.md`
has the customer-facing setup + restore steps). The repo holds only `.github/workflows/backup.yml`,
`package.json` + `package-lock.json` (pin `@sanity/cli` and its whole tree), `README.md` and a
`.gitignore` (`*.tar.gz`, `*.age`, `*.zip`, `*.key`, `node_modules/`).

The workflow (daily cron `0 3 * * *` + `workflow_dispatch` with a `docs`/`full` choice):
1. Mode: Mondays (UTC) **full**, other days **docs**.
   `npm ci`, then `npx --no-install sanity dataset export production backup.tar.gz --project-id <id>` with
   secret `SANITY_AUTH_TOKEN` (Sanity API token, role **Viewer**); `docs` adds **`--raw`**
   (documents incl. image references and `sanity.imageAsset` docs, no binaries — Tinhof ≈ 0.3 MB),
   `full` exports documents + all assets.
2. Encrypts with `age -r "$AGE_RECIPIENT"` (repo **variable**, the public key). The private key
   exists only in the password manager; restore decrypts with `age -d -i <(pbpaste)`.
3. Uploads it as artifact `<docs|full>-production-<YYYY-MM-DD>` (`compression-level: 0`;
   `retention-days` 30 docs / 90 full as a fallback only — if runs keep failing, backups expire).
4. **Then** prunes (`gh api`, needs `permissions: actions: write`), only the kind just uploaded:
   `full` deletes every other non-`docs-` artifact (older full + legacy `production-<run_id>`),
   `docs` keeps the newest 7 (`KEEP_DOCS`). A failed run never deletes anything.
Actions: `actions/checkout@v7`, `actions/setup-node@v7`, `actions/upload-artifact@v7` (Node 24; v4
warns about Node 20).

Per customer change only `SANITY_PROJECT_ID` (in the workflow `env`), plus a new key pair, token and
repo secrets.

## Gotchas

- **Standalone CLI needs `--project-id`.** Outside a studio project a `sanity.cli.*` file with only
  `api.projectId` is *not* picked up (`PROJECT_ROOT_NOT_FOUND` in CI).
- **Pin the CLI with a lockfile, not `npx @sanity/cli@<version>`.** npx pins only the CLI; its
  caret dependencies float. On 2026-10-27 `@sanity/cli-core` 3.14.0 made `@sanity/cli` 8.17.1 ignore
  `--project-id` (`PROJECT_ROOT_NOT_FOUND` … `NON_INTERACTIVE`) with no change on our side. Tested
  working: 8.25.0 from the lockfile (Tinhof CI docs run, 2026-10-28). To upgrade: bump
  `package.json`, `npm install`, commit both.
- **`--no-assets` is not a documents backup.** It *removes every image field* from the documents
  (and the `sanity.imageAsset` docs); importing it over a full backup with `--replace` wipes all
  images. Use `--raw`, which keeps the references.
- **Size vs. quota.** Free accounts get 500 MB artifact storage (account-wide, shared with Packages).
  Tinhof production ≈ 272 MB full (mostly images) → only one full backup fits; on Mondays old + new
  briefly coexist (~544 MB) — works because usage is only recalculated every few hours, but a full
  backup ≥ 500 MB fails outright; measure a new customer with a local export first. More history →
  object storage (Cloudflare R2), **not Git LFS** (LFS storage never shrinks; see the ADR).
- **Pushing the workflow** needs a token with the **`workflow`** scope (classic) / *Workflows: write*
  (fine-grained). The developer's macOS-keychain PAT lacked it → "refusing to allow a
  Personal Access Token to create or update workflow". Repo admin role doesn't help; the token's
  scopes cap it.
- Scheduled workflows are only auto-disabled after 60 inactive days in **public** repos — private
  backup repos need no keep-alive.
- The export contains personal data (orders, customers): keep the repo private, never commit
  archives, delete decrypted files after a restore test.

## Setting up a customer

1. Measure: `npx sanity dataset export production /tmp/x.tar.gz` in the backend, check the size.
2. Copy the reference repo, set `SANITY_PROJECT_ID`, push (token with `workflow` scope).
3. `age-keygen` (no `-o`) → all three lines into the password manager; public key → repo variable
   `AGE_RECIPIENT`. Viewer token → repo secret `SANITY_AUTH_TOKEN`.
4. Run the workflow manually once as `full` and once as `docs`, download the artifacts (run summary
   → *Artifacts*), **decrypt and unpack them** as the restore test (`data.ndjson`, `images/`,
   `files/`; docs products must still have their `image` fields), delete local copies.
5. Note the backup repo in the customer backend `CLAUDE.md`.

Before risky operations (migrations, bulk `itsshops sanity delete`, production content steps) also
make a manual `sanity dataset export` — the daily backup may be up to a day old (images up to a
week).

## Restoring a lost dataset

1. Partial damage → try Studio document history first.
2. Download the newest `full-…` and the newest `docs-…`; per zip, into its own folder (both contain
   `backup.tar.gz.age`): `unzip $B.zip -d $B` → `age -d -i <(pbpaste) -o $B/backup.tar.gz
   $B/backup.tar.gz.age` → optionally `tar -xzf $B/backup.tar.gz -C $B` to inspect (`import` takes
   the `.tar.gz`). Exact commands: the reference repo's `README.md` → Restore.
3. If deleted: `npx sanity dataset create production` (same name and visibility; tokens, CORS and
   webhooks are project-level and survive). Ideally switch the site to `buildMode: maintenance`.
4. `sanity dataset import full.tar.gz --dataset production`, **then** `sanity dataset import
   docs.tar.gz --dataset production --replace --allow-assets-in-different-dataset` (order matters:
   image IDs are content hashes, so the docs references match the full backup's files; images
   uploaded after the full backup must be re-uploaded). The docs (`--raw`) archive keeps the
   `sanity.imageAsset` docs, whose paths name the source dataset — without the flag the import fails
   with "references a different dataset than the specified target" (always into another dataset,
   possibly also into a recreated one). Tested 2026-10-16: Tinhof production full + docs →
   `development`, images and newer content OK. The same two steps copy production into
   `development`.
5. Reconcile what happened after the backup: orders (Stripe, order emails, wineNET/ERP),
   **`shopSettings.lastInvoiceNumber`** (order/invoice number counter — set to the highest number
   already issued *before* taking orders, or numbers repeat), coupon `redemptionCount`, order
   statuses changed by the ERP.
6. Trigger a production deploy.
