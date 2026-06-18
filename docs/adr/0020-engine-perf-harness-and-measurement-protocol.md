# ADR 0020 — Engine Performance Harness & Measurement Protocol

**Status:** Accepted
**Date:** 2026-06-15
**Supersedes:** none
**Superseded by:** none

## Context

The engine-performance initiative (T2 render rewrite — [ADR 0019](0019-canvas2d-node-render-layer.md)
— and the planned T3 simulation engine) needs a **reproducible measurement
methodology**, not ad-hoc timings. The methodology was developed and proven across
Iters 0–9 and has been living in [docs/tactical/perf-charter.md](../tactical/perf-charter.md).
That file is a **tactical** doc — by the three-tier convention (ADR 0008, and
[workflow.md](../workflow.md) Principle 4) it is deleted at `/feature wrap` when T2
ships. Its durable half — the harness contract, the measurement discipline, the tier
ladder, and the north-star metric — must outlive T2 because **T3 reuses it verbatim**.
This ADR promotes that durable half to a locked decision; the charter tactical is
retired at the T2 wrap.

The central empirical fact that shapes the protocol: **cross-session machine drift was
measured at ~22%, far exceeding the ~2–5% within-run noise.** Absolute frame numbers
are therefore only comparable between runs taken close together on the same machine
state. Any methodology that compares a fresh run against a prior-session baseline is
measuring drift, not the change.

## Decision

The durable performance methodology is the following, and all engine-perf work (T2,
T3, T4) conforms to it.

**1. Harness (KR1).** A committed one-command harness — `npm run perf`
([packages/axoview-e2e/perf/](../../packages/axoview-e2e/perf/)) — drives the **real
app in real Chromium** (Playwright) via the debug bridge (`window.__axoview__`), with
StrictMode double-render and the diagnostics overlay disabled for representative cost.
It scripts bulk-paste (spawn) and synthetic pointermove streams (drag), capturing
p50/p95/mean/longest-frame/settle/long-task per entity count N ∈ {25, 50, 100, 200,
500, 1000, 2000}, plus the idle guardrail. It **owns its server lifecycle** (`build:lib
&& dev`, fresh) so it never measures a stale `dist/`.

**2. Measurement protocol (KR6) — the anti-drift discipline.**
- Every keep/revert is a **same-session A/B with a stable calibration index** (a fixed
  CPU-workload index printed each run). The reference and treatment runs must report a
  matching calibration index; a mismatched pair (e.g. 3.8 vs 3.1) is **discarded and
  re-run warm**, never compared.
- Median-of-≥N runs, warm-up discarded; the **noise band** (coefficient of variation of
  the continuous headline metric) is reported. **A result inside the noise band is not a
  change** and is reverted.
- **One variable per iteration.** One decision-log row per hypothesis: {hypothesis,
  single variable, before/after, noise-relative verdict, keep/revert, why}.

**3. Running memory (durable).** [perf-results/decision-log.md](../../perf-results/decision-log.md)
(one row per hypothesis; the resume point is its tail) and
[perf-results/baseline.md](../../perf-results/baseline.md) (current certified numbers)
are the persistent record — the context window is scratch. **`baseline.md` is rewritten
by every run, including partial/diagnostic runs — restore it (`git checkout`) after any
non-full run; only a clean full idle run updates it.**

**4. Tier ladder & north-star metric.** Targets, each naming the substrate unlock it
requires:

| Tier | SSB / LEB60 | Unlock |
|---|---|---|
| T0 (today) | 25 / ~20 | DOM/SVG + React per node |
| T1 | 300 / ~50 | fix idle churn, memoize; no rewrite |
| T2 | 2,000 / ~200 | **Canvas2D** layer decoupled from React + cull (ADR 0019) |
| T3 ⭐ | 2,000 / **1,000** | **ECS + fixed-timestep tick loop + spatial-hash collision**; tick decoupled from render |
| T4 | 10,000 / **5,000+** | **WebGL instanced** sprites; batched per-tick rule eval |

The **north-star is LEB60** — Live Entity Budget @60fps: concurrently simulated,
collision-checked, *moving* entities holding p95 frame ≤ 16.6 ms. **SSB** (static
structures @60fps) is the companion. T2 advances SSB; T3 is the LEB60 product target
(1,000 animals moving 1 tile/tick @ 10 ticks/s with collision atop 2,000 structures on
a 256×256 grid; tick p95 < 5 ms, render p95 < 11 ms, never serialized into one >50 ms
task).

**5. Guardrails (each must be green or the headline number is a lie).** Idle heap flat
±5% over 60s at zero entities (KR3); zero frames > 50 ms during a bulk paste; bulk-spawn
of 1,000 with no fps < 30; memory per entity < 5 KB.

**6. Anti-cheat.** The committed correctness suite is the anti-cheat: a perf change may
not remove work the real app does. Each renderer carries a draw/work counter the harness
asserts against N (DOM: `[data-drag-id]` shell count; Canvas: draw count per ADR 0019).

**7. Escalation (RED gate).** An architectural rewrite (Canvas2D/WebGL render, ECS
simulation) is authorized but RED: a written design + a measured proof-of-concept
finding precede the multi-session overhaul, and the decision is presented before
committing. Local minimum (3 consecutive sub-noise hypotheses) or a provable substrate
ceiling triggers a findings report.

## Consequences

**Positive:**
- T3 opens with `/feature start t3-sim-engine` reading this ADR + the running memory,
  with zero methodology re-derivation.
- Every perf claim in the repo is reproducible by a fresh reader running `npm run perf`
  and reading the decision-log row.

**Negative / risks:**
- The calibration index is **machine-relative**; the harness is tuned for the Windows
  dev box. Porting the absolute numbers to CI requires recalibration, not a copy.
- The same-session-A/B discipline is a process constraint a hurried contributor can
  violate (comparing across sessions); the ~22% drift figure here is the standing
  reminder of why that produces garbage.

## Implementation notes (non-binding)

- Env knobs: `PERF_N`, `PERF_REPEATS`, `PERF_WARMUP`, `PERF_IDLE_MS`; diagnostics
  `PERF_PROFILE` / `PERF_CPUPROFILE` (spawn), `PERF_DRAGPROFILE` (drag),
  `PERF_RENDERPROBE`, `PERF_NOLABEL`, `PERF_NOCONN`. (`PERF_CANVAS` is retired with the
  flag in ADR 0019.)
- **Build/dev gotcha (load-bearing):** the rsbuild dev server desyncs from `dist/` after
  `build:lib` ("Can't resolve 'axoview'"). Let `npm run perf` own the lifecycle
  (build + fresh boot); do **not** `PERF_REUSE` against a hand-started dev server unless
  it was just rebuilt + restarted. Kill stray :3000 listeners between runs.
- **Phase 0.5 (gates T3):** add a tick-workload harness — N entities moving 1 tile/tick
  with collision — before any T3 (LEB60) claim. T3 sim targets are unmeasurable until
  it exists.
- A durable summary of `npm run perf` (contract, env knobs, gotcha) lives in
  [docs/testing.md](../testing.md); this ADR is the decision, that section is the how-to.

## Acceptance criteria

- `npm run perf` runs from a clean checkout and emits `baseline.md` + a noise band; KR1
  noise band < 10% on the load-bearing range.
- The durable artifacts (this ADR, `decision-log.md`, `baseline.md`, the harness code,
  the `docs/testing.md` section) survive the T2 `/feature wrap`; only the charter
  tactical and the T2-specific scaffolding are retired.
- T3 can be opened against this ADR without reconstructing the methodology.
