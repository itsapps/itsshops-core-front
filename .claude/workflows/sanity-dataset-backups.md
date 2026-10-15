# Sanity dataset backups (per customer)

Sanity's own redundancy only covers Sanity losing data. Anything *we* cause — a CLI `sanity delete`,
a migration, a bug in a scheduled function (`order_meta_cleanup`), an editor, a leaked write token, a
deleted project — is not restorable without the paid Backups feature (Enterprise). Document history
covers single surviving documents within the plan's retention only. Orders and customers live in
Sanity, so the production dataset is not rebuildable. Hence each live shop gets its own weekly backup.
Why it's shaped this way: `decisions/sanity-backups-github-artifacts.md`.

## Shape

One **private** GitHub repo per customer, next to its frontend/backend:
`web/<customer>/sanity-backups` (reference: `web/tinhof/sanity-backups` — copy it; its `README.md`
has the customer-facing setup + restore steps). The repo holds only `.github/workflows/backup.yml`,
`README.md` and a `.gitignore` (`*.tar.gz`, `*.age`, `*.zip`, `*.key`).

The workflow (weekly cron + `workflow_dispatch`):
1. `npx -y @sanity/cli@<pinned> dataset export production backup.tar.gz --project-id <id>` with
   secret `SANITY_AUTH_TOKEN` (Sanity API token, role **Viewer**). Exports documents + all assets.
2. Encrypts with `age -r "$AGE_RECIPIENT"` (repo **variable**, the public key). The private key
   exists only in the password manager; restore decrypts with `age -d -i <(pbpaste)`.
3. Uploads it as an artifact (`compression-level: 0`, `retention-days: 90` as a fallback only).
4. **Then** deletes every artifact not from this run (`gh api`, needs `permissions: actions: write`)
   — exactly one backup exists, and a failed run never deletes the last good one.

Per customer change only `SANITY_PROJECT_ID` (in the workflow `env`), plus a new key pair, token and
repo secrets.

## Gotchas

- **Standalone CLI needs `--project-id`.** Outside a studio project a `sanity.cli.*` file with only
  `api.projectId` is *not* picked up (`PROJECT_ROOT_NOT_FOUND` in CI). Pin the CLI version
  (tested: `@sanity/cli` 8.17.1).
- **Size vs. quota.** Free accounts get 500 MB artifact storage. Tinhof production ≈ 272 MB (mostly
  images) → only one backup fits; measure a new customer with a local export first. More history →
  object storage (Cloudflare R2), **not Git LFS** (LFS storage never shrinks; see the ADR).
- **Pushing the workflow** needs a token with the **`workflow`** scope (classic) / *Workflows: write*
  (fine-grained). The macOS-keychain PAT (`dev@itsapps.at`) lacked it → "refusing to allow a
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
4. Run the workflow manually, download the artifact (run summary → *Artifacts*), **decrypt and
   unpack it** as the restore test (`data.ndjson`, `images/`, `files/`), delete local copies.
5. Note the backup repo in the customer backend `CLAUDE.md`.

Before risky operations (migrations, bulk `itsshops sanity delete`, production content steps) also
make a manual `sanity dataset export` — the weekly backup may be up to a week old.
