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
| [technical-review-2026-06.md](technical-review-2026-06.md) | **Current** reviewer-grade deep snapshot — architecture narrative, sequence diagrams, deployment topology, security posture, file-by-file inventory, quality KPIs, decisions catalog. The authoritative depth that `architecture.md` points to. |
| [technical-review-2026-05.md](technical-review-2026-05.md) | Prior snapshot (post-M10 v1.0.0). Superseded by the 2026-06 review; kept for historical comparison. |
| [upstream-changelog.md](upstream-changelog.md) | Verbatim pre-fork `stan-smith/FossFLOW` changelog, preserved for lineage. Not maintained going forward. |

---

## Decision records (ADRs)

[docs/adr/](adr/) — eleven Accepted ADRs, one decision each. Start any new work by reading the ADR header for the contract you're about to touch.

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
