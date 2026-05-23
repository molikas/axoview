# Tactical — E2E Suite Rewrite (T1 / C.5)

> **Read first:**
> - [docs/workflow.md](../workflow.md) — canonical session cadence + skill decision table + design principles.
> - [docs/manual-test-baseline.md](../manual-test-baseline.md) — **scenario catalog source of truth.** J1–J20 + per-mode observations are the load-bearing input.
> - [ADR 0008 — Naming convention](../adr/0008-naming-convention.md), Decision 5 (`data-axoview-id` selective retrofit) — the selector contract this suite executes against.
> - [ADR 0011 — Error UX contract](../adr/0011-error-ux-contract.md) — every failure-of-intent surface this suite exercises.
> - [docs/tactical/productization-audit.md § C.2 Section 4 row T1](productization-audit.md#section-4--spawned-tacticals-separate-work-units) — the spawn entry that authorised this tactical.
> - [docs/tactical/productization-audit.md § C.2 Section 3 row I9](productization-audit.md#section-3--cleanups--renames--deletions) — the bundled-deletion row for the existing `packages/axoview-e2e/` and `e2e-tests/` directories; both delete together with this suite landing in CI.
>
> **Status:** Foundation laid (Session 2 done 2026-05-22) · **Owner:** Igor · **Last updated:** 2026-05-22
>
> This is a **short-lived working doc.** Delete it after M9 (suite green in CI) lands; ADRs 0008 + 0011 + the productization-audit C.2 ledger are the durable record. PLAN.md gets a one-line entry under Phase 2D once the suite is green — see "Wrap-up" below.

## Session startup checklist

1. Read this file fully.
2. Read [docs/manual-test-baseline.md](../manual-test-baseline.md) end-to-end — the scenario catalog (Section 3) and per-mode observations (Section 4) are the load-bearing input.
3. Read ADR 0008 Decision 5 and ADR 0011.
4. Skim `PLAN.md` Phase Status Dashboard **for context only** — do not modify it during this work.
5. Use `TodoWrite` to track the session's sub-tasks.
6. Mark `[x]` as work completes; cross-reference the closing commit SHA in the relevant row.
7. On Session 8 (debug pass green), follow the "Wrap-up" section to append the PLAN.md Phase 2D entry and delete this file.

## Goal

Rewrite the E2E suite from zero against the locked surface vocabulary (ADR 0008) and locked error UX contract (ADR 0011). The existing [`packages/axoview-e2e/`](../../packages/axoview-e2e/) and root [`e2e-tests/`](../../e2e-tests/) directories are deleted as part of this work (per audit C.2 row I9 — "bundled with the new E2E workflow landing"). The output is a Playwright suite that:

- Mirrors the canonical user journeys J1–J20 from the manual-test baseline, one spec file per journey (or coherent journey-pair);
- Uses a Page Object Model per surface so selectors live with the surface, not in the test;
- Adds `data-axoview-id` attributes lazily, as scenarios reach the surfaces that need them (per ADR 0008 Decision 5);
- Runs green in CI via a new `.github/workflows/e2e-playwright.yml` that replaces the dropped `e2e-tests.yml.backup`.

**Explicitly NOT a goal:**

- No new ADR. T1 is execution against ADR 0008 Decision 5 + ADR 0011. If a sub-decision surfaces during execution (e.g. "do we keep Selenium-suite test parity or rewrite scenarios from scratch?"), pause and flag to the user; don't pre-decide.
- No backend / worker jest scaffolding. Out of scope — separate productization-audit follow-up.
- No test-parity with either deleted suite (Selenium or current Playwright). The scenario catalog (J1–J20) is the source; both prior suites are artifacts.

## Scope

### In scope

- New `packages/axoview-e2e/` directory (rebuilt from zero in Session 2 after wholesale deletion of the existing one).
- New Playwright config, fixtures, POM files, and spec files per the inventories below.
- New `.github/workflows/e2e-playwright.yml`.
- Surgical `data-axoview-id` retrofits in `packages/axoview-app/src/components/` and `packages/axoview-lib/src/components/`, added the moment a spec needs them — never as a sweep.
- Deletion of the legacy [`e2e-tests/`](../../e2e-tests/) Python/Selenium root directory and any reference to it in `release.yml`'s workflow chain (per audit I9 bundle).

### Out of scope

- Visual regression / screenshot tests — future feature with its own ADR if wanted.
- Accessibility / a11y checks — future feature.
- Performance benchmarks — future feature.
- Test-parity with the deleted Python/Selenium suite — abandoned per locked decision #4 (clean slate).
- Test-parity with the deleted current Playwright suite — its scenarios are an artifact, not a spec; the J1–J20 catalog is the source.
- Cross-browser fan-out beyond Chromium for the initial green. Firefox/WebKit may follow once Chromium is stable; not gated on M9.

## Locked decisions (from spawn 2026-05-22)

| # | Decision |
|---|---|
| 1 | **Scenario catalog is closed.** [docs/manual-test-baseline.md](../manual-test-baseline.md) J1–J20 is the exclusive source of scope. If a behaviour isn't in the baseline, it's not in T1. New scenarios get filed as audit findings, not added to T1 inline. |
| 2 | **One spec file per journey (or coherent journey-pair).** No mega-files. Target ~10–13 spec files total. |
| 3 | **Page Object Model per surface.** Selectors live in POM files, not in tests. Target ~6–8 POM files (AppToolbar, FileExplorer, Canvas, NodeInfoTab, LayersPanel, SettingsDialog, HelpDialog, dialogs). |
| 4 | **`data-axoview-id` retrofit lazily.** Per ADR 0008 D5: add the attribute the moment a test needs it, never as a separate sweep. POM files document which attributes they expect; tests add them as scenarios are written. |
| 5 | **Smoke first, then deep.** J1–J10 (canonical journeys) cover ~80% of productization value. Edge cases come after. M9 (in-repo) can be partially-met before T1 finishes if J1–J10 are green. |
| 6 | **Out of scope (re-stated for emphasis):** visual regression, accessibility checks, performance benchmarks. Each can become its own future feature with own ADR if wanted. Keep `@playwright/test` bare. |
| 7 | **No new ADR.** T1 is execution against ADRs 0008 D5 + 0011. Sub-decisions surfacing mid-row → flag to user; don't pre-decide. |
| 8 | **Tactical doc is the source of execution truth.** The baseline doc stays the discovery artifact; this doc is the closure ledger. Token-spend is tracked per session against the budget below; drift flagged in user-visible checkpoints. |
| 9 | **PLAN.md phase = 2D.** Wrap-up line appends under Phase 2D when M9 (suite green in CI) lands. |

## Scenario catalog — journey → spec file mapping

13 spec files, each bounded. Each row cites the baseline's journey definition + the per-mode notes that constrain it.

| Journey(s) | Spec file | Baseline source |
|---|---|---|
| J1 (new diagram → place icons → save → reopen) + J20 (empty state → New/Import buttons) | `smoke.spec.ts` | baseline §3 J1 + J20 |
| J2 (connector + undo/redo) | `connector.spec.ts` | baseline §3 J2 |
| J3 (rectangle + textbox + save) | `shapes.spec.ts` | baseline §3 J3 |
| J4 (F2 rename in file explorer) | `rename.spec.ts` | baseline §3 J4 |
| J5 (diagram-to-diagram link, preview, navigation) | `multi-diagram.spec.ts` | baseline §3 J5 + §5 B-1 (post-fix surface) |
| J6 (layers: assign / hide / lock) | `layers.spec.ts` | baseline §3 J6 |
| J7 + J8 (JSON import / export) | `import-export-json.spec.ts` | baseline §3 J7 + J8 |
| J9 + J10 (project ZIP import / export) | `import-export-zip.spec.ts` | baseline §3 J9 + J10 |
| J11 + J12 (custom icon import / remove with usage warning) | `icons.spec.ts` | baseline §3 J11 + J12 |
| J13 (Local-mode share-uuid error) + J14 (Session share link) | `share.spec.ts` | baseline §3 J13 + J14 + §5 B-3 (popover focus management) |
| J15 (hotkey sanity: Ctrl+S/Z/Y/A/C/X/V/Del) | `hotkeys.spec.ts` | baseline §3 J15 |
| J16 + J17 + J18 (Settings, Help, Diagnostics dialogs) | `dialogs.spec.ts` | baseline §3 J16 + J17 + J18 |
| J19 (2D canvas mode toggle) | `canvas-modes.spec.ts` | baseline §3 J19 |

**Smoke set:** J1 + J20 (`smoke.spec.ts`). First deliverable; everything else follows.

## POM inventory

8 page-object files, one per surface. Each POM owns its selectors and documents which `data-axoview-id` attributes it expects (per locked decision #4, attributes get added to source the moment a POM declares them and a spec exercises that path).

| POM | Surface | Notes |
|---|---|---|
| `AppToolbarPOM` | top toolbar | Save, Open, Share, Preview, Export, brand mark. ADR 0005 Decision 1 (4-group RIGHT zone) shape. |
| `FileExplorerPOM` | left dock — file explorer | tree rows, context menu, rename inline editor, dialogs. ADR 0008 Decision 1 (Modal/Dialog/Popover vocabulary). |
| `CanvasPOM` | iso canvas | place icon, draw connector, drag items, lasso, hover affordances. ADR 0006 (canvas selection contract) shape. |
| `NodeInfoTabPOM` | right sidebar — Node Info tab | link picker, name field, notes textarea. Exercises the B-1 fix (open-linked-diagram IconButton). |
| `LayersPanelPOM` | left dock — Layers panel | layer rows, visibility / lock toggles, layer assignment. |
| `SettingsDialogPOM` | Settings dialog | tabs, controls. ADR 0005 Decision 1 (About + Diagnostics tabs). |
| `HelpDialogPOM` | Help dialog | shortcut list. Exercises J17 (and the B-4 follow-up that added Ctrl+A / Alt+click / Ctrl+click). |
| `DialogsPOM` | generic dialog primitives | Confirm, ADR 0011 error dialogs (`LocalModeShareErrorDialog`, `ReadonlyLoadErrorDialog`, `PublicShareLoadErrorDialog`), etc. |

## Sub-tasks (session budget)

Eight sessions, ~270K tokens total. Tactical doc tracks actual cost per session against the estimate; drift gets flagged in user-visible checkpoints.

| # | Session | Deliverable | Tokens (est.) | Tokens (actual) | Status |
|---|---|---|---|---|---|
| 1 | Scope (this session) | tactical doc | ~30K | _(record at session end)_ | **[~] scaffolded 2026-05-22** |
| 2 | Skeleton | delete old `packages/axoview-e2e/`, scaffold new, Playwright config, fixtures, POM stubs, `smoke.spec.ts` (J1 only); verify locally | ~50K | ~65K (mid-context-window estimate) | **[x] done 2026-05-22 (5 commits: `3ff4110` delete, `3f087c8` skeleton, `62d9705` fixtures+helpers, `cce1dda` AppToolbarPOM+J1 smoke green locally in ~13s, this commit doc-sync). Lazy data-axoview-id retrofits landed: `toolbar-save` (AppToolbar) · `screen-empty-create` (EmptyStateScreen) · `dock-elements-toggle` + `dock-layers-toggle` (LeftDock) · `canvas-icon-grid-item` (IconSelectionControls/Icon). Pending POMs/attributes tracked in `packages/axoview-e2e/pom/_pending.md`.** |
| 3 | Smoke complete | finish `smoke.spec.ts` (J20) + `connector.spec.ts` + `hotkeys.spec.ts` | ~30K | _(record)_ | not started |
| 4 | File ops | `import-export-json.spec.ts` + `import-export-zip.spec.ts` + `icons.spec.ts` | ~30K | _(record)_ | not started |
| 5 | Editor surfaces | `shapes.spec.ts` + `rename.spec.ts` + `layers.spec.ts` | ~30K | _(record)_ | not started |
| 6 | Diagram-link + dialogs | `multi-diagram.spec.ts` + `dialogs.spec.ts` + `share.spec.ts` + `canvas-modes.spec.ts` | ~40K | _(record)_ | not started |
| 7 | CI wiring | `.github/workflows/e2e-playwright.yml`; replace dropped `e2e-tests.yml.backup`; delete old `packages/axoview-e2e/` per I9 bundle; delete `e2e-tests/` root directory; remove from `release.yml` workflow chain if needed | ~30K | _(record)_ | not started |
| 8 | Debug pass | User runs locally + on CI; agent fixes flakes | ~30K | _(record)_ | not started |

**Budget total: ~270K tokens.**

**Session 2 actual-vs-estimate note (2026-05-22):** Session 2 ran ~30% over the
50K estimate primarily because the I-am-a-fresh-suite world had to (a) discover
that the dev server consumes `axoview-lib` via its built `dist/`, not source,
so the first lib-attribute retrofit required a full `npm run build:lib` + dev
restart before the spec could see the attribute; (b) absorb three runtime
surprises that the deleted suite had pre-amortised — the welcome notification
intercepts the empty-state click, the icon tile's MUI Tooltip portals over the
drag path, and `addInitScript`-based storage clearing wipes the reload-leg
diagram before the assertion runs. Each is documented in the commit body (`cce1dda`)
so Sessions 3-6 don't re-discover them. Adjusting Sessions 3-6 estimates: **+5K
per session** for the "second spec in the file" patterns to stabilise — bringing
the running total from ~270K to ~290K. No change to session ordering or scope.

## Wrap-up

When Session 8 closes (suite green locally + green in CI = M9 met):

1. Add a single line under `PLAN.md` Phase 2D:
   ```
   - E2E suite rewrite (T1) shipped — see docs/adr/0008 D5, docs/adr/0011, and (this file's git history). M9 met.
   ```
2. Delete this file. ADRs 0008 + 0011 are the durable record; the productization-audit C.2 ledger captures the row-level closure.
3. Update memory pointer in `project_docs_convention.md`: remove the `**Active tactical docs:**` bullet for `e2e-suite-rewrite.md`.
4. The audit's Section 4 T1 row gets its closing commit SHA appended; audit row I9 gets marked closed in the same wrap.

## Notes for Claude

- **Scenario catalog is closed (locked decision #1).** If a session-2-through-7 sub-agent surfaces a behaviour that isn't in J1–J20, do **not** add it to T1. File it as a baseline-doc finding (Section 5 row, fresh `B-N` number) and continue.
- **POMs own the selector contract.** Tests should read like prose; if you find yourself writing a CSS selector inside a spec, that's a missing POM method. Stop and add the method.
- **`data-axoview-id` retrofit is surgical, not prophylactic** (ADR 0008 D5). Add the attribute the moment a POM declares it AND a spec actually exercises it. Don't pre-stub attributes "in case." Each retrofit commit cites the POM file + the spec method that motivated it.
- **Smoke is the first deliverable.** Sessions 2 + 3 ship `smoke.spec.ts` + `connector.spec.ts` + `hotkeys.spec.ts` green before touching anything else. If those three flake, sessions 4–6 don't start.
- **Subagent leverage (sessions 3–6 only):** when the main session writes spec A, a general-purpose subagent can be spawned to write spec B in parallel against fresh context. Subagent reads: baseline doc + the relevant POM + the previously-written specs as pattern reference. Main session reviews + integrates the diff before commit. Each subagent saves ~30K main-context tokens. Use sparingly — only when the main session approaches ~50K and there's a clean spec-pair to fan out (e.g. `shapes.spec.ts` + `rename.spec.ts` in Session 5). Never fan out the smoke set.
- **CI workflow lands with the deletion.** Session 7 is atomic: new `e2e-playwright.yml` + delete the legacy `e2e-tests/` Python suite + delete the existing `packages/axoview-e2e/` artifact directories in the same commit. The audit's I9 row explicitly forbids a window where both suites are absent — so the CI workflow MUST be wired and passing locally before the deletes land.
- **Verification scope per session:** locally `npm run dev` + `npx playwright test --project=chromium` for whichever specs ship in the session. CI verification waits for Session 7 + 8.
- **Anti-pattern guard (memory: [feedback_be_serious_not_eager](../../../Users/isidenica/.claude/projects/c--myTemp-FossFLOW/memory/feedback_be_serious_not_eager.md)):** don't bundle "extra moves" with a session deliverable. If a session ships its named spec files green, that's the deliverable. Refactors, rename suggestions, and "while we're here…" tidying are out of scope unless they unblock the spec itself.
