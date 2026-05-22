# Tactical — Git Automation Hardening

> **Read first:**
> - [docs/workflow.md](../workflow.md) — canonical session cadence + skill decision table + design principles.
> - [docs/tactical/productization-audit.md § A.8 Git automation findings](productization-audit.md#a8-git-automation-findings) — source register for every row below (A1–A10 cross-cutting observations).
> - [docs/tactical/productization-audit.md § C.2 Section 4 row T2](productization-audit.md#section-4--spawned-tacticals-separate-work-units) — the spawn entry that authorised this tactical.
> - [ADR 0009 — Deployment topology](../adr/0009-deployment-topology.md) — Decision 5 (`_routes.json` / `_headers` build-output contract) and Decision 8 (Worker bundle-size budget < 1 MB) are CI-asserted by G7 + G8.
> - [ADR 0010 — Session backend contract](../adr/0010-session-backend-contract.md) — cross-referenced by G8 (`/healthz` shape, indirectly verified by Docker HEALTHCHECK already in place).
>
> **Status:** Scaffolded 2026-05-21 · awaiting execution · **Owner:** Igor · **Last updated:** 2026-05-21
>
> This is a **short-lived working doc.** Delete it after every row below merges; ADRs 0009/0010 + the productization-audit C.2 ledger are the durable record. PLAN.md gets a one-line entry under Phase 2D once the last row ships — see "Wrap-up" below.

## Session startup checklist

1. Read this file fully.
2. Read the linked A.8 findings (A1–A10) and the C.2 Section 4 T2 spawn row.
3. Skim `PLAN.md` Phase Status Dashboard **for context only** — do not modify it during this work.
4. Use `TodoWrite` to track the sub-task list below.
5. Mark `[x]` as work completes; cross-reference the closing commit SHA in the row body.
6. On the last row, follow the "Wrap-up" section to append the PLAN.md Phase 2D entry and delete this file.

## Goal

Close the eight critical gaps in the CI / release / security-scan chain identified in productization-audit § A.8, plus two productization-relevant additions (compose build fallback for self-hosters; continuous knip in CI). The output is a CI pipeline that:

- Enforces lint + coverage + bundle-size + build-output shape on every PR;
- Auto-deploys to Cloudflare Pages on `master` push (the M10 productization ship-gate blocker);
- Catches malformed conventional-commit subjects locally before they reach semantic-release;
- Adds CodeQL static analysis to the security-scan surface.

**Container image scanning is out of scope** as of 2026-05-21 — Docker Hub publish has been deferred to its own future feature (locked decision #12 in the productization audit); the container-scan workflow will land alongside that feature when it spawns.

**Explicitly NOT a goal:**

- No new ADR. T2 is execution against decisions already locked in ADRs 0008–0010 + A.8. If a sub-decision surfaces during execution (e.g. "soft-fail vs hard-fail knip"), pause and flag to the user; don't pre-decide.
- No backend / worker jest scaffolding. That's a separate productization-audit follow-up (P5 / F4); intentionally out of scope here to keep T2 atomic.
- No matrix trimming (A.8 #A10). Deferred — runs fine today, optimisation only.
- No Renovate migration. Dependabot is healthy per A.8.3.
- No SBOM generation (A.8.4 row 5). Deferrable for v1; productization gate doesn't depend on it.

## Scope

### In scope

- Edits to `.github/workflows/*.yml` (new files and additions to existing ones).
- Edits to `.github/dependabot.yml` only if a new ecosystem is added (unlikely).
- Root `package.json` devDeps additions for `commitlint`, `simple-git-hooks`, `knip` config tweaks if needed (knip itself is already pinned per A.2).
- Root `compose.yml` edit (G9 — single-line `build: .` fallback).
- An external-action checklist for the user (Docker Hub secrets, Cloudflare API token + account ID, GitHub branch protection bits) — these live in this doc and migrate to T4's GitHub-dashboard checklist on wrap.

### Out of scope

- Skill-body edits (`.claude/commands/*.md`). Skills are gitignored; tracked as a future workflow.md "Process debt" item (see "Notes for Claude" below). T2 does not fix this surface.
- Backend / worker test infra (per Goal).
- `e2e-tests.yml` / `e2e-playwright.yml` content (T1 owns the Playwright workflow swap; T2 only confirms G10 (knip) doesn't conflict with whichever E2E workflow is active).
- `.releaserc.json` plugin changes. Locked monorepo-only posture (A.8 #A9 resolved 2026-05-20) means no `@semantic-release/npm`; nothing to add or remove.

## Locked decisions (from spawn 2026-05-21)

| # | Decision |
|---|---|
| 1 | **No new ADR.** Execution against ADRs 0008–0010 + A.8 findings. Sub-decisions surfacing mid-row → flag to user, don't pre-decide. |
| 2 | **Tactical doc is the source of execution truth.** A.8 register stays the discovery artifact; this doc is the closure ledger. |
| 3 | **PLAN.md phase = 2D.** Wrap-up line appends under Phase 2D when the last row closes. |
| 4 | **`simple-git-hooks` over Husky** (G3 row default lean). Lighter footprint, no postinstall ceremony. Revisit only if a row's execution surfaces a blocker. |
| 5 | **Extend `test.yml` for the ESLint step (G1)**, do not spawn a separate `lint.yml`. Fewer workflow runs; per-PR cost stays bounded. Revisit only if matrix-fan-out (Node 20/22/24 × ESLint) noticeably slows the gate. |
| 6 | ~~Cloudflare Pages deploy (G5) is the highest-priority row~~ — **dropped 2026-05-22**: G5 removed entirely per audit Locked Decision #14. Cloudflare's native git integration already deploys `axoview.pages.dev` on master push; no GH Actions workflow needed. A future GH-Actions-mediated CF deploy is a separate feature with its own ADR if ever wanted. After this drop the recommended start is **G2 (coverage gate)** — already shipped 2026-05-22. |
| 7 | **Knip continuous mode (G10) starts as soft-fail** (warns but doesn't block). Promote to hard-fail only after one full week of green runs against `master`. |
| 8 | ~~Container scanner choice~~ — **dropped 2026-05-21**: G6 removed entirely with the Docker Hub publish deferral (audit locked decision #12). Container scanning re-enters scope when Docker Hub publish spawns as its own feature. |
| 9 | **Worker bundle-size threshold = 1 MB uncompressed** per ADR 0009 Decision 8. The CI step asserts the *uncompressed* size; gzip / brotli ratios are downstream of the Cloudflare runtime, not this CI gate. |

## Sub-tasks

Ten rows, grouped by surface. Each row carries: closing commit SHA (on completion), driving finding, and a one-line "how to verify it landed". M10-blocker priority is called out in the **Priority** column.

### A. CI baseline (workflows directory)

| # | Action | Surface | Driving finding | Priority | Status |
|---|---|---|---|---|---|
| G1 | **Add an ESLint step to [.github/workflows/test.yml](../../.github/workflows/test.yml).** Extend the existing matrix job: insert `npx eslint .` (or `npm run lint` if the root script is rewired to invoke ESLint) between `npm ci` and `npm test`. Verify by deliberately pushing a lint-error commit on a throwaway branch and confirming the workflow fails red. | `test.yml` | A.8 #A1 | medium | [ ] |
| G2 | **[x] `967b2c7`** Removed the `\|\| npm test` coverage fallback at `test.yml:31`. `npm test -- --coverage` now runs without a fallback clause; lib's `coverageThreshold: 10%` failures will be real CI failures. Verified locally: `npm run build` + 93/93 jest suites / 1009 passes — identical to pre-edit. Closes A.8 #A2. | `test.yml` | A.8 #A2 | **M10 blocker** | [x] |
| G7 | **Add Worker bundle-size CI check** per ADR 0009 Decision 8. New step (in `test.yml` or a small dedicated workflow): build `packages/axoview-worker`, measure the emitted bundle, fail if > 1 MB uncompressed. Recommend using a small shell snippet over a third-party action (lower supply-chain surface). Verify by temporarily inflating the worker bundle and confirming red. | `test.yml` (new step) + `packages/axoview-worker/` build artifact | ADR 0009 D8 | medium | [ ] |
| G8 | **Add build-output verification step:** after `npm run build`, assert that `packages/axoview-app/build/_routes.json` AND `packages/axoview-app/build/_headers` exist. One-liner shell test; fail with a clear message if either is missing. Verify by deleting one of the two locally, running the build, and observing the workflow red. | `test.yml` (new step) | ADR 0009 D5 | medium | [ ] |
| G10 | **Continuous knip in CI** — new step that runs `npx knip` and posts the output. **Soft-fail mode initially** (per Locked Decision 7): the step's exit code is suppressed (`|| true` or equivalent), output is uploaded as a workflow artifact. Promote to hard-fail after one full week of green `master` runs. Verify by intentionally orphaning a file and confirming the step's artifact shows the new entry. | `test.yml` (new step) + `knip.json` (already present per A.2) | A.2 findings + productization-audit follow-up (new row, not in original A.8) | low | [ ] |

### B. Security scanning

| # | Action | Surface | Driving finding | Priority | Status |
|---|---|---|---|---|---|
| G4 | **Add a CodeQL workflow.** Use GitHub's provided default template; trigger on push to `master`, on `pull_request`, and weekly cron. Free for public repos. Verify by reviewing the Code Scanning tab once the first run completes; expect zero blockers (codebase is small + audited). | `.github/workflows/codeql.yml` (new) | A.8 #A8 | medium | [ ] |
| ~~G6~~ | ~~Add container image scanning to docker.yml~~ — **dropped 2026-05-21** with the Docker Hub publish deferral (audit locked decision #12). `docker.yml` was deleted; container scanning re-enters scope when Docker Hub publish spawns its own feature. | ~~`docker.yml`~~ | A.8 #A4 (deferred) | n/a | dropped |

### C. Release + commit hygiene

| # | Action | Surface | Driving finding | Priority | Status |
|---|---|---|---|---|---|
| G3 | **Add commitlint + simple-git-hooks** at the repo root. Install `@commitlint/cli` + `@commitlint/config-conventional` + `simple-git-hooks` as root devDeps; add a `.commitlintrc.json` with the conventional preset; wire `simple-git-hooks` to run commitlint on `commit-msg`. Verify locally by attempting a malformed commit subject (e.g. `feature: foo`) and observing the hook fail. **Decision deferred to execution time** if a contributor hook-install ceremony question surfaces (e.g. should it run on `postinstall`?) — pause and ask. | root `package.json` + `.commitlintrc.json` (new) + `.simple-git-hooks.json` or `package.json` `simple-git-hooks` field | A.8 #A7 | medium | [ ] |
| ~~G5~~ | ~~Add Cloudflare Pages deploy automation~~ — **dropped 2026-05-22** per audit Locked Decision #14. Resolved by reality: Cloudflare's native git integration already deploys `axoview.pages.dev` on every master push. No GH Actions workflow is needed; A.8 #A5 was based on the audit missing the live native-integration deploy. A future GH-Actions-mediated CF deploy is a separate feature with its own ADR if ever wanted. | ~~`.github/workflows/cloudflare-pages.yml`~~ | A.8 #A5 (superseded) | n/a | dropped |

### D. Deployer ergonomics

| # | Action | Surface | Driving finding | Priority | Status |
|---|---|---|---|---|---|
| G9 | **[x] `8ee387a`** Replaced `image: molikas/axoview:latest` with `build: .` in root [compose.yml](../../compose.yml) (and deleted `.github/workflows/docker.yml`) per audit locked decision #12 / baseline B-6. `docker compose up --build` now works on a fresh checkout without Docker Hub access. | `compose.yml` | discovered 2026-05-20 during B3 smoke (post-execution finding, folded into T2 per spawn brief); executed via baseline B-6 2026-05-21 | low | [x] |

## External-action checklist (out-of-repo)

These items cannot be closed by editing repo files — the user owns them. Track here; migrate to T4's GitHub-dashboard checklist on wrap. Note dates as items complete.

- [ ] **CodeQL enabled in GitHub repo settings** (`Settings → Code security → Code scanning`) — may need to be toggled on even after `codeql.yml` lands. **Blocks G4 first run from posting results.**

**Removed 2026-05-21:** `DOCKERHUB_USERNAME` + `DOCKERHUB_TOKEN` — dropped with the Docker Hub publish deferral (audit locked decision #12).

**Removed 2026-05-22:** `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` — dropped with G5 per audit Locked Decision #14. Cloudflare's native git integration handles master-push deploys without GH Actions credentials.

## Notes for Claude

- **Don't bundle rows.** Each G-row ships its own commit so a regression bisect points at one workflow change, not five. Exception: G7 + G8 may bundle if both land as new steps in the same `test.yml` job and the diff stays single-purpose.
- **Verify red, not just green.** For every gate row (G1, G2, G7, G8, G10), the verification step is "push a deliberately-broken throwaway commit on a side branch and confirm the workflow fails red." A row that's only verified green is unverified — coverage gates and lint gates have failed silently in the past (that's literally A.8 #A2's failure mode).
- **Pause-and-flag triggers (not blanket continuation):**
  - G3 contributor-hook-install ceremony question.
  - G10 soft-fail → hard-fail promotion (after one week of green; user gates the flip).
  - Any G-row that touches more than one workflow file in a single edit (means the row needs splitting).
- **Skill body edits (`.claude/`) are gitignored** — this is a known limitation per [docs/workflow.md § "Process debt — deferred skills"](../workflow.md#process-debt--deferred-skills). T2 does **not** fix it; it just notes it for the eventual "skills-in-repo" decision. If a row's execution surfaces a skill-edit need (e.g. a new `/lint-check` skill), park it for the future skills-in-repo decision, do not write to `.claude/`.
- **Recommended execution order** (per spawn brief + Locked Decision 6, post G5 drop): **~~G5~~ → G2 → G7 → G8 → G4 → G1 → G3 → G10.** G2 shipped 2026-05-22 (`967b2c7`); the remaining rows close in priority order. G7/G8 close the ADR 0009 CI gaps; G4 closes the security-scan surface (G6 dropped 2026-05-21 with the Docker Hub deferral; G5 dropped 2026-05-22 per audit Locked Decision #14 — CF Pages native git integration is the canonical deploy mechanism); G1 + G3 + G10 land in any order after. G9 already shipped 2026-05-21 via baseline B-6.
- **The C.2 ledger gets a row-by-row status update**, not just a final tick. As each G-row lands, append its commit SHA to the corresponding entry here AND to the C.2 Section 4 T2 row's running status note.

## Wrap-up

When every G-row above is `[x]` and the external-action checklist items that gate them are complete:

1. Add a single line under `PLAN.md` Phase 2D section:
   ```
   - Git automation hardening shipped — see docs/tactical/productization-audit.md § A.8 (driving findings) + ADR 0009 (CI-asserted contracts). T2 closed; CI/CD baseline meets M10 productization gate.
   ```
2. Update the productization-audit C.2 Section 4 T2 row status from `scaffolded 2026-05-21, awaiting execution` to `complete YYYY-MM-DD` (with the final commit SHA).
3. Delete this file. ADRs 0009/0010 + the C.2 ledger are the durable record.
4. Update memory pointer `project_docs_convention.md` — remove the `**Active tactical docs:**` bullet for `git-automation-hardening.md`.
5. Migrate the (now-complete) external-action checklist items into T4's GitHub-dashboard checklist when T4 spawns.
