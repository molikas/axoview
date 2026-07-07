# Axoview Documentation Index

**Axoview** is an isometric diagramming tool (a community fork of FossFLOW / Isoflow). For the product overview, feature list, and lineage, start at the [root README](../README.md). This page is the **map of the `docs/` tree** — what each document is for and when to read it.

The docs follow a three-tier convention (see [workflow.md Design principle 4](workflow.md)):

- **Living references** — current quick-reference for how the system works *today*. Kept in sync with the code; the place to read before doing work.
- **Frozen baselines** — point-in-time deep snapshots. Never updated after they're cut; they record what was true on a date, for reviewer hand-off and historical comparison.
- **Decision records (ADRs)** — one durable decision each, with rationale. Change only via the `/feature extend|supersede` discipline.
- **Operational** — moving-state trackers: the roadmap, the open-issues register, the manual-test record.

When a living reference and a frozen baseline disagree, the **living reference wins** for "what's true now"; the baseline tells you what changed since its date.

---

## Living references

Read these before touching the relevant surface. Each is a quick-reference, not a comprehensive description — they cross-link to the deeper baselines and ADRs for detail.

| Doc | Read it when… | Scope |
|---|---|---|
| [architecture.md](architecture.md) | You need the 5-minute orientation: what the codebase contains and where each piece lives | Feature inventory, store/mode/reducer/scene maps, lessons learned, pointers to all deeper sources |
| [workflow.md](workflow.md) | Starting a session — which skill fires when, where artifacts land | Canonical session cadence, skill decision table, six design principles |
| [ux-principles.md](ux-principles.md) | Building or reviewing any UI surface (canvas, panels, file explorer, layers, dialogs) | The shipped design language, expressed as principles so new work doesn't drift |
| [testing.md](testing.md) | You need the regression-suite catalogue — which suite pins which contract, and the coverage gaps | Per-layer suite breakdown, classifications, how to run |
| [deployment.md](deployment.md) | Deploying to local dev / Docker / Cloudflare Pages | From-scratch walkthrough per target, auth modes, smoke tests, troubleshooting |
| [perf-troubleshooting.md](perf-troubleshooting.md) | Chasing a render/drag/startup performance problem | Diagnostic playbook + case studies (drag GC cliff, cold-start gap) |

---

## Frozen baselines

Deep snapshots cut on a date and left immutable. Read for the comprehensive narrative the living docs deliberately don't restate, or to see what a past state looked like.

| Doc | What it is |
|---|---|
| [technical-review-2026-07.md](technical-review-2026-07.md) | **Current** reviewer-grade deep snapshot (post-labels/text-styling wave, v3.1.0 candidate at PR #58). Delta-based on the 2026-06 baseline; adds the full audit report — health scorecard, UX-consistency / perf hot-path / coherence sweeps, risk register, P1–P3 recommendations. |
| [technical-review-2026-06.md](technical-review-2026-06.md) | Prior snapshot (post-v1.1 wave, v2.0.1). Still the full-depth architecture narrative (system + sequence diagrams, deployment topology, file-by-file inventory) that the 2026-07 review deliberately does not restate. Superseded as "current" by the 2026-07 review. |
| [technical-review-2026-05.md](technical-review-2026-05.md) | Prior snapshot (post-M10 v1.0.0). Superseded by the 2026-06 review; kept for historical comparison. |
| [upstream-changelog.md](upstream-changelog.md) | Verbatim pre-fork `stan-smith/FossFLOW` changelog, preserved for lineage. Not maintained going forward. |

---

## Decision records (ADRs)

[docs/adr/](adr/) — 35 ADRs (31 Accepted, 4 Proposed; 0016/0017 are unused numbers), one durable decision each. Start any new work by reading the ADR header for the contract you're about to touch. *(Table rebuilt 2026-07-05 — it had been stale at 11 rows since 0012 landed; technical-review-2026-07 §8j. 0035–0037 added 2026-07-07 with the Drive-storage promotion.)*

| # | Decision |
|---|---|
| [0001](adr/0001-project-zip-format.md) | Project zip format |
| [0002](adr/0002-icon-catalog-merge-on-load.md) | Icon catalog merge on load |
| [0003](adr/0003-session-storage-lean-icon-save.md) | Lean icon save (strip default catalog) |
| [0004](adr/0004-connector-name-and-details-panel.md) | Connector name + details-panel parity |
| [0005](adr/0005-toolbar-and-dock-layout-contract.md) | Toolbar & dock layout contract |
| [0006](adr/0006-canvas-selection-contract.md) | Canvas selection contract (single + multi) |
| [0007](adr/0007-trace-harness.md) | Operational trace harness |
| [0008](adr/0008-naming-convention.md) | Naming convention |
| [0009](adr/0009-deployment-topology.md) | Deployment topology |
| [0010](adr/0010-session-backend-contract.md) | Session backend contract |
| [0011](adr/0011-error-ux-contract.md) | Error-UX contract |
| [0012](adr/0012-view-mode-node-info-popover.md) | View-mode item info popover |
| [0013](adr/0013-preview-mode-layer-switcher.md) | Preview-mode layer switcher (presentation chrome) |
| [0014](adr/0014-ephemeral-annotation-overlay.md) | Ephemeral annotation overlay |
| [0015](adr/0015-node-label-legibility-scaling.md) | Node label legibility scaling |
| [0018](adr/0018-touch-pen-gesture-contract.md) | Touch / pen canvas gesture contract |
| [0019](adr/0019-canvas2d-node-render-layer.md) | Canvas2D node render layer (default substrate) |
| [0020](adr/0020-engine-perf-harness-and-measurement-protocol.md) | Engine perf harness & measurement protocol |
| [0021](adr/0021-paste-algorithmic-perf-and-spatial-index.md) | Paste algorithmic perf & the derived tile index |
| [0022](adr/0022-canvas-pointer-interaction-model.md) | Canvas pointer-interaction model *(Proposed)* |
| [0023](adr/0023-off-grid-positioning-and-collision.md) | Off-grid positioning & per-item collision *(Proposed)* |
| [0024](adr/0024-node-label-positioning-and-sizing.md) | Node label positioning & sizing |
| [0025](adr/0025-image-export-robustness-and-presets.md) | Image export robustness & presets *(Proposed)* |
| [0026](adr/0026-rectangle-edge-transform-handles.md) | Rectangle edge-midpoint transform handles |
| [0027](adr/0027-canvas-context-menu.md) | Canvas context menu (per-item command surface) |
| [0028](adr/0028-ux-journey-testing-protocol.md) | UX journey-testing protocol *(Proposed)* |
| [0029](adr/0029-sanitize-user-authored-html.md) | Sanitize user-authored HTML |
| [0030](adr/0030-docked-style-controls-strip.md) | Docked style-controls strip (canonical styling surface) |
| [0031](adr/0031-floating-label-entity-model.md) | Floating Label as a first-class entity |
| [0032](adr/0032-node-name-caption-label-model.md) | Node name / caption / label model (Option A) |
| [0033](adr/0033-element-text-style-field-convention.md) | Element text-style field convention (B/I/S) |
| [0034](adr/0034-inline-canvas-text-editing-and-dual-scope-strip-formatting.md) | Inline canvas text editing & dual-scope strip formatting |
| [0035](adr/0035-google-identity-and-drive-authorization.md) | Google identity & Drive authorization (GIS token model) |
| [0036](adr/0036-google-drive-storage-provider.md) | Google Drive storage provider |
| [0037](adr/0037-storage-places-model.md) | Storage places model (one tree, two places) |

---

## Operational

Moving-state trackers. These change as work progresses (under their own change discipline) — they are not quick-references.

| Doc | Purpose |
|---|---|
| [PLAN.md](../PLAN.md) | Strategic phase dashboard. Read for context; edited only via `/feature wrap`. |
| [known_issues.md](../known_issues.md) | Register of open runtime issues, deferred fixes, and their risk/complexity. |
| [manual-test-baseline.md](manual-test-baseline.md) | Canonical "what Axoview does today" walk record; seeds the E2E scenario catalog + ship-readiness checklist. |

---

*This index is itself a living reference — when a doc is added, retired, or changes tier, update the table here in the same change.*
