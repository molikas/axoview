# AxoBench — render stress-test & performance showcase (design proposal)

_Status: **investigation / proposal only.** Nothing built. This is the "GPU-test
for the node engine" the perf workstream can use as (a) a closed-loop limit
finder, (b) a same-session A/B visualiser for T2 (DOM vs Canvas2D), and (c) a
pretty "proof of great performance" demo with a live scoreboard._

---

## 1. Intent & framing

Think 3DMark / Unigine Heaven, but for the axoview engine. A self-driving scene
that **spawns, moves, collides, and re-routes** thousands of richly-styled nodes
in choreographed phases, with a live FPS/frame-time HUD and a final composite
**score**. Two personalities from one engine:

- **Benchmark mode** — fixed PRNG seed, fixed choreography, fixed phase budgets →
  a *comparable, repeatable* number. This is the proof artifact.
- **Demo mode** — free-running, loops forever, tuned to look good on a screen
  behind someone's talk. Same driver, relaxed determinism.

The key realisation: we are **not** building a new renderer or physics engine. We
are building a **conductor** — a single rAF loop that mutates node kinematics in
plain JS and pushes them into the existing engine through the *same immer-free
batch path the real drag uses_ (`batchUpdateViewItemTiles` +
`previewConnectorPaths`). So the bench measures the real hot path, and any number
it produces is honest.

---

## 2. Two stress vectors (the thing that makes the numbers meaningful)

The decision log already separates **compositor-bound** motion from
**React-reconcile/collision-bound** motion (iter 5/6). A credible bench must
exercise both and let you *dial the ratio*, because they have wildly different
cost and a single blended number hides which one you improved:

| Vector | What moves | Cost driver | API surface |
|---|---|---|---|
| **(A) Visual / compositor** | *fractional* tile deltas → CSS `translate3d` only | GPU compositing, paint | CSS-var write (`--ff-drag-dx/dy`) — no scene write |
| **(B) Structural** | *integer* tile changes → collision check + A\* re-route + scene write | JS pathfinding + React reconcile of connectors | `batchUpdateViewItemTiles` + `previewConnectorPaths` |

A node "sliding along a connector" or "racing left→right" between integer tiles is
mostly **(A)** — cheap, smooth, pretty. A node *crossing tile boundaries* into
occupied tiles is **(B)** — expensive, and the real SSB/LEB regime. The bench
phases below are explicitly labelled A / B / A+B so the HUD can attribute the
frame cost, and so "we held 60fps" is never accidentally a compositor-only claim.

---

## 3. Architecture — the Conductor

```
┌──────────────────────────────────────────────────────────────┐
│ BenchConductor  (one rAF loop, dev-only, flag-gated)          │
│                                                                │
│  PRNG (mulberry32, seeded)                                     │
│  Agents[]   ── plain JS, NOT in any store:                    │
│      { id, pos:{x,y} (fractional), vel, phaseState,           │
│        homeTile, style }                                       │
│                                                                │
│  every frame:                                                  │
│    1. phase.step(agents, dt)        // mutate pos/vel          │
│    2. quantize → tile updates       // fractional vs integer   │
│    3. batchUpdateViewItemTiles(...) // structural (vector B)   │
│       OR write CSS vars directly    // visual    (vector A)    │
│    4. previewConnectorPaths(...)    // reroute trailing edges  │
│    5. sampler.record(frameDelta)    // FPS / p95 / longtask    │
│    6. hud.maybePaint()              // throttled, see §6       │
│                                                                │
│  PhaseMachine: Ignition → Race → Flow → Storm → Ramp → Cooldown│
│  LoadController: closed-loop N/velocity feedback (§5)          │
└──────────────────────────────────────────────────────────────┘
```

Why agents live **outside** the store: the store is the system under test, not the
simulation state. Keeping kinematics in a flat typed array means the per-frame
sim cost is ~0 and every millisecond the HUD reports is engine cost, not bench
overhead. (Same reasoning the harness uses for keeping the scene build out of the
measured window.)

**Reuse, don't reinvent.** Extract the harness's `buildScene` /
`makeIconUrl` / `mulberry32` (`engine-perf.spec.ts:191-408`) into a shared
`packages/axoview-lib/src/dev/benchScene.ts` so the Playwright harness *and* the
in-app bench build byte-identical scenes from the same seed. That alignment is
worth a lot: the bench becomes the eyeball-able twin of the headless number.

---

## 4. The choreography (phases)

Each phase is a `step(agents, dt)` strategy. Budgets are wall-clock in benchmark
mode, loop-forever in demo mode. Ordered roughly easy→brutal, then a cooldown
victory lap — the classic stress-test arc.

### Phase 0 — Ignition (spawn wave)  ·  *stresses mount/reconcile*
Nodes **fountain** in from a seed point, or cascade row-by-row from the left, N
growing 0 → N_target over a few seconds. Visually: staggered scale+fade-in (a
per-node CSS `@keyframes` on first mount, free on the compositor). This is the
**spawn settle** scenario made continuous — it stresses React mount + layout +
icon decode, the 283ms@1000 cost. Variety generator (§7) runs here so every node
that lands is differently styled.

### Phase 1 — The Race  ·  *vector A, with periodic B*
Nodes race **left → right** along lane-rows at varied speeds; as a node exits the
right edge it wraps to the left with a fresh style (treadmill). Mostly fractional
motion (smooth compositor), but lanes occasionally cross so a few nodes hop
integer tiles → bursts of collision/reroute. Pretty *and* a gentle structural
warm-up. New nodes keep appearing at the left to push N up.

### Phase 2 — Flow (slide along connectors)  ·  *vector A + path interp*
Nodes detach from tiles and **glide along their connector polylines** —
parametric `t∈[0,1]` along the routed path, eased. Looks like packets flowing
through a network. Exercises the connector-path interpolation and the
`previewConnectorPaths` write path under continuous motion. This is the
signature "looks nice" moment.

### Phase 3 — The Storm (collision mosh pit)  ·  *vector B, max*
All nodes do a bounded random-walk / Brownian drift toward a dense centre, each
**crossing occupied integer tiles every frame** → worst-case collision checks +
A\* re-route storm + scene churn. This is the real torture test: the SSB-2000
regime under motion. Connectors writhe as endpoints shove each other. Ugly-fast
is the point; the HUD earns its keep here.

### Phase 4 — The Ramp (find the wall)  ·  *closed-loop, §5*
Hold the Storm motion pattern and let the **LoadController** push N (and/or
velocity) up until the frame budget breaks, then record the limit. This is the
"push to the testing limits" core. Auto-discovers and reports:
`max sustained N @ 60fps` and `@ 30fps`.

### Phase 5 — Cooldown (victory lap)  ·  *vector A*
Nodes ease into a tidy isometric lattice / spell a word / form a logo, connectors
settle, HUD freezes the **final score card**. Calm, deliberate, screenshot-ready.

---

## 5. LoadController — the closed loop ("push to the limit")

A GPU stress test finds the thermal wall; this finds the **frame-budget wall**.
A PID-ish controller over a rolling median frame time:

```
target = 16.6ms (60fps gate)  // or 33.3 for the 30fps gate
err = target - medianFrame(last ~30 frames)
if err > margin:  add K nodes  (and/or +velocity)      // headroom → push
if err < -margin: remove nodes (and/or -velocity), mark stall
record the high-water N that held median ≤ target for ≥ M consecutive frames
```

Outputs the two headline numbers the showcase wants:
- **N@60** — largest node count that sustained 60fps under the Storm pattern.
- **N@30** — the same at 30fps (the "still usable" wall).

This is far more compelling than a fixed-N pass/fail: it's a *capacity* number,
and it auto-scales to whatever machine runs it. Pair it with the harness's
`calibrate()` machine-index so two machines' walls are comparable.

---

## 6. The HUD / scoreboard (the "looks like a GPU test" part)

A **separate `<canvas>` overlay** (never React — it must not perturb what it
measures, and it must survive the Storm). Painted at a throttled cadence
(~6–10 Hz, decoupled from the sim rAF) so the HUD itself costs ~nothing.

Live widgets:
- **FPS gauge** — big, colour-graded (green ≥58, amber ≥30, red below).
- **Frame-time graph** — rolling ~3s sparkline with the 16.6ms and 33.3ms budget
  lines drawn in; spikes/longtasks marked. (This is the money shot.)
- **Counters** — live N, connectors, rectangles; dropped frames; longtask count
  (`PerformanceObserver('longtask')`, already in the harness).
- **Vector split** — % of frames this phase that were structural (B) vs visual
  (A), so a "60fps" claim is always qualified by how hard the engine worked.
- **Phase + progress** and, in benchmark mode, the **composite score**.

**Composite score** (so it reads like a benchmark, not a graph dump): a single
integer, e.g. weighted blend of `N@60`, `N@30`, mean-fps-under-Storm, and
`1/longtask-total`, normalised against a committed reference run. Bigger = better.
Print it big on the Cooldown card. (Define the exact weights once and freeze them,
or the number isn't comparable across versions — same discipline as the baseline.)

---

## 7. Variety generator (every node differently styled)

The bonus ask: make sure the CSS/style/label/link paths are all exercised, not
just one cookie-cutter node ×N. Per-agent, PRNG-seeded, drawn from the real
schema fields (the Explore map confirms these all exist on `ModelItem` /
`ViewItem` / `Connector`):

- **Icon**: round-robin over a palette of procedurally-generated ~1.7KB SVGs
  (reuse `makeIconUrl`) so icon decode/markup cost is realistic and varied.
- **Label**: varied `labelColor`, `labelFontSize` (8–24), `labelHeight`,
  `showLabel` on/off, and a mix of short vs long names (truncation path).
- **Rich content**: ~20% get a `description` (rich-text `<p>`), ~12% `notes`,
  some get `headerLink` / `link` (the "link in label / caption" path), a few get
  HTML `<a>` inside the description so the in-label-link render path is hit.
- **Connectors**: mix `style` SOLID/DASHED/DOTTED, `lineType`
  SINGLE/DOUBLE/DOUBLE_WITH_CIRCLE, `showArrow`, varied `width`, ~⅓ with a
  `labels[]` entry (some with `showLine`, varied `fontSize`/`labelColor`), some
  with a link in the label text.
- **Grouping**: rectangles over blocks in varied palette colours; a few text
  boxes (careful — see the harness note: `createTextBox` derives `size`
  scene-side, so go through `createTextBox`, not a raw bulk set).

This guarantees the bench paints across the *whole* styling surface — exactly the
"every node can be stylized" challenge — instead of N identical cheap nodes that
would flatter the numbers.

---

## 8. Honesty / anti-cheat guardrails

Carry over the harness's discipline so the showcase number can't be quietly
gamed:

- **Fit-to-view** so all N are actually rendered (no off-screen culling inflating
  the wall) — *and* report a second number *with* T2 culling on, labelled, since
  culling is a legitimate engine feature.
- **Integer-tile crossings in the Storm** so collision/reroute is never
  short-circuited (the EMPTY-lane mistake the harness call out).
- **HUD on its own canvas, throttled** so the instrument doesn't move the needle.
- **Sim state out of the store** so reported ms is engine cost, not bench cost.
- **Deterministic seed** in benchmark mode; print seed + machine-calibration
  index on the score card so any run is reproducible and machine-comparable.
- Boot with `axoview-perf-harness=1` (no StrictMode double-render, no diagnostics
  loop) for the benchmark number; demo mode can run normally.

---

## 9. Where it lives & how it ships

- **Flag-gated, dev/showcase-only.** A hidden route/overlay behind e.g.
  `?bench=1` or a localStorage flag (`axoview-bench`), mirroring how
  `axoview-perf-harness` and the planned `PERF_CANVAS` flags work. Zero cost and
  zero surface when off; never in a production bundle path by default.
- **Shared generator module** `…/dev/benchScene.ts` consumed by both the
  Playwright harness and the in-app bench (§3).
- **Drives the public action API** (`useSceneActions`: create*, the immer-free
  `batchUpdateViewItemTiles`, `previewConnectorPaths`, `beginDragTransaction` /
  `commitDragTransaction`) — no private engine internals, so it stays correct as
  the engine evolves.
- **Doubles as the T2 visual proof.** Run it with the DOM connector layer vs the
  Canvas2D layer (the `PERF_CANVAS` flag) side by side — the bench is the
  eyeball-able A/B the T2 design says to verify visually, *and* the Storm phase is
  the most honest stress for the canvas path.

---

## 10. Build sequencing (if green-lit later — not now)

1. Extract `benchScene.ts` (generator + PRNG + icon maker) from the harness;
   point the harness at it (pure refactor, baseline must stay byte-identical).
2. `BenchConductor` rAF loop + Agents array + Phase 0/1 only (Ignition + Race),
   driving `batchUpdateViewItemTiles`. Prove the loop is ~free.
3. Canvas HUD (FPS + frame graph + counters), throttled.
4. Storm phase + `previewConnectorPaths` reroute under motion.
5. LoadController closed loop → `N@60` / `N@30`.
6. Variety generator full surface (§7) + Flow + Cooldown + score card.
7. Wire as the T2 DOM-vs-Canvas visual A/B.

Each step is independently demoable; (1)–(3) alone already give a usable "watch
nodes race while FPS ticks" showcase.

---

## Open questions (for sign-off, not for me to assume)

- **Headline metric**: is the composite score the deliverable, or just `N@60` /
  `N@30`? (Score is prettier; the two N's are more defensible.)
- **Determinism vs spectacle**: one mode that's both, or hard-split benchmark/demo
  builds? (Proposing split — comparable numbers and a good show have different
  tuning.)
- **Fractional tiles**: confirm the projection + connector routing tolerate
  non-integer `tile.x/y` for smooth slides (vector A). If routing snaps to ints,
  the Flow/Race smoothness comes from CSS-var motion instead — same look, slightly
  different plumbing.
- **Scope now**: this doc is the proposal; building waits on a go.

---

## Evaluation verdict (2026-06-15) — DEFER; not on the T2 PoC critical path

Evaluated against "is AxoBench necessary as the ultimate test before the T2 PoC?"
**No — deferred.** Reasoning:

- The T2 PoC's go/no-go is the **spawn settle/longest A/B** (node Canvas2D vs DOM,
  N=1000/2000). The committed Playwright harness (`engine-perf.spec.ts`) + the
  planned `PERF_CANVAS` flag already measure that rigorously (calibration-indexed,
  same-session, settle/longest). AxoBench adds nothing to that number.
- AxoBench's headline (`N@60`/`N@30` under the Storm) measures **LEB60** — *moving*
  entities. T2's PoC prize is **SSB** — *static* spawn paint. LEB60 validation comes
  *after* the node canvas exists, and even then a leaner multi-agent-motion harness
  extension would serve it; the full HUD/phase-machine/score-card/demo is showcase,
  not measurement.
- **Dependency inversion:** AxoBench is designed to be the *visual A/B of the
  Canvas2D layer* (§9). That layer doesn't exist yet — the PoC builds it. So AxoBench
  presupposes its own input. Build the canvas first, then AxoBench becomes the
  honest motion stress + showcase it's designed to be.
- Visual correctness for the PoC is already covered by `.scratch/verify-scene`.

**Revisit AxoBench post-T2**, when: (a) the node Canvas2D layer + `PERF_CANVAS` flag
exist (so the Storm phase has a DOM-vs-Canvas A/B to run), and (b) LEB60 (moving-
entity capacity) becomes the active target. The one piece worth pulling early —
*opportunistically, not as a blocker* — is sequencing step 1: extracting
`buildScene`/`makeIconUrl`/`mulberry32` into a shared `dev/benchScene.ts` (baseline
must stay byte-identical), so harness and any future bench share one seeded scene.
Not required for the PoC.
