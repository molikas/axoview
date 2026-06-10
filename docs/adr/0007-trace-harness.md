# ADR 0007 — Operational Trace Harness

**Status:** Accepted
**Date:** 2026-06-10
**Supersedes:** none
**Superseded by:** none

> **Backfill note.** This ADR documents work that already shipped (the DiagnosticsOverlay surface, the performance-troubleshooting playbook, and the `__perf_refactor_regression__` behavioural-contract suite). It is written after the fact to give those three artifacts a single locked decision record, because downstream process docs reference "ADR 0007" as the gate for the deferred `/trace` skill ([workflow.md A.9.4 #2](../workflow.md#process-debt--deferred-skills), [S7](../workflow.md#cadence-anomalies--locked-resolutions)). No code changes accompany this ADR — it records the contract the existing harness already satisfies.

## Context

Axoview's performance work needed a way to *name a bottleneck before changing code*. Three artifacts converged on that need independently over the MQA #7 drag-cliff investigation (2026-05-16) and the cold-start investigation (2026-05-19):

1. **A runtime diagnostics surface** — [DiagnosticsOverlay.tsx](../../packages/axoview-app/src/components/DiagnosticsOverlay.tsx), toggled from the BottomDock (or `localStorage.setItem('axoview_perf_enabled', 'true')` in prod). It writes a circular buffer of FPS / heap / long-task / scene-count samples and exports a compact JSON via the **↓ AI** button — a format ~80% smaller than the human-readable dump and directly ingestible by Claude.

2. **A render-count probe** — [`renderProbe.ts`](../../packages/axoview-lib/src/utils/renderProbe.ts), gated behind the `?perfprobe=1` URL flag (zero cost when disabled). It distinguishes "too many things re-rendering" from "each render is too expensive" — two different fixes. Wired into the drag hot path (Nodes / Node / NodeContent / Connectors / Connector).

3. **A behavioural-contract regression suite** — [`__perf_refactor_regression__/`](../../packages/axoview-lib/src/__perf_refactor_regression__/) (18 spec files + a [README](../../packages/axoview-lib/src/__perf_refactor_regression__/README.md)). These tests were written *before* the performance refactoring to lock in correct behaviour so the hot-path rewrites couldn't silently regress it. They are kept separate from `src/**/__tests__/` precisely so a reviewer can open one folder and see what was guarded before the hot paths were touched.

The diagnostic discipline that ties them together is captured in the [performance-troubleshooting playbook](../perf-troubleshooting.md): a four-step diagnostic pyramid (baseline diag → render-count probe → Chrome profile → targeted instrumentation), a set of hard rules ("measure first, fix second"; "one source of truth per frame"; "compositor for position, React for content"), and a catalogue of the six anti-patterns (A-1…A-6) the investigations surfaced and fixed.

These three artifacts plus the playbook were shipping and load-bearing, but had no single decision record. [workflow.md](../workflow.md) names "ADR 0007 acceptance" as the gate for the deferred `/trace` verification skill ([A.9.4 #2](../workflow.md#process-debt--deferred-skills), [S7](../workflow.md#cadence-anomalies--locked-resolutions)) — a dangling reference to an ADR that did not exist. This backfill closes that reference.

## Decision

### 1. The trace harness is three layers, each gated to be zero-cost when off

The operational trace harness is the union of three layers. Each is independently toggled and carries **no runtime cost when disabled**:

- **DiagnosticsOverlay** (runtime sampling) — off unless toggled from the BottomDock or enabled via the `axoview_perf_enabled` localStorage flag.
- **renderProbe** (render-count attribution) — off unless `?perfprobe=1` is present in the URL; the module reads the flag once at load.
- **`__perf_refactor_regression__`** (behavioural contracts) — a test-only suite; never bundled into production.

The zero-cost-when-off property is the load-bearing constraint: diagnostics that cost something in the steady state get disabled and bit-rot. These three stay shippable because they are inert until explicitly switched on.

### 2. Persistent diagnostics live in dedicated, flagged modules; one-off instrumentation is stripped before commit

Per [perf-troubleshooting.md A-6](../perf-troubleshooting.md#a-6--diagnostic-instrumentation-shipped-in-production):

- **Persistent diagnostics** (kept indefinitely for future investigations) are gated behind a flag and live in a dedicated module — `renderProbe.ts`, `DiagnosticsOverlay.tsx`. Safe to ship.
- **One-off troubleshooting** `console.log` calls added during an active investigation MUST be stripped before commit. The check is `git grep -n "console\." packages/*/src` (excluding tests) run immediately before committing perf work.

### 3. The regression suite is a frozen behavioural baseline, not a unit-test grab-bag

`__perf_refactor_regression__/` tests assert **behavioural contracts the performance fixes must not violate** — grid background formula, `useScene` list shape + reference stability, ResizeObserver lifecycle, RAF cleanup, keyboard dispatch-once, multi-select contract, connector render isolation, drag-start prevention, etc. The rules ([README](../../packages/axoview-lib/src/__perf_refactor_regression__/README.md)):

- Do **not** modify these tests during a refactor unless the behaviour under test is *intentionally* changing, and that change is agreed in review.
- All specs must be **green on the current codebase** before any refactoring begins.
- Run: `npm test --workspace=packages/axoview-lib -- --testPathPattern=__perf_refactor_regression__`.

### 4. The diagnostic pyramid is the canonical order; the playbook is its living record

When a slow-interaction report lands, the [playbook](../perf-troubleshooting.md#the-diagnostic-pyramid-cheapest-first) prescribes the order: (1) capture a baseline diag from DiagnosticsOverlay, (2) run the render-count probe, (3) only then open a Chrome Performance profile, (4) add targeted throttled instrumentation to confirm the named layer. The playbook is a **living doc** — each investigation that lands appends a Case study subsection (MQA #7, cold-start gap are the two worked examples).

## Consequences

### Positive

- The dangling "ADR 0007" reference in workflow.md ([A.9.4 #2](../workflow.md#process-debt--deferred-skills), S7) now resolves. The deferred `/trace` skill has a concrete acceptance gate to build against.
- The three artifacts gain a single locked record; a future contributor finds the harness contract without reverse-engineering it from three separate files.
- The zero-cost-when-off constraint is written down, so future diagnostics inherit the discipline that keeps the existing ones shippable.

### Negative / open

- **`/trace` is still deferred.** This ADR records the *existing* harness; it does not build the `/trace` skill. That skill remains gated (workflow.md A.9.4 #2) on `trace.ts` landing in `axoview-lib` — a future, larger piece of work this ADR does not commit to.
- **No build-time enforcement of the "strip one-off console.log" rule.** It is a pre-commit grep discipline, not a lint gate. A future CI rule could enforce it; this ADR does not require one.
- **The regression suite is lib-only.** The app package's behavioural contracts (storage, lifecycle) are covered by `src/**/__tests__/` rather than a frozen baseline folder. That asymmetry is intentional — the frozen folder existed to guard a *specific* hot-path refactor — but it means there is no app-side equivalent if a comparable app-level rewrite is undertaken.

## See also

- [docs/perf-troubleshooting.md](../perf-troubleshooting.md) — the diagnostic playbook (hard rules, pyramid, A-1…A-6 anti-patterns, case studies).
- [packages/axoview-lib/src/__perf_refactor_regression__/README.md](../../packages/axoview-lib/src/__perf_refactor_regression__/README.md) — the regression suite's charter and run command.
- [packages/axoview-app/src/components/DiagnosticsOverlay.tsx](../../packages/axoview-app/src/components/DiagnosticsOverlay.tsx) — the runtime sampling surface.
- [packages/axoview-lib/src/utils/renderProbe.ts](../../packages/axoview-lib/src/utils/renderProbe.ts) — the render-count probe.
- [docs/workflow.md](../workflow.md#process-debt--deferred-skills) — the deferred `/trace` skill (A.9.4 #2) gated on this ADR.
