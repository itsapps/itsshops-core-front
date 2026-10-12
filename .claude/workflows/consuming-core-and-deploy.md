# Workflow: consuming core in a customer project & deploying

Canonical for **all** customer projects (frontend consumes `itsshops-core-front`, backend consumes
`itsshops-core-back`). Customer repos link here rather than repeating it.

## How a customer references core

In the customer `package.json`:

```json
"@itsapps/itsshops-core-front": "github:itsapps/itsshops-core-front"
```

No committish is given, so the **exact commit is pinned only in `package-lock.json`**:

```
"resolved": "git+ssh://git@github.com/itsapps/itsshops-core-front.git#<commit>"
```

Core builds itself on install via its `prepare` script, so the customer gets built `dist/`.
The core repos are **public GitHub repos** — there is **no npm registry**. The lockfile currently
resolves them over `git+ssh` (the dev machine's git remote), but since they're public they can
equally be fetched over HTTPS, so no registry auth or deploy key is required to install them.

## Local development

Use **`npm link`**:

```bash
# in the core repo
npm run dev     # core-front: tsup --watch + template watch
npm run watch   # core-back:  pkg-utils watch

# in the customer repo, once
npm link @itsapps/itsshops-core-front   # or -core-back in a backend
```

The link serves core's built `dist/`, so core changes show up only while that watcher runs —
otherwise run `npm run build` in the core repo, then restart the customer dev server (Eleventy /
`sanity dev`). See the core repos' own CLAUDE.md for their dev commands and the
backend's `sanity.cli.ts` dedupe gotcha.

## Updating core — two deliberate modes

Always **commit and push core to GitHub first** — the local `npm link` can hide uncommitted core, so
what you tested locally is not what deploys.

### Dev / test deploys — edit the lockfile hash (the fast path)

This is the intended workflow while developing and deploying to test — it's quicker than anything
npm offers:

1. In the customer `package-lock.json`, change the core `#<commit>` to the latest core commit.
2. **If core's `package.json` changed** (deps added/removed), reinstall so the dependency tree is
   picked up — a bare `#hash` swap only updates the pinned commit, not the rest of the lockfile
   (dependency tree + integrity), so it's sufficient only when core's deps didn't change.

That caveat in step 2 is the one thing to stay aware of; otherwise the hash edit is fine and fast.

**Local `node_modules` gotcha:** after a hash-only edit, `npm install` in a clone that already has
core installed (not `npm link`ed) does **not** refetch it. It records the new commit but keeps the
old files. To actually get the new core locally: `rm -rf node_modules/@itsapps/itsshops-core-*`,
then `npm install` (the lockfile stays unchanged).

### Production — only tagged core

**Rule: `production` never ships an untagged core.** `main`/`staging` may float on lockfile hashes;
before a customer release to `production`, core is cut as a version and pinned by tag in
`package.json` (tags have **no `v` prefix** — `1.5.0`, not `v1.5.0`):

```json
"@itsapps/itsshops-core-front": "github:itsapps/itsshops-core-front#1.5.0"
```

Pin it with npm (rewrites `package.json` + lockfile correctly, including any dep changes):

```bash
npm install 'github:itsapps/itsshops-core-front#1.5.0'
```

Each customer opts in separately — a new core version changes nothing in a customer until it's
pinned there. Because `production` is merged from `main`, the tag pin lands on `main` first; the
next dev cycle may swap back to a hash.

## Release flow (core version → customer release)

Trigger phrase: **"release <customer>"** (optionally which repos, e.g. "release tinhof frontend",
and the core bump if known, e.g. "core-back major"). Claude then runs the steps below, showing the
plan and asking before anything that pushes.

1. **Core — cut a version** (only for a core repo the customer's `main` uses past its last tag).
   Decide the bump from the commits since the last tag (`git log <lastTag>..main`) — semver:
   - **patch** (`2.1.0` → `2.1.1`): fixes only
   - **minor** (`2.1.0` → `2.2.0`): new features / optional config, nothing breaks
   - **major** (`2.1.0` → `3.0.0`): a customer must change something (config shape, schema/data
     migration, override template contract)
   Then, in the core repo (own GitHub user): `npm run build` + `npm run test`; add the version's
   entry to **`CHANGELOG.md`** (Upgrading / Added / Changed / Fixed — "Upgrading" is what a customer
   must change) and commit it, or fold it into the version commit; then
   `npm version <patch|minor|major> -m "<message>"` (`%s` in the message = the version; first line
   `%s`, then the upgrade notes) — bumps `package.json`, commits, creates the annotated tag
   (`.npmrc` `tag-version-prefix=""` keeps tags unprefixed); then `git push --follow-tags origin main`. Until pushed, the version commit/tag can still be amended
   (`git tag -f -a <tag>`); once pushed, treat a tag as final.
2. **Customer — pin the tag(s):** `npm install 'github:itsapps/itsshops-core-<front|back>#<tag>'`
   in the frontend and/or backend; build locally (`npm run build`) to check; commit on `main`, push
   `origin`. This replaces an existing `npm link` — re-run `npm link @itsapps/itsshops-core-…` for
   dev afterwards (the tag pin in `package.json`/lockfile stays).
3. **Customer — release:** bump the customer version without a tag
   (`npm version <minor|patch> --no-git-tag-version`, minor for features, patch for fixes — semver is
   loose for a site; customer repos have no `.npmrc`, tags are unprefixed anyway), commit
   `Release <version>` on `main` + push `origin`; `git checkout production && git merge --ff-only
   main`; annotated tag on that commit (`git tag -a <version> -m "core-front <x>, core-back <y>"`);
   then push `production` + the tag via the **`user`** remote (`git push user production <version>`)
   → Netlify builds. **The production push is the user's:** Claude Code's auto-mode classifier
   blocks it as a production deploy, so Claude prepares everything locally and hands over the
   `! git -C <repo> push user production <version>` lines (unless the user added a permission
   rule). Frontend and backend are tagged separately; when a release needs both (schema +
   rendering), release the backend first and name the paired release in the tag message.
4. Update the customer's `CLAUDE.md` status line if it tracks the live core version.

Netlify's deploy history covers emergency rollbacks; the tags record *what* was live.

## Deploying a customer project (Netlify)

Branch-based:

1. Work on **`main`**; push it to `origin` as your **own** GitHub user (routine — `main` is not a
   Netlify deploy branch, so it triggers no build).
2. To deploy: merge `main` → the **`staging`** or **`production`** branch.
3. Push that branch to the **`user`** remote (the customer account, via its PAT). Netlify — tied to
   that same customer account — sees the matching pusher and rebuilds (`npm run build`, publish
   `dist/`). Deploy done.

Each customer's branch names / Netlify site live in its own CLAUDE.md.

### Deploy identity (two push identities, split by branch)

To avoid paying for extra Netlify team seats, **each customer gets its own GitHub + Netlify account
under the customer's own email** (e.g. `shop@jurtschitsch.com`). Netlify's free auto-rebuild fires
only when the **GitHub pusher's identity matches the Netlify account owner**. So pushes are split by
branch:

- **`main`** (and feature work) → pushed via `origin` as the **developer's own GitHub user** (the dev
  is a collaborator on the customer's repo). `main` is not a Netlify deploy branch → no build.
- **`staging` / `production`** → pushed via the **`user`** remote, authenticated with the **customer
  account's Personal Access Token (PAT)**. The pusher then matches the Netlify account → the build
  triggers.

This is about **push authentication**, *not* commit authorship — a separate thing. (The repo's local
`.git/config` happens to set `user.name`/`user.email` to the customer, e.g. `Admin` /
`shop@jurtschitsch.com`, so commits read as the customer; but Netlify keys on the pusher, not the
author.)

Observed in the Jurtschitsch repos (both remotes point at the **same** GitHub repo):
- `origin` → `https://github.com/Jurtschitsch/…` — pushes as your own user; used for `main`.
- **`user`** → `https://<PAT>@github.com/Jurtschitsch/…` — pushes as the customer; used for
  `staging`/`production`. (Remote names can differ per customer — check with `git remote`, names only.)

**Secrets / gotchas:**
- The PAT lives **only** in the `user` remote URL in `.git/config` (not tracked by git). Never put it
  in a tracked file, commit it, or print it: no `cat .git/config` and no `git remote -v` (it prints
  the PAT URL). Use `git remote` / `git remote get-url origin` instead.
- `.git/config` is per-clone: a fresh clone / new machine loses the `user` remote + PAT, so it must be
  reconfigured there or `staging`/`production` pushes won't trigger a Netlify build.
