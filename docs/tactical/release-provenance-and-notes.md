# Tactical — Release Provenance & Notes Integrity

> **Read first:**
> - [ADR 0045 — Release Version Provenance and In-App Version Surfacing](../adr/0045-release-version-provenance-and-in-app-surfacing.md)
> - [ADR 0046 — Release-Notes Generation: Body-Level Detail and Reference Integrity](../adr/0046-release-notes-generation-and-reference-integrity.md)
> - [ADR 0009 — Deployment Topology](../adr/0009-deployment-topology.md) (why Cloudflare builds from git — the mechanism behind the drift)
> - [ADR 0005 — Toolbar and Dock Layout Contract](../adr/0005-toolbar-and-dock-layout-contract.md) (owns the About/version display surface)
> - [docs/workflow.md](../workflow.md) (release cadence + commit convention this touches)
>
> **Status:** Not started · **Owner:** molikas · **Last updated:** 2026-07-23
>
> This is a **short-lived working doc.** Delete it after the work merges; ADRs are the durable record. PLAN.md gets a one-line entry referencing the ADRs once shipped — see "Wrap-up" below.

## Session startup checklist

1. Read this file fully.
2. Read ADR 0045 and ADR 0046.
3. Skim `PLAN.md` Phase Status Dashboard **for context only** (this lands under Phase 5* — deployment/release infra) — do not modify it during this work.
4. Use `TodoWrite` to track the sub-tasks below.
5. Mark `[x]` as work completes.
6. On completion, follow the "Wrap-up" section to update PLAN.md with a single line.

## Goal

Make the released version honest and the release notes useful. Concretely: (1) the deployed app shows the true released version (fix the 3.7 vs 3.8.3 drift) from a single committed source of truth; (2) surface the version on the boot splash in addition to the existing About tab; (3) make release notes carry per-fix detail without abandoning `/shake-out`'s one-commit-per-bundle; (4) stop emitting broken issue links, given the project uses no issue tracker.

**Not a goal:** building an in-app changelog/"What's new" viewer; adopting a GitHub issue tracker; retroactively repairing historical CHANGELOG links beyond the one-time 3.8.x backfill.

## Scope

### In scope
- `scripts/resolve-version.js` + `rslib.config.ts` + `rsbuild.config.ts` — build-time version injection from the git tag.
- `.releaserc.json` — point release-notes-generator at the custom `config` module (`scripts/release-changelog-preset.mjs`): render body, suppress issue-reference links.
- `packages/axoview-app/app-shell.html` (+ `rsbuild.config.ts` param) — boot-splash version stamp.
- `CHANGELOG.md` — one-time 3.8.0 + 3.8.1 backfill.
- `docs/workflow.md` + `/shake-out` checklist — commit-body-carries-detail + no-issue-footer hygiene.

### Out of scope
- In-app changelog viewer.
- Any change to `scripts/update-version.js` (it already writes all five package.jsons correctly).
- Commit-back via `@semantic-release/git` — rejected: it pushes to `master`, which branch protection blocks (GH013 — broke v3.8.0, removed in #77). The version comes from the git tag at build time instead (ADR 0045 §1).
- A CI lint gate for issue references (ADR 0046 §3 — unnecessary without a tracker).

## Locked decisions (from design discussion 2026-07-23)

| # | Decision |
|---|---|
| 1 | Version provenance = **build-time injection from the git tag** ([scripts/resolve-version.js](../../scripts/resolve-version.js)) into the lib (rslib `PACKAGE_VERSION`) + app (rsbuild `REACT_APP_VERSION`) builds. **Not** commit-back — `@semantic-release/git` pushes to `master`, blocked by branch protection (GH013 — broke v3.8.0, removed in #77). |
| 2 | Version UI = keep the existing About tab (no code change) **and** add a subtle version stamp to the `#ax-splash` boot screen. No third/duplicate version surface. |
| 3 | Release notes = keep one-commit-per-bundle; the commit **body** carries per-fix bullets, and the notes generator is configured to render the body under the entry. |
| 4 | Links = suppress issue-reference auto-linking (no issue tracker — every `closes #N` is dead). Keep the real PR reference + commit hash. No CI lint gate. Revisit if a tracker is ever adopted. |
| 5 | One-time **cosmetic** CHANGELOG backfill for `3.8.0` + `3.8.1` (the real local gap; `CHANGELOG.md` is non-canonical — GitHub Releases is canonical per #77). |

## Sub-tasks

### A. Version provenance (build-time tag injection)
- [x] Add [scripts/resolve-version.js](../../scripts/resolve-version.js): `AXOVIEW_VERSION` env → exact tag → nearest clean tag (`--abbrev=0`) → `package.json` fallback; best-effort `git fetch --tags` in CI/CF.
- [x] Wire into `rslib.config.ts` (`PACKAGE_VERSION`) and `rsbuild.config.ts` (`REACT_APP_VERSION`).
- [x] Confirm `.releaserc.json` carries **no** `@semantic-release/git` (would re-break releases via GH013 — #77).
- [x] Deploy hook wired: `successCmd` in `.releaserc.json` + `CF_PAGES_DEPLOY_HOOK` env in `release.yml` (no-op until the secret is set).
- [ ] **Live-verify:** create the CF Pages deploy hook → add it as the `CF_PAGES_DEPLOY_HOOK` repo secret → confirm a release rebuilds CF and the About tab reads the exact version.

### B. Version surfacing (`axoview-app`)
- [ ] Stamp `REACT_APP_VERSION` onto the `#ax-splash` markup in `app-shell.html` (paints before React mounts; removed with the splash by `bootScreen.ts`). Keep it small/muted.
- [ ] Confirm the About tab (`AboutTab.tsx`, `PACKAGE_VERSION`) needs **no** code change — provenance fix alone corrects it.
- [ ] Build lib + app; verify the splash stamp renders and matches the About value in a local build.

### C. Release-notes generation (`.releaserc.json` + docs)
- [x] Custom config module [scripts/release-changelog-preset.mjs](../../scripts/release-changelog-preset.mjs) (wraps the conventionalcommits preset): renders `commit.body` under the entry + clears `commit.references` (keeps the subject PR link + hash). Wired via `.releaserc.json` release-notes-generator `config`.
- [x] Validated offline with `generateNotes` against the real broken commit — dead links gone, per-fix bullets render, PR + hash kept.
- [x] Prose/skill updates for the authoring side live in **Section E**.

### D. CHANGELOG backfill
- [x] Backfilled `3.8.0` + `3.8.1` into `CHANGELOG.md` (the real local gap), link-clean, generated from real history with the custom config.

### E. Skill & doc coherence (repo-versioned — must travel with every clone; NOT memory)

> ADR 0045/0046 change project **conventions**, so the change has to land in the repo-versioned skill bodies + `docs/workflow.md` — those are what every machine/clone reads. Memory is machine-local and cannot carry a shared convention. Exact wording is being finalized by the coherence verify-sweep (launched 2026-07-23); the targets below are the confirmed scope.

**`docs/workflow.md`** (canonical doc the skills defer to — most edits concentrate here):
- [ ] **L110** (`/notes` row) — *"CHANGELOG + versions are auto-cut by semantic-release on merge — never hand-edited"*: name the commit-back mechanism (`@semantic-release/git`) and carve out the one-time 3.8.x backfill exception (ADR 0045 D1/D3).
- [ ] **L113** (`/shake-out` row) — keep *"one coherent commit per bundle"*; add that the commit **body** carries the per-fix bullets and no issue footers (ADR 0046 D1/D3).
- [ ] **L123 / L277** (semantic-release description + *"update-version keeps them in lockstep"* + S9 resolution) — state the bump is now **committed back** (previously built-then-discarded), so the deployed build + in-repo CHANGELOG track the release (ADR 0045 D1).
- [ ] **L142** (Commit subject convention) — add the references-hygiene rule: no `Closes #N`/issue footers while no tracker; body carries user-facing detail (ADR 0046 D3).

**`.claude/commands/shake-out.md`** — bundle-commit checklist: author a user-facing per-fix **body**; no issue footers (ADR 0046 D1/D3).

**`.claude/commands/notes.md`** — reconcile the CHANGELOG "auto-cut / never hand-edited" framing with commit-back + the one-time backfill (ADR 0045 D1/D3).

**`.claude/commands/ship.md`** — version-coherence check stays valid; refresh the rationale (versions now *advance* via commit-back, not frozen) (ADR 0045 D1). Light touch.

- [ ] `/feature`, `/audit`, `/docs-sweep` — verify-sweep confirming; edit only if it finds a genuinely stale reference.
- [ ] **Do not** edit `docs/reviews/*` (frozen snapshots).

## Wrap-up

When all sub-tasks are complete and the smoke checklist passes:

1. Add a single line under `PLAN.md` Phase 5* section:
   ```
   - Release provenance + notes integrity shipped — version single-source-of-truth (semantic-release/git commit-back), boot-splash version stamp, body-level notes + suppressed dead issue links. See docs/adr/0045..0046 and (this file's git history).
   ```
2. Delete this file. The ADRs are the durable record; this checklist's job is done.
3. No memory pointer to refresh (no `project_docs_convention.md` on this machine).

## Notes for Claude

- **This touches the release pipeline + CI — you cannot fully verify it without a real release.** Use `npx semantic-release --dry-run` on a branch as the primary check; treat the first real release after merge as the true acceptance gate and watch it.
- **The `[skip ci]` / release-loop concern is load-bearing** (ADR 0045 §1). Do not merge the git plugin without confirming the guard.
- The **body must stay user-facing** once it's rendered into notes (ADR 0046) — a scratchy commit body becomes a scratchy changelog.
- Two version defines exist (`PACKAGE_VERSION` in rslib, `REACT_APP_VERSION` in rsbuild); the commit-back fix corrects both — don't wire them separately.
- Build both lib and app after the boot-splash change (app consumes lib's built `dist`).
