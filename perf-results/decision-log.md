# Engine perf — decision log

Running memory for the self-driving loop (charter KR6). One row per
hypothesis/iteration: what changed, the before/after, the noise-relative
verdict, keep/revert, and why. Newest at the bottom. The context window is
scratch — this file + `baseline.md` are ground truth.

Status legend: 🟢 GREEN (kept) · 🔁 reverted · 🟡 milestone · 🔴 escalate · 🛠 infra.

---

## PHASE 0 — harness + noise floor + baseline (SUPERVISED preconditions)

The charter's three Preconditions for Autonomy are done supervised, then I STOP
for human sign-off before any hands-off looping:
1. harness built + p95 noise band < 10% proven;
2. idle-churn bug fixed + clean noise floor re-proven;
3. correctness suite airtight.

### Iter 0 — 🛠 build the harness (KR1 scaffold)

- **What:** Built `packages/axoview-e2e/perf/{perf.config.ts,engine-perf.spec.ts}`
  + root `npm run perf`. Drives the REAL app in REAL Chromium. Two scenarios
  parameterised by N: **spawn** (commit N nodes in one store write — models
  paste/import) and **drag** (drag one node through an empty tile lane while
  N−1 render). All input + frame capture runs in-page (one `page.evaluate` per
  run) so no Node↔CDP latency sits between an input event and its frame. Frame
  time = rAF delta; long tasks via `PerformanceObserver('longtask')`.
  Median-of-≥7, first run discarded as warm-up. Build gotcha baked into the
  config webServer (`build:lib && dev`, fresh server by default).
- **Validation that the harness measures REAL work (not a no-op):** both metrics
  scale with N as production telemetry predicts —
  - spawn longest frame: ~233 ms (N≤100) → **~1.1–1.3 s (N≥200)** — the
    multi-second paste freeze.
  - drag p95: 16.7 ms (N≤50) → **33–34 ms (N≥200)** — per-frame re-render cost
    climbs above the 16.6 ms budget.
- **Provisional baseline (NOT certified):** see `baseline.md` (run
  2026-06-15T03:30Z).
- **Verdict:** 🔴 **KR1 NOT yet met.** Noise band fails badly — worst **100%**,
  many cells 50–98% (KR1 requires < 10%). Drag at low N is excellent (0.6%),
  proving the input/capture path is stable; the variance concentrates in (a)
  spawn longest-frame and (b) mid/high-N drag p95. Suspected drivers, in order:
  1. **React.StrictMode** is ON in dev (`axoview-app/src/index.tsx`) → every
     component double-renders. Production has it off. Inflates cost AND adds
     scheduling nondeterminism. Unrepresentative + noisy.
  2. **GC pauses** — no forced GC between runs; heap churn (the charter's
     idle-churn leak) injects random multi-100 ms stalls into longest-frame.
  3. **Variable settle tail** — spawn uses a fixed 2 s window; at N≥200 the
     freeze may not settle within it, and idle-tail length varies run-to-run.
### Iter 0a–0g — 🛠 stabilise the harness to the noise floor (KR1) + fix idle churn (KR3)

Worked the noise down from 100% to < 10% (load-bearing). One change at a time:

- **0a — expose+force GC** (`--js-flags=--expose-gc`, GC between runs + before
  capture) and **deterministic spawn settle** (capture commit→K idle frames,
  not a fixed 2 s window). Spawn noise still ~50–90% → GC wasn't the driver.
- **0b — neutralise StrictMode** (gate behind a pre-boot flag; production already
  single-renders). Halved absolute spawn cost (representative) but noise
  unchanged → not the driver.
- **0c — 🎯 disable the DiagnosticsOverlay loop (the idle-churn bug, KR3).**
  `axoview-app` runs `DiagnosticsOverlay` **always-on in dev**
  (`diagnosticsStore.readEnabled` returns `true` unconditionally in dev), driving
  a permanent rAF loop that every 1 s reads the stores, runs 9 detectors, and
  calls `setLatest()` — a **1 Hz React re-render forever**. THIS is the charter's
  "long-tasks accrue / heap climbs at zero nodes" idle churn. Gated it behind the
  same pre-boot perf flag (`axoview-perf-harness`, also skips StrictMode).
  **Effect:** drag noise collapsed (N=100 drag 98.8% → 0.6%). Confirmed driver.
- **0d — continuous metrics + CoV.** Frame-time percentiles are **vsync-
  quantized** (deltas snap to ~16.7 ms) → percentiles near a bucket boundary flip
  bimodally and look "noisy" when work is stable. Switched the headline to
  **continuous** metrics — spawn → settle time, drag → mean frame time — and the
  noise band to **coefficient of variation** (the actual run-to-run variance KR1
  asks for; `(max−min)/median` is range, not variance). Plus a global + per-cell
  V8 warm-up (the render hot path tiers up after ~hundreds of invocations;
  un-warmed runs sit in a slower regime → bimodal).
- **0e — tried disabling vsync** (`--disable-gpu-vsync` etc.) for sub-frame
  timing: headless Chromium keeps a 60 Hz virtual display regardless, and the
  throttling-disable flags only ADDED variance. **Reverted.**
- **0f — 🔬 MAJOR FIDELITY FINDING: the engine already viewport-culls.**
  `Renderer.tsx:131` (`visibleItems = items.filter(tile ∈ coarseBounds)`) renders
  only nodes whose tile is in the viewport. My off-screen grid was measuring the
  CULL, not the cost — node-labels capped at ~306 for any N≥~306 (verified: stays
  306 after a 2 s wait, so genuine culling, not measurement truncation). So
  **render cost scales with VISIBLE entities, not total N** — and production's
  collapse happened with that many nodes *visible* (zoomed to fit). The charter's
  "T2 viewport culling" unlock **partially exists already** (coarse tile-bounds).
  **Fix:** `fitForGrid()` sets zoom+scroll so all N are on-screen before
  measuring (N = visible entity count, the regime SSB/LEB60 measure). Anti-cheat:
  assert `rendered === N` after each spawn. Now scaling is monotonic and real.
- **0g — final certified run.** See `baseline.md` (2026-06-15T04:52Z).

**Outcome — preconditions #1 and #2 MET (supervised):**
- **KR1 CERTIFIED** (load-bearing): worst noise band **5.5%** across all drag +
  spawn N≥100; all-cells worst **6.5%**. (Small-N spawn ≤50 flutters 0–16%
  run-to-run — sub-100 ms operations at the vsync quantization floor, not a
  target; the app is already smooth there.)
- **KR3 PASS** — 60 s idle @0 nodes: heap **82.4→82.4 MB, 0 retained, 0 long
  tasks**. The idle churn was the dev-only overlay loop; the engine idle floor is
  clean. (Production never runs the overlay by default, so this is also a real
  dev-tool fix, not just a measurement convenience.)

**KR2 baseline (trustworthy, N = visible entities):**

| N | spawn longest frame | spawn settle | drag p95 | drag mean |
|---|---|---|---|---|
| 25 | 50 ms | 133 ms | 16.7 | 16.7 |
| 50 | 50 ms | 167 ms | 16.7 | 16.7 |
| 100 | 75 ms | 225 ms | 16.7 | 16.7 |
| 200 | 142 ms | 333 ms | 16.8 | 16.7 |
| 500 | 317 ms | 683 ms | 16.8 | 17.2 |
| 1000 | 633 ms | 1208 ms | 17.6 | 18.1 |

**The binding bottleneck (from the baseline): initial/bulk RENDER (spawn).**
Spawn longest frame grows ~linearly with visible N — 1000 visible nodes = a
633 ms freeze (≈38× the 16.6 ms budget); settle 1.2 s. **Drag, by contrast, is
already ~60 fps even at 1000 visible** — the MQA #7 CSS-variable transform path
makes a live drag compositor-only (no per-frame React reconcile of the scene).
So T1/T2 work should target the mount/reconcile/paint cost of making N entities
*appear* (bulk paste, view switch, zoom-to-fit), NOT the drag path.

### Iter 0h — ✅ precondition #3: correctness suite green (KR5)

Ran the charter's invariant subset against the current `dist`
(`--project=chromium`), all 9 GREEN (~1.5 min):
- collision/occupancy — `drag-collision`
- undo/redo — `undo-redo-cross-cutting`, `undo-redo-dual-stack`
- selection + multi-drag — `multi-select-drag` (Ctrl+A drag preserves relative
  positions; waypoint-follows), `multi-select-drag-lasso`
- z-order — `z-order`, `rectangle-overlap-zorder`
- dragged-node visual-position parity — `css-preview-mid-drag` (model tile
  unchanged mid-drag while `[data-drag-id]` carries `--ff-drag`)

These nine are the standing anti-cheat gate for the optimization loop; the wider
`packages/axoview-e2e/tests/` suite remains available for fuller regression.

## LOOP — T1 "stop the bleeding" (GREEN, self-paced)

Human signed off on the 3 preconditions (KR1 load-bearing accepted). Bottleneck
from the baseline + trace = **bulk/initial RENDER** (spawn); the freeze is ~all
JS (FunctionCall 3203 ms), and within JS the **MUI `sx`/emotion pipeline**
dominates (`styleFunctionSx` 199, `getThemeValue` 140, `extendSxProp` 106,
emotion serialize/`murmur2` ~180, `deepmerge` 66 — see `cpuprofile-spawn-1000.md`).

### Iter 1 — 🔁 REVERTED: static per-node wrappers `<Box sx>` → `styled()`

- **Hypothesis:** the two always-rendered NodeContent wrappers (outer flex Box,
  icon Box) re-run `styleFunctionSx`/emotion per node; compiling them once via
  `styled('div')` (cached class) cuts spawn frame time.
- **Variable:** styling mechanism of those two wrappers only (visually identical).
- **Result (full N set vs baseline):** spawn N=1000 settle 1258 ms vs 1208 ms;
  longest 633 vs 633; N=500 692 vs 683. **Within noise (the stable N=1000 cell
  at 2.2% CoV shows no gain).** → reverted per LOOP step 4.
- **Why it didn't move:** the two wrappers are ~2 of ~6 sx-bearing elements per
  node; the **label subtree** (`<Typography fontWeight fontSize color='text.primary'>`
  → `getThemeValue`; `<Stack spacing={1}>`; `ExpandableLabel`→`Label`) is the bulk
  of the per-node emotion work, and `styled` components still pay a small
  per-render cost. Initial mount (spawn) can't be memoized away — each node's
  first render must get cheaper.

### Iter 1b — 🔬 confirmed the label subtree IS the bottleneck (≈71%, ~3× ceiling)

Added a gated diagnostic (`PERF_NOLABEL=1` → view items get `showLabel:false`)
to isolate the label cost. Spawn N=1000:

| | longest frame | settle |
|---|---|---|
| labels ON (baseline) | 633 ms | 1208 ms |
| labels OFF | **183 ms** | **433 ms** |

So the per-node **label subtree** (MUI `Typography` + `Stack` + `ExpandableLabel`
→ `Label`) is **~450 ms of the 633 ms longest frame (71%)** and ~775 ms of the
settle. `rendered=1000/1000` both ways (icons still render). This bounds the
T1 win at ~3× and pins the target precisely.

### Iter 2a — 🟢 GREEN (KEPT): drop the per-node `scrollTo({top:0})` on mount

First incremental sub-part of Iter 2 (the "ExpandableLabel per-node useEffects"
target). Trace-driven: the spawn CPU profile's single largest addressable slice
was **`scrollTo` 364 ms** (cpuprofile-spawn-1000.md), and the only DOM `scrollTo`
in the render path is `ExpandableLabel`'s scroll-reset `useEffect` (keyed on
`effectiveExpanded`, which is `false` at mount) — so it fires once per node on
spawn. On a freshly-mounted element already at `scrollTop 0` the call is a
behavioural no-op, but synchronously it forces a per-node scroll/layout → 1000
forced reflows interleaved through the spawn.

- **Hypothesis:** guard the effect to fire only on an actual expand/collapse
  *transition* (skip the initial mount). Predict spawn settle/longest drop
  materially at N≥200, well above noise; zero visual change.
- **Variable:** one `useRef` guard that skips the effect's first run. Nothing
  else (visually + behaviourally identical for every real transition).
- **Result (full N set, this run vs certified baseline):**

  | N | settle before→after | Δ | longest before→after | Δ | new noise (CoV) |
  |---|---|---|---|---|---|
  | 200 | 333→200 ms | −40% | 142→67 ms | −53% | 4.2% |
  | 500 | 683→383 ms | −44% | 317→167 ms | −47% | 3.4% |
  | 1000 | **1208→600 ms** | **−50%** | **633→300 ms** | **−53%** | **0%** |

  Long-task total N=1000 2383→1145 ms. Drag unchanged (16.7 mean, as expected —
  drag never mounts labels). **Gain ≫ noise (N=1000 ≈608 ms vs a ~34 ms band; new
  CoV 0%, all 8 runs = 600 ms).** → KEEP.
- **Why ~608 ms, not the predicted ~364 ms:** the per-node `scrollTo` wasn't just
  function cost — each call forced a synchronous reflow during effect-flush.
  Removing it kills the layout-thrash cascade, not just the call. (Consistent with
  the labels-OFF floor of 183 ms longest @1000: we went 633→300, closing >half the
  gap to that floor; the residual ~117 ms longest is the MUI sx/emotion pipeline.)
- **Correctness gate:** 9/9 green (the 7 anti-cheat specs). Label specs `rename`
  + `readable-labels` 4/4 green.
- **Visual verify (real app, window.__axoview__ bridge, screenshots in run log):**
  labels render correctly (white rounded chip, bold title, connector stalk, right
  text); a truncated label expands (overflowY hidden→scroll, clientH 80→247) and
  collapses (→hidden, scrollTop 0); initial-mount scrollTop=0 (skip is a no-op).
  Probe: a real *mouse* click on the tiny absolutely-positioned ExpandButton is
  intercepted by the Gradient overlay (pre-existing hit-test quirk, unrelated).
- **Noise note:** this run's small-N spawn was noisier (N=50 14.3%, N=100 9.6% vs
  prior 6.5/5.5) — machine marginally less idle at the early cells. Load-bearing
  worst stays 9.6% < 10% (KR1 still certified); the keep decision rests on N≥200
  where the win is 40–50% at 0–4% noise, so unaffected. New `baseline.md` committed.

### Iter 2b — NEXT: lighten the per-node MUI label `sx`/emotion (GREEN, visuals preserved)

- **Hypothesis:** with the scrollTo reflow gone, the residual label cost is the
  per-node MUI `sx`/emotion pipeline (`styleFunctionSx` 199, `getThemeValue` 140,
  `extendSxProp` 106, emotion serialize/`murmur2` ~180, `deepmerge` 66). Replace
  the heavy components — `Typography fontWeight/fontSize/color='text.primary'`
  (→`getThemeValue`), `Stack spacing={1}`, and the `Label` content `Box` (theme
  lookups `common.white`/`grey.400`) — with lightweight `styled`/plain elements
  reproducing the same visuals. Implement incrementally (one element per
  iteration); keep each step's gain above noise. Target the residual ~117 ms
  longest / gap to the 183 ms labels-off floor @1000.
- **Risk:** visual regression — correctness suite asserts label *presence*, not
  pixels. Guard with `rename` + `readable-labels` specs AND the visual screenshot
  check (.scratch/verify-labels.mjs) before keeping each step.
- **Open alt (bigger, but a behaviour change → YELLOW, needs product nod):**
  label LOD — skip label rendering below a zoom/size threshold. At fit-to-1000
  the labels are sub-pixel and unreadable anyway, so this recovers ~the full 3×
  in the exact collapse scenario for ~free. Strong candidate after Iter 2b.

## ⏸ Earlier checkpoint — all 3 autonomy preconditions MET (signed off)

| Precondition | Status |
|---|---|
| #1 harness + noise band < 10% proven | ✅ KR1 certified (load-bearing 5.5%) |
| #2 idle-churn fixed + clean floor re-proven | ✅ KR3 pass (0 retained, 0 long tasks) |
| #3 correctness suite airtight | ✅ KR5 — 9/9 invariant specs green |

Per the charter (Autonomy & escalation), preconditions are done SUPERVISED and I
must STOP for sign-off BEFORE entering the GREEN-default self-paced loop. Holding
here. Open question for the human: accept KR1 as certified for the load-bearing
regime (small-N spawn ≤50 left at the vsync quantization floor, non-target), or
invest in microbenchmark-averaging to force ≤50 under 10% too?

First optimization hypothesis queued for after sign-off (from the baseline's
binding bottleneck = bulk RENDER, not drag): instrument a single spawn at N=1000
with the React render probe / a CDP trace to attribute the 633 ms freeze
(reconcile vs style/emotion vs layout vs paint), then target the largest slice
(likely per-node emotion `sx` styling or SVG/DOM paint) — T1 "stop the bleeding"
without a rewrite.
