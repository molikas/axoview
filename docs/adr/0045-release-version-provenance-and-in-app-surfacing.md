# ADR 0045 — Release Version Provenance and In-App Version Surfacing

**Status:** Accepted
**Date:** 2026-07-23
**Accepted on:** 2026-07-23
**Supersedes:** none
**Superseded by:** none

> Sibling: [ADR 0046 — Release-Notes Generation](0046-release-notes-generation-and-reference-integrity.md). Together they cover release provenance (this ADR — *which version shipped and how the build knows it*) and release documentation (0046 — *what shipped and how it's described*). This ADR interacts with [ADR 0005 §About](0005-toolbar-and-dock-layout-contract.md) (which owns the in-app version display) and [ADR 0009 — Deployment Topology](0009-deployment-topology.md) (Cloudflare Pages builds production from the git tree — the mechanism that makes the drift possible).

## Context

The Settings → About tab shows a version that is **wrong in production**: `v3.7.0` while the latest release/tag is far ahead (`v3.8.1` locally; `v3.8.3` in the user-reported production state). This is a **provenance** bug. Two build-time values feed the in-app version, and both read the **committed** `package.json`, which is frozen:

1. **`PACKAGE_VERSION`** — baked by [rslib.config.ts](../../packages/axoview-lib/rslib.config.ts) from **axoview-lib's** `package.json`. Rendered by [AboutTab.tsx](../../packages/axoview-lib/src/components/SettingsDialog/AboutTab.tsx) as `v{PACKAGE_VERSION}` and re-exported as `version` from [standaloneExports.ts](../../packages/axoview-lib/src/standaloneExports.ts).
2. **`REACT_APP_VERSION`** — defined by [rsbuild.config.ts](../../packages/axoview-app/rsbuild.config.ts) from **axoview-app's** `package.json`. Used for the exporter tag stamped into saved project zips.

**Why the committed version is frozen — and why commit-back is off the table.** semantic-release ([.releaserc.json](../../.releaserc.json)) cuts releases as a **git tag + GitHub Release via the API only**. It does *not* bump the committed `package.json`. This is deliberate: `@semantic-release/git` (which pushes a `chore(release)` commit to `master`) was present until commit **#77** (`ci(release): drop @semantic-release/git commit-back to master`), which removed it because —

> The master branch ruleset requires every change to go through a pull request, with no bypass. `@semantic-release/git` pushed the `chore(release)` commit directly to master, which the ruleset rejects (**GH013**), so the Release job failed and **v3.8.0 never cut.**

So restoring commit-back would re-break releases. The committed `package.json` (and `CHANGELOG.md`) therefore stay frozen by design, and the **git tags + GitHub Releases are the canonical release record**. Production, meanwhile, is built by **Cloudflare Pages from the `master` git tree** ([ADR 0009](0009-deployment-topology.md)), so it inherits the frozen version.

#77's rationale claimed the freeze was "cosmetic — nothing reads `package.json` at runtime." That is true at *runtime* but wrong at *build time*: the About tab and exporter bake the version from `package.json` during the build, so a frozen file yields a frozen in-app version. That is the gap this ADR closes — **without** reintroducing commit-back.

Users file no issues against a tracker (triage is in chat), so the in-app version is the primary signal of which build is live. It must be trustworthy.

## Decision

### 1. Inject the version from the git tag at build time (not the committed package.json)

A shared helper [scripts/resolve-version.js](../../scripts/resolve-version.js) resolves the version, consumed by both build configs — [rslib.config.ts](../../packages/axoview-lib/rslib.config.ts) (`PACKAGE_VERSION`) and [rsbuild.config.ts](../../packages/axoview-app/rsbuild.config.ts) (`REACT_APP_VERSION`). Resolution order:

1. **`AXOVIEW_VERSION` env override** — lets CI / Cloudflare set the version explicitly.
2. **Exact tag on `HEAD`** (`git describe --tags --exact-match`) → a clean release version, e.g. `3.8.1`.
3. **Nearest reachable tag** (`git describe --tags --abbrev=0`) → a clean number, e.g. `3.8.3` — Cloudflare builds a commit *before* its release tag exists, so this is the common pre-rebuild case.
4. **Fallback** to the passed `package.json` version when git/tags are unavailable — no worse than today.

In CI / Cloudflare the clone may omit tags, so steps 3–4 first do a best-effort `git fetch --tags`. This needs **no push to master and no ruleset change** — it reads the tag semantic-release already creates (plus the optional deploy hook below for exactness).

### 2. Version surfaces: keep the About tab, add a boot-splash stamp

- **About tab (existing).** No code change — it already renders `v{PACKAGE_VERSION}`; Decision 1 makes that value correct. Do **not** add a second in-app version panel (ADR 0005 owns the canonical detailed surface).
- **Boot splash (new).** Stamp the app version onto the `#ax-splash` boot screen ([app-shell.html](../../packages/axoview-app/app-shell.html) + [bootScreen.ts](../../packages/axoview-app/src/utils/bootScreen.ts)) so the live build's version is visible on every load, not only after opening Settings. Removed with the splash.

### 3. One-time CHANGELOG backfill (cosmetic)

The in-repo [CHANGELOG.md](../../CHANGELOG.md) stops at `3.7.0` because it is regenerated in CI but never committed back (same frozen-tree cause). It is **non-canonical** (GitHub Releases is canonical, per #77), but leaving it visibly stale reads as unmaintained. Backfill the missing shipped releases (`3.8.0`, `3.8.1`) **once by hand**, in the link-clean format from [ADR 0046](0046-release-notes-generation-and-reference-integrity.md). Ongoing, the in-repo file will still drift; the durable answer to "what shipped" is the GitHub Releases page.

## Consequences

**Positive:**
- The in-app version (About tab + boot splash) and exporter tag track the git tag instead of a frozen file — no reintroduction of the GH013 release failure, no branch-protection change, no pipeline change.
- Pure build-time + code-only; nothing new to operate.

**Negative / risks:**
- **Version exactness depends on a post-release rebuild.** Cloudflare builds a commit *before* its release tag exists, so between the merge and the release it shows the **clean previous tag** (e.g. `3.8.3`). To show the exact just-cut version, semantic-release's `successCmd` POSTs to a **Cloudflare deploy hook** after publishing, triggering a rebuild of the now-tagged commit → `git describe --exact-match` → the exact version (e.g. `3.8.4`). Gated on the `CF_PAGES_DEPLOY_HOOK` secret; **without it, the app shows the last released tag** (still a large improvement over the multi-release freeze).
- **Tag-less clones self-heal.** [resolve-version.js](../../scripts/resolve-version.js) does a best-effort `git fetch --tags` in CI/Cloudflare, so a shallow/tag-less checkout fetches tags rather than falling back to the frozen `package.json`.
- The committed `package.json` / `CHANGELOG.md` stay frozen (accepted per #77). Nothing reads `package.json` at runtime; the build now reads the tag.

## Implementation notes (non-binding)

- [scripts/resolve-version.js](../../scripts/resolve-version.js) is CommonJS so both `require()` (rslib) and default-`import` (rsbuild) consume it. It swallows git errors and falls back, so a tag-less or git-less build never breaks.
- The deploy hook is implemented via `@semantic-release/exec`'s `successCmd` in [.releaserc.json](../../.releaserc.json) — it fires only when a release is actually published, and is a no-op unless `CF_PAGES_DEPLOY_HOOK` (a Cloudflare Pages deploy-hook URL, stored as a GitHub Actions secret and wired into [release.yml](../../.github/workflows/release.yml)) is set.
- Boot-splash stamp: injected via the rsbuild `appVersion` template parameter into `#ax-splash`, so it paints before React mounts; kept visually subordinate per [ux-principles](../guidelines/ux-principles.md).

## Acceptance criteria

- **Manual verification (surface):** a build whose `HEAD` is a release tag shows that version in the About tab and the `#ax-splash` boot stamp (e.g. `3.8.1`, not `3.7.0`); a build ahead of the tag shows the clean previous tag (e.g. `3.8.3`); a freshly exported project zip's exporter tag matches.
- **Manual verification (fallback):** with git/tags unavailable, the build still succeeds and falls back to the `package.json` version.
- **No pipeline regression:** `.releaserc.json` carries no `@semantic-release/git` plugin; releases continue to cut as tag + GitHub Release (no GH013).
- **Backfill:** `CHANGELOG.md` contains `3.8.0` + `3.8.1` sections with no dead links (per ADR 0046).
