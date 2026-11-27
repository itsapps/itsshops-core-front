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
The package also ships core's docs (`CLAUDE.md`, `.claude/{architecture,decisions,workflows}`), so a
customer's `CLAUDE.md` imports them with `@node_modules/@itsapps/itsshops-core-front/CLAUDE.md`
(or `-core-back`) — that works installed and `npm link`ed, for any developer, and shows the docs of
exactly the pinned version.
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
2. **If core's `package.json` changed** (deps added/removed — **devDependencies too**: core's
   `prepare` runs `npm run build` on a git install, so its build tools are installed), reinstall so the dependency tree is
   picked up — a bare `#hash` swap only updates the pinned commit, not the rest of the lockfile
   (dependency tree + integrity), so it's sufficient only when core's deps didn't change.

That caveat in step 2 is the one thing to stay aware of; otherwise the hash edit is fine and fast.
`npm ci --dry-run` does **not** fetch git dependencies, so it passes a mistyped or unpushed hash —
check the pinned commit exists on core's GitHub branch (`git -C <core> rev-parse origin/<branch>`)
before pushing the customer.

**Pinning a commit that isn't on core's `main` yet** (a pushed feature branch) when its deps
changed: a reinstall without a committish pins `main`'s HEAD, not the branch. Instead edit the
hash and fix the tree by hand — e.g. a dependency core *removed*: drop it from core's entry
`dependencies` and drop its `node_modules/<dep>` package entry if nothing else depends on it — then
check with `npm ci --dry-run --ignore-scripts` (what Netlify runs). An *added* dependency needs a
real install; merge core to `main` first.

**Local `node_modules` gotcha:** after a hash-only edit, `npm install` in a clone that already has
core installed (not `npm link`ed) does **not** refetch it. It records the new commit but keeps the
old files. To actually get the new core locally: `rm -rf node_modules/@itsapps/itsshops-core-*`,
then `npm install` (the lockfile stays unchanged). The same holds for a `#<tag>` changed by hand in
`package.json`: a bare `npm install` keeps the installed core (and its lockfile entry) — pin with
`npm install 'github:itsapps/itsshops-core-<x>#<tag>'` instead, then check
`node_modules/@itsapps/itsshops-core-<x>/package.json` → `version`.

**Netlify build-cache gotcha (same trap, on Netlify):** Netlify restores the cached `node_modules`,
so after a hash-only edit the build can keep running the **previous** core commit — the customer's
own files (e.g. a new function wrapper) deploy, the core code behind them doesn't (seen on staging, frontend and Studio both). After a hash-only pin, deploy with Netlify →
Deploys → Trigger deploy → **Clear cache and deploy site** (each affected project), and check the
deploy actually serves the new core (a changed response header, a string in the Studio bundle). A
pin that came from a real `npm install` with changed deps rebuilt fine. A **tag** pin with a new version
(`5.0.0` replacing `4.0.0`) rebuilds fine without clearing too — verified on a production site
(core-front 5.0.0 / core-back 6.0.0, normal builds served the new core).

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

**Back from a tag to floating:** a hash edit only works while `package.json` has **no** committish —
with `#<tag>` there, a hand-edited lockfile commit contradicts it. Switch once with a real install,
`npm install 'github:itsapps/itsshops-core-front'` (writes the spec without a tag and pins the
latest `main` commit), build, commit `package.json` + lockfile, then `npm link` again for dev. A
customer that isn't live yet (only `staging`) floats like this until go-live and pins a tag only
for its first production release.

## Releasing a customer to production

1. If the customer's `main` uses core past its last tag, a new core version is cut first
   (semver tags without `v`, `CHANGELOG.md` entry with "Upgrading" steps) — do those "Upgrading"
   steps for the customer, including its datasets.
2. Pin the tag(s) (`npm install 'github:itsapps/itsshops-core-<front|back>#<tag>'`); in a frontend
   also `npx update-browserslist-db@latest`; build locally; commit on `main`. Re-run `npm link`
   for dev afterwards. An interrupted install can leave the link renamed to
   `node_modules/@itsapps/.itsshops-core-<x>-<random>` next to a near-empty `itsshops-core-<x>/`
   (build fails with `Cannot find package …/itsshops-core-<x>/index.js`): delete the folder and
   rename the link back (or re-run `npm link`).
3. Bump the customer version (`npm version <minor|patch> --no-git-tag-version`), commit
   `Release <version>`, fast-forward `production` to `main`, tag that commit
   (`git tag -a <version> -m "core-front <x>, core-back <y>"`), push the tag via `origin` (a tag
   triggers no build), then push `production` with the deploy identity ("Deploy identity" below).
   Frontend and backend are tagged separately; when a release needs both, release the backend first.
4. Verify without customer impact: a string or header only the new core has (e.g. grep the
   Studio's `/static/sanity-*.js`); `POST` each Studio endpoint (`/api/payment/refund`,
   `/api/order/notify`, `/api/order/withdraw-notify`) with the `x-server-secret` and an empty JSON
   body — `400 "orderId is required"` = secret accepted, `401` = wrong.

Netlify's deploy history covers emergency rollbacks; the tags record *what* was live.

## Deploying a customer project (Netlify)

Branch-based:

1. Work on **`main`**; push it to `origin` as your **own** GitHub user (routine — `main` is not a
   Netlify deploy branch, so it triggers no build).
2. To deploy: merge `main` → the **`staging`** or **`production`** branch.
3. Push that branch to the **`user`** remote (the customer account, via its PAT). Netlify — tied to
   that same customer account — sees the matching pusher and rebuilds (`npm run build`, publish
   `dist/`). Deploy done.

After a deploy the checkout is often left on `staging` — check `git branch --show-current` before
the next commit, or it lands on the deploy branch only and is missing from `main`.

Each customer's branch names / Netlify site live in its own CLAUDE.md.

### Netlify projects per customer

Four Netlify projects, each with its **own** env vars (`.env*` files are gitignored and never reach
Netlify — local runs only):

| Project | Builds | Dataset | Holds |
|---|---|---|---|
| staging frontend | `staging` | `development` | server env (Functions scope secrets), build hook for `staging` |
| staging Studio | `staging` | `development` | public `SANITY_STUDIO_*` only; `NETLIFY_SITE_ID` = staging **frontend** |
| production frontend | `production` | `production` | its own secrets (never the staging values), build hook for `production` |
| production Studio | `production` | `production` | public `SANITY_STUDIO_*` only; `NETLIFY_SITE_ID` = production **frontend** |

The Studio's credentials (functions secret, build hook, Vinofact token) live **per dataset** in its
secrets document, so `development` holds the staging values and `production` the live ones. The
local Studio and frontend use `development` too: the local Studio's Deploy builds **staging**, and
local refunds/mails need the local frontend's `SERVER_FUNCTIONS_SECRET` = the staging one.

### Node.js version

Not pinned in the repos (no `NODE_VERSION`, no `.nvmrc`; `engines` only says `>=22`). It is a
**Netlify project setting** (Project configuration → Dependency management → Node.js version, a
major like `22.x`); read it with `netlify api getSite` → `versions.node.active`. Builds use the
latest patch of that major (the deploy log shows `Now using node v…`) — after a Node security
release, **trigger a redeploy** of production and staging so the build picks up the patch.
Functions run on AWS Lambda's managed runtime; its patch level can't be set from here. Switching
the major is no fix for an advisory that covers every supported major. Stripe sees the functions'
Node version (the `stripe` library reports it) and emails about outdated ones (e.g. 2026-10-22).

### Deploy identity (two push identities, split by branch)

**Each customer owns its GitHub + Netlify account** (under the customer's own email, e.g.
`shop@<customer-domain>`), so the site stays the customer's when the developer changes. Netlify's
free auto-rebuild fires only when the **GitHub pusher's identity matches the Netlify account
owner**. So pushes are split by branch:

- **`main`** (and feature work) → pushed via `origin` as the **developer's own GitHub user** (the dev
  is a collaborator on the customer's repo). `main` is not a Netlify deploy branch → no build.
- **New features go on a `feature/<slug>` branch, bug fixes on `fix/<slug>`** (no other prefixes,
  no bare names) in every repo they touch — core and customer (owner's rule, 2026-11-05; `fix/`
  2026-11-27) — not straight on `main`. A customer's `staging` may be merged from
  the feature branch for testing (its lockfile may pin a core commit from core's pushed feature
  branch); merge to `main` once it's tested, then delete the branch. Docs-only fixes may go to `main`.
  Merge a core branch that customers pin by **fast-forward or merge commit, never squash/rebase**:
  the pinned commits must stay reachable from `main`, or deleting the branch orphans them and a
  customer install of that hash can fail. Check first: `git merge-base --is-ancestor <pinned sha>
  origin/main`.
- **`staging` / `production`** → pushed via the **`user`** remote, authenticated with the **customer
  account's Personal Access Token (PAT)**. The pusher then matches the Netlify account → the build
  triggers.
This is about **push authentication**, *not* commit authorship — Netlify keys on the pusher, not
the author. Both remotes point at the **same** GitHub repo: `origin` (developer, `main`) and
`user` → `https://<PAT>@github.com/<customer>/…` (customer, `staging`/`production`). Remote names
can differ per customer — the customer's `CLAUDE.md` names them; check with `git remote` (names only).

**Secrets / gotchas:**
- The PAT lives **only** in the `user` remote URL in `.git/config` (not tracked by git). Never put it
  in a tracked file, commit it, or print it: no `cat .git/config` and no `git remote -v` (it prints
  the PAT URL). Use `git remote` / `git remote get-url origin` instead.
- `.git/config` is per-clone: a fresh clone / new machine loses the `user` remote + PAT, so it must be
  reconfigured there or `staging`/`production` pushes won't trigger a Netlify build.
