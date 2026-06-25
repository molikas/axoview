# Axoview Engine Performance Charter

Durable spec for the self-driving performance initiative. The cold-start prompt
points here; this file is the ground truth that survives context compaction and
multi-session handoff. The committed **decision log** (`perf-results/decision-log.md`)
and **baseline table** (`perf-results/baseline.md`) are the running memory — the
context window is scratch.

> **Status (updated 2026-06-25):** **T1 + T2 BANKED and MERGED TO MASTER.** Canvas2D
> is the production node renderer (Iters 7–11; [ADR 0019](../adr/0019-canvas2d-node-render-layer.md));
> the canvas-UX-overhaul perf gate ("Track P") confirmed the budget held tip-vs-pre.
> The durable **harness + measurement protocol + tier ladder + LEB60 north-star** are
> promoted to [ADR 0020](../adr/0020-engine-perf-harness-and-measurement-protocol.md)
> (authoritative copy; sections below are working context).
>
> **What the charter is active for now: the NEW large-diagram _pan_ sub-track (T2.5 / R1).**
> A pan-performance floor surfaced AFTER this charter froze — the program only ever
> measured *spawn* and *drag*; **there is no pan scenario in the harness**. R1 (the
> per-frame synchronous canvas-repaint floor) is OPEN in [`known_issues.md`](../../known_issues.md)
> and is the subject of branch `fix/large-diagram-pan-perf`. See the **2026-06-25
> resume point** in [`perf-results/decision-log.md`](../../perf-results/decision-log.md)
> for the current state and next steps.
>
> **🔭 T3 (simulation engine — LEB60) and T4 (WebGL) are DEFERRED (decision 2026-06-25):
> continue evolving Canvas2D, do NOT rewrite the engine.** The LEB60 / "kids' tile-world
> sim" product mandate (line ~89 below) is **not ratified** in any vision doc, ADR, or
> product register; Axoview ships as a static diagram editor that Canvas2D serves
> sub-linearly to ~2,000 nodes. T3/T4 reopen only when **(a)** the sim product is
> ratified **and (b)** a tick-workload harness measures a real Canvas2D ceiling (the RED
> gate below). A full isoflow-fork engine rewrite was evaluated and declined for now.

---

## Executive Summary

**OBJECTIVE:** Push the Axoview canvas toward tile-based game-engine performance
via a self-driving empirical loop (hypothesis → experiment → observe → revise),
preserving correctness, until a defined tier target is met or a documented
architectural ceiling is reached. Major architectural overhaul (Canvas2D/WebGL
render, ECS simulation) is AUTHORIZED but is a RED gate — escalate with evidence
before committing.

**KEY RESULTS (binary-verifiable):**

- **KR1.** A committed one-command perf harness drives the REAL app in REAL
  Chromium (Playwright) and reports p50/p95 frame time for (a) bulk-spawn/render
  and (b) drag, parameterized by entity count N. Harness self-reports run-to-run
  variance; p95 noise band < 10% on an idle machine BEFORE any optimization.
- **KR2.** Baseline numbers committed for N ∈ {25, 50, 100, 200, 500, 1000}
  before any change.
- **KR3.** The idle-churn guardrail passes (see Guardrails) — fixed FIRST.
- **KR4.** Tier target met (see Ladder) OR a written architectural-ceiling
  finding backed by profiler/trace evidence.
- **KR5.** Correctness-invariant suite (selection, collision/occupancy,
  undo/redo, dragged-node visual-position parity) stays GREEN after every kept
  change.
- **KR6.** Committed decision log: one row per hypothesis = {hypothesis, single
  variable changed, median-of-N before/after, noise-relative verdict,
  keep/revert, why}.

---

## Measured baseline (production telemetry — the wall you are beating)

Collapse is driven PURELY by node count (connectors & textboxes were 0 the
entire run):

| Node count | Sustained fps | Verdict |
|---|---|---|
| ~25 | 50–60 | OK |
| ~40 | 13–27 | already below 30fps |
| ~75–90 | 3–9 | unusable |
| 200+ | 1–4, multi-second main-thread freezes | frozen |

- Heap ≈ **0.5 MB per node** (50MB → 165MB over 230 nodes); fps ∝ 1/N. Signature
  of per-node React reconcile + SVG/DOM paint — **render does not scale**.
- **SEPARATE BUG:** heap climbs 42 → 63 MB and long-tasks accrue with ZERO nodes
  on canvas (idle churn/leak). This corrupts every measurement — fix it before
  scaling work, and prove the harness noise floor is clean afterward.
- No simulation/movement load was tested — everything above is *static* nodes.
  T3 sim targets are unmeasurable until the Phase 0.5 tick-workload harness exists.

---

## North-star metric

**LEB60 — Live Entity Budget @60fps:** count of concurrently simulated,
collision-checked, MOVING entities sustaining p95 frame ≤ 16.6 ms on a populated
world. **Today's LEB60 ≈ 20** (static, no movement). Companion: **SSB** = static
structures rendered at 60fps idle; **today ≈ 25**.

---

## Tier ladder (targets; each names the unlock it requires)

| Tier | SSB / LEB60 | World | Unlock required |
|---|---|---|---|
| **T0** — measured today | 25 / ~20 | tiny | — (DOM/SVG + React per node) |
| **T1** — stop the bleeding | 300 / ~50 | small | fix idle churn, memoize render, no per-frame React on bulk-paste. **NO rewrite.** |
| **T2** — render rewrite ✅ | 2,000 / ~200 | medium | **Canvas2D** layer decoupled from React + viewport culling — **BANKED (master)** |
| **T2.5** — pan / large-diagram floor 🔧 | steady-60fps pan @SSB | medium | dirty-region / layered redraw **or** sync-small/async-large hybrid + a `measurePan` harness scenario (R1, [`known_issues.md`](../../known_issues.md)). **ACTIVE sub-track** (`fix/large-diagram-pan-perf`). |
| **T3** — simulation engine ⭐ 🔭 | 2,000 / **1,000** | 256×256 | **ECS + fixed-timestep tick loop + spatial-hash collision**; tick decoupled from render — **DEFERRED** (unratified product + unmeasured ceiling; see Status) |
| **T4** — stretch / near-engine 🔭 | 10,000 / **5,000+** | large | **WebGL instanced** sprites; batched per-tick rule eval — **DEFERRED** (only if a measured Canvas2D ceiling forces it) |

**T3 KRs (the product target — kids' tile-world sim):** 1,000 animals moving
1 tile/tick @ 10 ticks/s with collision, atop 2,000 structures on a 256×256
grid → p95 frame ≤ 16.6 ms; tick p95 < 5 ms; render p95 < 11 ms; tick and render
never serialize into one >50 ms long task; per-tick input→output rule eval
(e.g. cow+grass→…, cow+bull→calf adjacency) within the tick budget.

---

## Guardrail metrics (each must be green or the LEB number is a lie)

- **Idle heap flat** ±5% over 60s at zero entities. (today: fails, +50%)
- **Zero frames > 50 ms** during a bulk paste of N. (today: fails, multi-sec freezes)
- **Bulk-spawn** of 1,000 completes with no fps < 30 and no single stall > 100 ms.
- **Memory per entity < 5 KB.** (today: ~500 KB — 100× over)

---

## Operating protocol — follow strictly

**PHASE 0 (HARNESS FIRST — do not optimize yet):** Install deps, build lib,
build the Playwright perf harness. Drive synthetic pointermove streams + scripted
bulk-paste; capture frame timing via rAF deltas AND CDP tracing /
PerformanceObserver(longtask). Median-of-≥7, warm-up discarded, print the noise
band. Prove KR1, then fix idle churn (KR3), re-prove a clean noise floor, commit
the baseline (KR2).

**PHASE 0.5 (sim workload):** add a tick-workload harness — N entities moving
1 tile/tick with collision — so T3 becomes measurable. Build before claiming T3.

**LOOP (until stop rule):**

1. State ONE hypothesis + the ONE variable it changes; predict direction/size.
2. Implement the minimal change; keep the tree isolatable (commit/stash first).
3. Measure with the SAME harness, same N set, median-of-≥7.
4. A result inside the noise band is NOT an improvement — revert it.
5. Run the correctness suite (KR5). Red → revert regardless of speed.
6. Append a decision-log row (KR6); if kept, update the baseline.
7. Form the next hypothesis from what the TRACE showed, not guesses. When code
   can't explain a number, INSTRUMENT — don't re-read the same files.

**GUARDRAILS:** one variable per iteration; never bundle; representative scene
only — you may NOT make the benchmark fast by removing work the real app does
(the correctness suite is the anti-cheat). Collision is already O(1) tile-hash —
prove via trace it is a bottleneck before touching it (it almost certainly is not;
render is).

**STOP RULE (any holds):** tier target met; OR 3 consecutive hypotheses each
yield < noise-band gain (local minimum); OR the ceiling provably needs a
render/sim rewrite. Then STOP and write a findings report (current vs baseline,
what worked/didn't and why, the binding bottleneck with trace evidence, next
architectural move). Do NOT begin a multi-session overhaul without presenting
this report first.

---

## Context & continuity (re-entrancy)

- Treat the context window as SCRATCH. Ground truth lives on disk: this charter,
  the decision log, the baseline table, results files. After EVERY kept/reverted
  iteration, commit the log + results before starting the next — never hold
  multiple iterations' state only in context.
- You are resumable. On (re)start, READ the decision log and baseline first and
  continue from there; do not restart the loop or re-measure committed baselines.
- Run the loop INLINE in this agent — it is serial and stateful; do not fragment
  it across cold subagents.
- Use subagents ONLY for bounded, parallel, read-heavy fan-out that returns a
  conclusion (exploration/profiling of independent scenarios), or an isolated
  build+measure of one variant in a git worktree. The main agent owns the
  harness, the loop, and the decision log.
- Expect this to span multiple sessions. Each session ends with the log committed
  and the next hypothesis written down.

---

## Autonomy & escalation

**RUN MODE:** self-paced loop. After each iteration, commit the decision log +
results, then continue without asking. Do NOT request confirmation for GREEN
work.

- **🟢 GREEN (proceed silently):** reversible hypothesis iterations within the
  current tier that keep the correctness suite green. This is the default — work.
- **🟡 YELLOW (notify, don't block):** on reaching a tier target or a
  partial-success milestone, commit, push a one-line notification, and continue
  to the next tier autonomously.
- **🔴 RED (STOP, notify, await human):** before committing to any architectural
  rewrite (Canvas2D/WebGL/ECS); on any irreversible change or one that can't keep
  correctness green; on local minimum (3 consecutive sub-noise hypotheses); or on
  hitting the budget cap. Stop scheduling wake-ups, push a notification, write the
  findings report, and wait.

**BUDGET CAP:** stop and escalate (RED) after **40 iterations** or **6 hours** of
wall clock without a tier advance, whichever first. (Tune to taste.)

**PRECONDITIONS FOR AUTONOMY (do these supervised, then notify for sign-off
BEFORE looping):** (1) harness built + p95 noise band < 10% proven; (2) idle-churn
bug fixed and clean noise floor re-proven; (3) correctness suite airtight. Only
after human sign-off on these, switch to GREEN-default self-paced looping.

---

## Environment notes (Windows / this clone)

- Repo: `c:\myTemp\FossFLOW` (the `perf/engine` T1+T2 work is **merged to master**).
  Current sub-track branch: `fix/large-diagram-pan-perf` (T2.5 / R1 pan floor).
- Windows / PowerShell primary; Bash tool available for POSIX scripts.
- **Build gotcha:** axoview-app reads axoview-lib from `dist/`, NOT source. After
  every `npm run build:lib` you MUST restart the dev server or rsbuild's resolver
  desyncs. Bake this into the harness.
- Existing Playwright package: `packages/axoview-e2e` — reuse its setup.
- Keep all scratch/results files INSIDE this repo (`./perf-results/`). Never write
  outside the workdir.
