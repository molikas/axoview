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

### Iter 2b — 🟢 GREEN (KEPT): `Stack spacing={1}` → plain flex `div` in the label

First `sx`-element sub-step of the residual-emotion target. With the scrollTo
reflow gone (2a), the residual label cost is the per-node MUI `sx`/emotion
pipeline (`styleFunctionSx` 199, `getThemeValue` 140, `extendSxProp` 106, emotion
serialize/`murmur2` ~180, `deepmerge` 66 — cpuprofile-spawn-1000.md).

- **Hypothesis:** the label's `<Stack spacing={1}>` runs MUI styled/sx per node;
  replacing it with a module-level `<div style={{display:flex,flexDirection:
  column,gap:8}}>` (8px = `theme.spacing(1)`) reproduces the exact layout (8px
  between title and optional description; no-op for the single-child name-only
  case) with zero emotion work. Predict a small per-node saving that scales with N.
- **Variable:** the label's row-stack element only (Node.tsx). Visually identical.
- **Result (full N set, vs the 2a baseline):**

  | N | settle 2a→2b | longest 2a→2b | 2b noise |
  |---|---|---|---|
  | 100 | 158→150 ms | 50→33 ms (−33%) | 4.0% |
  | 200 | 200→208 ms (within noise) | 67→67 ms | 4.3% |
  | 500 | 383→350 ms (−8.7%) | 167→142 ms (−15%) | 4.0% |
  | 1000 | 600→567 ms (−5.6%) | 300→267 ms (−11%) | 1.9% |

  **KEEP.** Modest but real: the longest-frame (commit) reduction *scales with N*
  (−16/−25/−33 ms at 100/500/1000) — the signature of a fixed per-node cost
  removed, not between-run drift — and at N=500/1000 it clears the noise band
  (~2–3×). N=200 wobbled up within its 4.3% band (no regression). Drag unchanged.
- **Correctness:** gate 9/9 + `rename`/`readable-labels` 4/4 green (13/13 total).
  **Visual verify** (.scratch/verify-labels.mjs): label layout pixel-identical
  (collapsed clamp 80, expand→scroll, collapse→top; screenful unchanged).
- **Noise note:** small-N spawn noisy this run (N=25/50 18–18.6%) — machine less
  idle at the early cells. Load-bearing worst 4.3% < 10% (KR1 certified; better
  than 2a's 9.6%). New `baseline.md` committed.

### Iter 2c — 🔁 REVERTED: `Typography` title → `styled('p')` (within noise on settle)

- **Hypothesis:** the display-mode `Typography fontWeight={600} fontSize={14}
  color='text.primary'` re-runs the MUI sx pipeline + a `getThemeValue('text.
  primary')` per node; a module-level `styled('p')` baking `theme.typography.body1`
  + those overrides into one cached emotion class (per-node `labelFontSize`/
  `labelColor` via inline style) should cut per-node cost with identical visuals.
- **Variable:** the display-mode title element only (editing-mode `Typography` left
  as-is — single-node, not the spawn hot path).
- **Result (full N set, vs 2b baseline):**

  | N | settle 2b→2c | longest 2b→2c | 2c noise |
  |---|---|---|---|
  | 200 | 208→200 ms | 67→67 ms | 0% |
  | 500 | 350→342 ms (−2.4%) | 142→133 ms | 3.6% |
  | 1000 | **567→567 ms (0%)** | 267→250 ms | 4.4% |

  **REVERT.** The headline (settle) is **flat at N=1000 (566.6→566.6)** and
  within-noise at N=500. The only movement is longest-frame 267→250, but that is
  **exactly one vsync bucket (16.65 ms)** — the bimodal quantization flutter the
  headline was switched away from in 0d. Inside the noise band on the robust metric
  → revert per LOOP step 4. Reverted code + restored the 2b `baseline.md`.
- **Correctness/visual (pre-revert, for the record):** gate 13/13 green; computed
  style matched body1 exactly (14px/600/lh19.6/text.primary/margin0/block;
  `letterSpacing:normal` — this theme's body1 sets none, so `Typography` rendered
  the same); expanded content `scrollH=249` identical across the 2a/2b/2c builds
  (metric-faithful). So the swap was *correct*, just not *worth it*.
- **🔬 Finding (redirects the loop):** the title's per-node `Typography` sx cost
  lands in the **commit frame** (longest), not the **settle** total — so the spawn
  *settle* floor (≈567 ms @1000) is dominated by something the title styling does
  NOT touch: the post-commit **layout/paint tail** + the two per-node label
  `useEffect`s (a `ResizeObserver` per node for truncation; a `storeApi.subscribe`
  per node for readable-labels counter-scale) + the remaining sx. **Grinding
  individual label `sx` elements past the Stack has hit diminishing returns on the
  headline.** This is sub-noise hypothesis #1 (charter: 3 consecutive ⇒ local
  minimum RED).

### Iter 2d — 🔁 REVERTED: label DOM flatten (−2 wrapper nodes) — within noise (same-session A/B)

Direction (from the 2c finding): stop per-element sx, reduce DOM-node COUNT (the
layout/paint tail). Flattened the node-only wrapper chain: folded the `node-label`
`Box` into ExpandableLabel's outer element (test id + dbl-click moved there) and
absorbed the per-node flex-stack `<div>` into ExpandableLabel's scroll-content Box
(now the flex column). −2 DOM nodes/label, node-only (shared `Label`/`ConnectorLabel`
untouched), visuals + behaviour identical (gate 13/13; screenshot + title computed
style + content `scrollH` all unchanged).

- **Apparent result (vs committed 2b baseline):** spawn N=1000 settle 567→433
  (−24%), longest 267→200; consistent ~24% across N=200/500/1000. Looked like a
  major win.
- **🔬 THE FINDING — it was machine drift, not the change.** The magnitude (landing
  exactly on the old labels-off floor) was suspicious, so I ran a **same-session
  A/B control**: stashed the flatten and re-measured the **committed 2b code in the
  same session**. Result @1000:

  | build (same session, ~15 min apart) | settle | longest |
  |---|---|---|
  | 2b code (control) | **441.6 ms** | 199.9 |
  | 2d code (flatten) | **433.4 ms** | 199.9 |
  | 2b baseline (committed, *earlier* session) | 567 ms | 267 |

  Same-session, 2b-code (441.6) ≈ 2d-code (433.4) — ~2%, **within the 2.8% noise
  band**, longest frames identical. **The flatten does ~nothing.** The 567→433 was
  **cross-session drift**: the machine is ~22% faster this session than when the 2b
  baseline was recorded. → **REVERT** (within noise per LOOP step 4). 2d code stashed
  (`stash@{0}`, recoverable as a pure cleanup; it IS a valid −2-node simplification).

- **⚠️ METHODOLOGY DEFECT (load-bearing — invalidates cross-session comparisons):**
  cross-session/run drift here is **~22%** (same 2b code: 567 earlier vs 441.6 now),
  while within-run CoV is **~2%**. KR1 certified the *within-run* noise band (<10%)
  but that does **NOT** bound cross-session drift. **Every iteration so far compared
  a fresh run against a prior-session committed baseline → those deltas are reliable
  only to ~±22%.** Re-reads of past iterations under this lens:
  - **2a** (scrollTo reflow, −50% cross-session): mechanism (eliminating 1000 forced
    synchronous reflows) is real and the magnitude exceeds drift → **win is real**,
    though exact size is uncertain.
  - **2b** (Stack→div, −5.6% cross-session): **well inside the ~22% drift band →
    SUSPECT / probable false-positive.** Kept on drift, not signal.
  - **2c** (reverted, flat): conclusion still correct (flat survives drift either way).
  - **2d**: reverted (same-session control).
- **FIX (required before any further keep/revert):** decisions must be **same-session
  A/B** — measure baseline-code and changed-code back-to-back in one machine state
  (stash/rebuild between, or a harness mode that renders both). Comparing to the
  stale committed baseline is invalid. Cheaper variant: at session start, re-measure
  the committed code in *this* session and compare iterations against that
  session-local baseline.

### Iter 2e — NEXT: STOP / escalate (RED-adjacent) — methodology + diminishing returns

- **Why stop:** (1) the cross-session drift defect above means the loop cannot make
  valid keep/revert calls without a methodology fix; (2) two consecutive properly-
  controlled hypotheses (2c, 2d) are within noise — the label subtree resists cheap
  T1 optimization beyond 2a; (3) 2b is suspect and may warrant reverting.
- **Inputs read — `bloat-analysis.txt`** (node-render analysis on master by another
  agent). Corroborates the DOM-volume thesis (~14 elements/node; label subtree =
  8 of them; the 2 wrapper Boxes I flattened in 2d ARE the "empty `css-0` ×2"
  overhead — but only ~14% of the subtree, so removing them was within noise, as
  measured). Surfaces **two NODE-level levers the label grind missed:**
  1. **Repeated inline icon** — every node embeds the *same* ~2.1 KB base64 SVG
     (~230 KB across ~110 nodes), the single biggest weight; it's **per-node, in
     the icon floor**, not per-label. Fix: shared `<use>` sprite / one cached
     `<img src>` (browser dedupes decode) / CSS background.
  2. **`willChange:'transform'` unconditional** (INNER_SX, Node.tsx) → ~N permanent
     compositor layers at idle. Make transient (set on drag-start, clear on
     drag-end); measure layer count + spawn compositor (`PaintArtifactCompositor`).
  - **⚠️ Harness-fidelity gap this exposes:** the perf harness's `PERF_ICON` is a
    trivial ~100-byte `<rect>`, so the harness **does not measure the ~2.1 KB-base64
    icon cost** — the real app's spawn is heavier than the baseline shows, and
    icon-dedup is a real-world win the harness can't currently validate. Fix the
    harness to use a representative icon before chasing the icon lever.
  - Do-not-touch (per the analysis): inline `--ff-x/--ff-y`/z-index, the Node/
    NodeContent split, OUTER_SX/INNER_SX constants, `data-drag-id`, the shared
    emotion hash classes.
- **Open levers (all need a decision):** (a) fix methodology + re-validate 2a/2b
  same-session, then resume; (b) **icon-dedup** + **transient willChange** — node-
  level, hit the icon floor (433) that labels now sit on, but need the harness icon
  fixed first (fidelity); (c) label LOD below a *world-view* zoom threshold
  (≈<20–25%, beneath the 30–50% working range so it never conflicts with readable-
  labels) — the user wants this as BACKUP, preferring to optimize labels rather than
  hide them; (d) accept 2a as the T1 win and escalate to T2 (Canvas2D render — RED).

## 🛠 Harness v2 — realistic scene + drift methodology (resolves the 2e escalation, option #1)

Human chose option #1: fix measurement + build a realistic case before grinding
further. Done (`engine-perf.spec.ts`):

- **Realistic scene** (`buildScene`): per N → N nodes (5 representative ~1.7 KB
  icons round-robin, varied label colours, ~20% with a description, ~12% with
  notes) + ~N connectors (right-neighbour edges, ⅓ labelled, palette colours) +
  grouping rectangles (~5×5 blocks). Spawn commits the whole scene in one
  `model.set` (paste / import / diagram-open). Anti-cheat upgraded: `rendered=N/N`
  validated AND scene composition (conn/rect counts) logged per cell.
- **Representative icon** replaces the trivial 100-byte `<rect>` (fixes the
  bloat-analysis fidelity gap — real icons are ~2 KB base64).
- **Collision-during-drag**: drag now drags a *connected* in-grid node through
  *occupied* tiles → per-frame collision checks + connector re-route (old harness
  dragged one unconnected node through an empty lane).
- **Calibration index** (fixed CPU workload) printed + in `baseline.md`; cross-
  session drift was ~22% so absolute numbers compare only between similar-index
  runs. **Keep/revert is now mandated same-session A/B** (re-measure the reference
  build in the same session), never vs a prior-session baseline.
- **Text boxes excluded** (documented): their `size` is derived scene-side by the
  `createTextBox` reducer (`getTextBoxDimensions`); a bulk `model.set` bypasses it
  → renderer crashes on undefined `size.height`. Negligible bulk-render weight.

**New baseline** (`baseline.md`, realistic scene, calibration 3.2 ms; rendered=N/N
all cells):

| N | spawn longest | spawn settle | drag mean | scene |
|---|---|---|---|---|
| 200 | 83 ms | 167 ms | 16.7 | conn=186 rect=9 |
| 500 | 167 ms | 250 ms | **30.2** | conn=478 rect=25 |
| 1000 | 317 ms | 400 ms | 16.9 (see caveat) | conn=968 rect=49 |

**Findings from the realistic baseline:**
- **Spawn stays node-dominated** — ~968 connectors + 49 rectangles barely shift
  settle vs nodes-only (≈400 here vs the ≈441 same-session simple-scene 2b control).
  Connectors/rectangles are cheap; the grind target remains the **node subtree**
  (labels/icons/emotion) and the node-level levers (icon dedup, willChange).
- **Collision-drag is NOT free**: N=500 drag = **30 ms/frame (~33 fps, 2× over the
  16.6 ms budget)**, settle 2416 ms — the old empty-lane unconnected drag (flat
  16.7 ms) hid this. Per-frame collision check + connector re-route + render of the
  visible scene is the cost. This is a NEW, real drag finding the realistic harness
  surfaced.
- **⚠️ Drag caveat (provisional cell):** N=1000 drag reads 16.9 ms (idle-like;
  settle≈idle 1349, all frames 16.9) — *faster* than N=500's 30 ms, which is
  inverted. The grab silently **failed to engage at the extreme fit-zoom** (the
  pointer→tile coord from `tileToClient` misses the node). So the high-N collision-
  drag cells are unreliable until the grab is made robust (e.g., engage via the
  rendered node's DOM rect, and assert the drag mode actually activated). Spawn
  cells are unaffected (rendered=N/N).

**Next:** decide grind direction on the SOLID spawn baseline (node-level: icon
dedup / transient willChange / further label render) — and fix the collision-drag
engagement so its high-N cells become trustworthy. Keep/revert from here = same-
session A/B.

## 🔬 Re-validation of 2a & 2b — same-session A/B on the realistic scene (N=1000)

Three variants measured back-to-back this session (the calibration index caught
~9% intra-session warm-up drift: 3.4 → 3.2 → 3.1 across the runs — even sequential
"same-session" runs drift, so the index is load-bearing for attribution):

| variant | settle | calibration | normalized (settle/cal) |
|---|---|---|---|
| A — 2a + 2b (HEAD) | 400.0 ms | 3.4 | 117.6 |
| B — 2a, **no 2b** (Stack restored) | 425.0 ms | 3.2 | 132.8 |
| C — **no 2a**, 2b (unguarded scrollTo) | 399.95 ms | 3.1 | 129.0 |

- **2b (Stack→div) — REAL (keep).** B is *slower* than A (425 vs 400) despite a
  *faster* machine (cal 3.2 < 3.4) → the effect overcomes the drift direction.
  ~−6% raw, ~−11% calibration-normalized. **My earlier "suspect false-positive"
  call (decision-log, drift section) was WRONG** — the realistic same-session A/B
  confirms 2b is a genuine ~−6% win.
- **2a (scrollTo-on-mount guard) — REAL but SMALL / borderline (keep).** A≈C raw
  (400≈400), but C ran on the fastest machine (cal 3.1) and only *matched* A →
  normalized ~−9% in A's favour. The original **−50% was cross-session drift**
  (simple-scene, never validated same-session) + likely a simple-scene-specific
  layout-thrash that the realistic scene doesn't reproduce. On the realistic scene
  2a's benefit is modest. Kept regardless: it is a *correct* change (skipping a
  freshly-mounted element's scrollTo({top:0}) is a behavioural no-op).
- **Outcome: both kept, no reverts; magnitudes corrected.** 2a is NOT the giant it
  appeared (drift); 2b is genuinely real.

**⚠️ Methodology nuance (compounds the drift defect):** even SEQUENTIAL same-session
runs carry ~9% warm-up drift (cold machine slower). Effect sizes here (~6–11%) are
*comparable to* that drift → small T1 label/node micro-opts sit near the
measurement floor. For trustworthy small-effect attribution: **interleave** variants
(A,B,A,B…) or normalise by the calibration index; and run a throwaway warm-up first.
Big/architectural effects (T2) would clear the floor easily; sub-drift micro-opts
will be hard to prove either way — a signal about T1's remaining headroom.

## 🟢 Iter 3 — KEPT (big T1 win): wholesale de-emotion of the node subtree

Per the "one big T1 attempt, then decide" decision. Convert every ALWAYS-rendered
node-subtree `<Box sx={...}>` to a module-level `styled()` component (CSS resolved
ONCE into a cached class), eliminating the per-instance MUI sx pipeline. Converted
across Node.tsx, Label.tsx, ExpandableLabel.tsx: node shell, transform wrapper,
flex-centre wrapper, icon wrapper, notes badge, label title (body1 baked), label
stack, Label outer + chip (sx passthrough preserved for ConnectorLabel),
ExpandableLabel counterScale (→ plain div) + scroll-content (→ styled, scrollbar-hide
baked). Dynamic bits (--ff-* vars, cursor, label colour/size, width, maxHeight,
transform, pb) stay inline. Rare paths left as-is (hasLink badge, editing Typography,
Gradient, ExpandButton).

- **Key insight PROVEN:** even a MODULE-LEVEL `sx` constant (`<Box sx={OUTER_SX}>`)
  re-runs the per-instance emotion pipeline (extendSxProp / styleFunctionSx /
  murmur2) EVERY render — emotion caches the serialized output by hash, not the
  *processing*. `styled()` resolves once; per-instance is just a className apply.
  (bloat-analysis's "emotion classes are cached, don't consolidate" was right about
  stylesheet SIZE but missed this per-instance PROCESSING cost — ~403 ms @N=1000.)
- **Same-session interleaved A/B (T-H-T, N=1000, drift-controlled):**

  | run | build | settle | longest | cal |
  |---|---|---|---|---|
  | T1 | de-emotion | 283.4 | 200 | 3.2 |
  | H1 | HEAD (Box) | 400.0 | 317 | 3.1 |
  | T2 | de-emotion | 283.3 | 200 | 3.2 |

  T1≈T2 bracket H1; H1 even ran on a *faster* machine (cal 3.1) yet was slower.
  Effect ~117 ms ≈ **6× the ~9% drift floor. Unambiguous.**
- **Full baseline (de-emotion, cal 3.3 ≈ HEAD's 3.4 → directly comparable; new
  `baseline.md`):**

  | N | settle HEAD→deE | longest HEAD→deE |
  |---|---|---|
  | 200 | 167→133 (−20%) | 83→50 (−40%) |
  | 500 | 250→183 (−27%) | 167→100 (−40%) |
  | 1000 | 400→283 (−29%) | 317→200 (−37%) |

  Consistent ~20–29% settle / ~37–40% longest across N. rendered=N/N; KR3 PASS
  (idle heap 77.6 MB flat — *lower* than before, fewer emotion artifacts); KR1
  certified (load-bearing worst 6.4%). Correctness 13/13 green; title computed
  style + chip + full scene pixel-identical.
- **Verdict: KEEP. T1 is NOT exhausted** — per-instance emotion across ~10 elements
  × N nodes was the real lever. Spawn N=1000 is now **283 ms settle / 200 ms
  longest** (from the PHASE-0-era 633 ms longest). Drag unchanged (render-only); the
  N=1000 collision-drag cell stays the provisional failed-grab (separate fix).
- **Next (same-session A/B from here):** icon-dedup + transient willChange
  (node-level, bloat-analysis); fix the collision-drag grab engagement; or measure
  the new gap to the labels-off floor to see if more T1 remains before T2.

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
without a rewrite. [SUPERSEDED — see the resume point below.]

## 🔁 Iter 4 — REVERTED: de-emotion the icon subtree (NonIsometricIcon) — within noise + the attribution that kills the spawn-JS levers

Resuming T1 from the queued "label DOM-flatten + cheaper effects" step. Two
controlled experiments this session, both decisive — and both say the same thing:
**the post-Iter-3 spawn residual is DOM-volume / layout / paint bound, NOT
JS-processing (emotion or per-node effects) bound.**

**(a) Attribution probe — the two per-node label effects cost ~0 on spawn.** The
resume point pinned the residual label cost (~108 ms settle @1000 = full 283 −
labels-off floor 175) on "DOM volume + the two per-node effects" (a `ResizeObserver`
per node for truncation; a `storeApi.subscribe` per node for the readable-labels
counter-scale). I gutted BOTH effects in ExpandableLabel (throwaway build) and
measured same-session, **same calibration (3.2 = 3.2, no drift confound)**:

  | variant (N=1000) | settle | longest |
  |---|---|---|
  | A — HEAD (full effects) | 283.3 | 200 |
  | D — both per-node effects gutted | 283.3 | 199.9 |

  **A ≡ D.** The two effects contribute nothing measurable to spawn. (Mechanism:
  the RO's initial callback + the subscription `apply()` either land off the
  measured settle critical path or React batches them sub-noise.) → the "cheaper
  effects" lever is **dead** for spawn. Also note the shared-RO refactor is
  *separately* blocked: the H-2 `useResizeObserver.lifecycle` regression test pins
  a per-hook observer-instance model (counts `new ResizeObserver` per mount, calls
  `disconnect()` not `unobserve`), so a shared singleton would break a protected
  test — and it now demonstrably wouldn't help anyway.

**(b) Hypothesis (reverted) — de-emotion NonIsometricIcon.** Iter 3's wholesale
de-emotion swept Node/Label/ExpandableLabel but **missed the icon subtree**
(`IconTypes/NonIsometricIcon.tsx`, a different dir). Under ISOMETRIC canvas mode
every node's icon is **three nested `<Box sx={...}>`** — the exact per-instance MUI
sx pipeline (extendSxProp / styleFunctionSx / murmur2) Iter 3 removed elsewhere,
and it renders even with labels OFF (so it sits in the 175 ms floor). Converted the
3 boxes → 2 module-level `styled()` (the iso transform `getIsoProjectionCss()` is a
constant string; left/top/transformOrigin/pointerEvents constants → baked into
cached classes) + plain `<img>` leaves (their only style was the dynamic width →
inline). Visually identical; lib builds clean.

- **Variable:** styling mechanism of NonIsometricIcon's boxes only.
- **Result (same-session, cal 3.3 ≈ HEAD's 3.2):**

  | N | settle HEAD→deE | longest HEAD→deE |
  |---|---|---|
  | 500 | 199.9→199.9 | 116.7→116.6 |
  | 1000 | **283.3→283.3** | 200→200 |

  **Bit-identical** (settle 283.3 reproduced across HEAD ×3 this session + the
  treatment). Idle heap unchanged (77.6 MB). **→ REVERT** (within noise, LOOP
  step 4). Reverted to HEAD; lib rebuilt. (Recoverable as a pure consistency
  cleanup that completes Iter 3's sweep, like the 2d flatten — but it moves
  nothing on this harness, so not kept.)

**🔬 THE FINDING (redirects the loop — spawn-JS T1 is exhausted):** Iter 3
(de-emotion) was a 6×-drift win because per-instance emotion *processing* was a
large, real slice. Post-Iter-3, removing the icon's emotion (b) AND the two
per-node effects (a) each moves the needle by **zero** — because what's left of the
283 ms settle is the cost of **reconciling + laying out + painting ~14 DOM
elements × 1000 nodes** (+ connectors + rects), not JS the profiler can shave.
Corroborated three ways now: 2c (Typography styled, sub-noise), 2d (DOM-flatten −2
nodes, sub-noise), Iter 4a/4b (effects + icon emotion, sub-noise). **The only
spawn levers left are (i) cut DOM-node COUNT per node *a lot* — but 2d showed even
−2/node is sub-noise and the user wants to keep labels; or (ii) T2 render rewrite
(Canvas2D — RED).** Grinding spawn JS further is a local minimum.

**→ Decision: pivot off spawn to the DRAG / collision path** (the realistic-harness
finding the spawn grind never touched): collision-drag N=500 = **30 ms/frame
(~33 fps, 2× over budget)** — a REAL, unaddressed bottleneck on the LEB60 north-star
path (moving + collision-checked entities), unlike spawn (a one-time paste cost).
Prereq: fix the high-N grab engagement (item 4) so those cells are trustworthy,
then profile the 30 ms frame (collision check vs connector re-route vs render) and
optimize the largest slice. This is fresh T1 headroom, not a 3rd consecutive
spawn micro-opt.

## 🛠 + 🔬 Iter 5 — drag/collision path: robust grab (kept) + profiling finding (the drag re-renders React per frame)

Pivot target from Iter 4. Two parts: a harness-fidelity fix (committed) and a
trace-driven finding that names the next optimization.

**(a) 🛠 Robust collision-drag grab (committed `73c1d77`, harness-only).** The old
grab pressed `perf-0` (top-left) at a `tileToClient`-projected point. At the extreme
fit-zoom for large N the corner node sits at/past the viewport edge, and the
harness forward-projection diverges from the lib's inverse screen→tile, so the
press landed on empty space → the drag silently never engaged (the N=1000 cell read
idle 16.9 ms — the "PROVISIONAL failed grab"). Fix: grab a node near the GRID CENTRE
(guaranteed on-screen, fully surrounded by occupied tiles → a better collision test)
via its ACTUAL rendered DOM rect (`nodeClientCenter`, falls back to tileToClient),
and **assert `mode==='DRAG_ITEMS'` each frame** (`engaged=N/N` now reported per
cell). Result: **engaged=5/5 at N=200/500/1000.**
- **🔬 This OVERTURNS the resume-point assumption.** With the grab now provably
  engaged, N=1000 STILL reads ~16.9 ms while N=500 reads ~30 ms. So the collision-
  drag cost is **genuinely non-monotonic in N — not a failed grab.** N=1000 is cheap
  because its per-frame work fits under the 16.6 ms budget (profile: ~1047 ms idle,
  layout-bound); N=500 is expensive because of JS.

**(b) 🔬 Profiled one collision-drag frame at N=500 and N=1000** (new `PERF_DRAGPROFILE`
harness mode: timeline self-time + CPU sampler around one drag → `dragprofile-{N}.md`).
**The drag is JS/scripting-bound, NOT layout/paint-bound, and it re-renders React
every frame** (defeating the MQA #7 "compositor-only drag" ideal):
- **N=500 timeline:** FunctionCall (JS) **2429 ms** vs style+layout+paint ~250 ms
  over 80 frames → ~30 ms/frame, ~90% JS.
- **N=500 JS self-time** (excluding profiler/GC/idle artifacts): a dominant lib
  arrow (~664 ms; exact minified line unreliable across rebuilds) + the full React-
  reconcile signature — `jsxDEV`/`ReactElement` (element creation), `useMemo`/
  `useCallback`, **`commitHookEffectListUnmount` (44 ms — effects UNMOUNTING/
  remounting → component churn)**, `updateEffectImpl`, `handleStoreChange`+`shallow`
  (zustand), **`murmur2` (48 ms — EMOTION running per frame)**, **`getNativeRange`
  (98 ms — QUILL / RichTextEditor)**, `getBoundingClientRect`+`NotifyResizeObservers`
  (the per-node label ROs), `useColor`.
- **The smoking gun:** `getNativeRange` exists ONLY in node descriptions (Quill) and
  `murmur2` ONLY in `sx` components (the icon's NonIsometricIcon sx + connector-label
  chip). Both firing during a drag ⇒ **node content is re-rendering per frame.**
  (Note: this means Iter 4's icon de-emotion — sub-noise on one-time spawn — could
  actually matter on the per-frame DRAG path, IF node re-render isn't eliminated
  first. Fix the re-render first; re-test icon de-emotion after.)

**Mechanism (from code):** `DragItems.mousemove` → `dragItems` →
`scene.previewConnectorPaths(...)` does a **`flushSync(set({connectors}))` every
frame** ([useSceneActions.ts](../packages/axoview-lib/src/hooks/useSceneActions.ts)
~L368) to keep wires visually attached. The flushSync forces a synchronous render of
scene-`connectors` subscribers — and something in that wave is re-rendering node
content (Quill + emotion), not just the 1–2 affected connectors. Also
`computeNodeUpdates` rebuilds an **O(N) `externalOccupied` Set every frame**
([DragItems.ts](../packages/axoview-lib/src/interaction/modes/DragItems.ts) L97-101)
though external items can't move during a drag. The non-monotonic N=500>N=1000 cost
is geometry/zoom-sensitive: dragging through OCCUPIED tiles makes `computeNodeUpdates`
return null (node can't enter an occupied tile) on many frames, so the per-frame
work depends on exactly which tiles the 150 px screen-drag crosses at each zoom.

**NEXT (drag path, ordered; each via same-session A/B + correctness gate + visual):**
1. **CONFIRM + QUANTIFY the per-frame node re-render** — first thing next session.
   Use the built-in `useRenderProbe` (Node/NodeContent already instrumented; enable
   with `?perfprobe=1`). Add a `get()` to the probe API and have the harness read
   Node/NodeContent render counts across one measured drag → is it ALL visible
   nodes/frame, or only the dragged node + connector neighbours? That determines the
   fix's scope and ceiling.
2. **Stop node content re-rendering on the per-frame connector preview.** The
   `flushSync(set({connectors}))` must re-render connectors but should NOT touch
   nodes. Find the subscription that leaks the connectors-slice change into
   NodeContent (a too-broad scene selector, or the Renderer re-rendering its whole
   child tree) and narrow it so the MQA #7 memo actually holds during a collision-
   drag. Predicted big LEB60 win (drag → compositor-only).
3. **Cache `externalOccupied` at drag entry** (it's constant during a drag) — removes
   an O(N) Set rebuild/frame. Smaller, safe, single-variable; do after (2).
4. **Re-test Iter 4 icon de-emotion on the drag path** once nodes stop re-rendering
   needlessly — if any residual per-frame node render remains, killing the icon
   `murmur2` may finally clear noise (it didn't on spawn).

**Gotcha (carry forward):** minified bundle line numbers in CPU profiles shift across
rebuilds — trust the function NAMES (murmur2, getNativeRange, commitHookEffectListUnmount),
not `index.js:<line>`. `PERF_DRAGPROFILE` and `PERF_PROFILE`/`PERF_CPUPROFILE` skip
the baseline write (no baseline.md restore needed after a profile run; DO restore after
any partial `PERF_N` run).

## 🟢 Iter 6 — KEPT (big drag win): `useColor` fat-subscription fix → collision-drag 33→60 fps @N=500

The Iter 5 profile said "node content re-renders per frame." The `useRenderProbe`
(wired into the harness this iter: `renderProbe.get()` + `PERF_RENDERPROBE=N` mode,
booted with `?perfprobe=1`) **corrected that** and pinned the real culprit:

**🔬 renderProbe, N=500, 80 drag frames (BEFORE):**

| component | total renders | instances | per frame |
|---|---|---|---|
| **Connector** | 34894 | 478 | **≈436/frame** |
| Connectors (container) | 73 | 1 | ~0.9 |
| Node / NodeContent | 1 / 1 | 1 | ~0 |

**Nodes do NOT re-render — ALL 478 connectors re-render every frame.** (The Quill
`getNativeRange` + emotion `murmur2` in the Iter-5 profile were the connectors'
own labels/sx, not nodes.) A same-session diagnostic (`__viewsChanges=0`) proved
`modelStore.views` is stable during a CSS-preview drag → the view connector objects
+ `currentView` are referentially STABLE → a memo on the `connector` prop did
**nothing** (verified: bit-identical 34894). So the re-render is **NOT prop-driven —
it's an internal store subscription** firing for every connector each frame.

**Root cause:** every `Connector` (and `ConnectorLabel`) calls `useColor`, which did
`const { colors } = useScene()` → `useScene` pulls `useSceneData`, which **subscribes
to `sceneStore.connectors`** ([useSceneData.ts](../packages/axoview-lib/src/hooks/useSceneData.ts)
L30-34). The per-frame `previewConnectorPaths` `set({connectors})` writes a new outer
connectors object → that subscription fires → `useColor` re-renders → all 478
Connectors re-render, even though only the dragged node's 1–2 connectors changed.
(zustand 5.0.14 ignores the legacy `shallow` 2nd arg, compounding it.) `useColor`
only needs `colors`, which lives in the MODEL store and is stable during a drag.

**Fix (one variable):** `useColor` subscribes granularly — `useModelStore((s) =>
s.colors)` (+ a stable `EMPTY_COLORS` fallback) instead of `useScene()`. Identical
data, narrower subscription.

- **🔬 renderProbe AFTER:** Connector renders **34894 → 626** (≈436 → **≈7.8/frame**,
  −98%) — only the dragged node's affected connectors re-render now.
- **Same-session A/B (drag mean frame, interleaved stash/pop):**

  | N | HEAD (no fix) | fix | cal H→fix |
  |---|---|---|---|
  | 500 | **30.83 ms (33 fps)** | **16.87 ms (60 fps)** | 3.2→3.1 |
  | 1000 | 16.67 ms | 17.08 ms (already cheap) | 3.2→3.1 |

  **N=500 collision-drag −45%, 33→60 fps.** HEAD ran on a *faster* machine (cal 3.2
  vs 3.1) yet was 1.8× slower → effect ≫ drift. Confirmed by the renderProbe mechanism.
- **Correctness:** gate **13/13 green** (incl. the colour-dependent z-order /
  rectangle-overlap-zorder / css-preview-mid-drag specs). Spawn unaffected (nodes
  don't use `useColor`). **→ KEEP.**

**🔬 Finding / next:** the drag path had a real T1 win that the spawn grind never
touched — a fat subscription, not the CSS-preview architecture. `useColor` is used
widely; this also helps any other per-frame connector/label re-render. **Likely more
of the same:** audit other hot-path components for `useScene()`/`useSceneData()`
over-subscription (ConnectorLabels, the per-connector label path) — each `useScene()`
in a per-instance component re-subscribes to the whole scene. Next: re-profile the
N=500 drag (should now be layout/paint-bound like N=1000 was), and check ConnectorLabel.

---

## ▶ COLD-START RESUME POINT (newest — start here)

**Branch `perf/engine`, HEAD = Iter 6 commit.** Commits since Iter 3 `f1c3e15`:
Iter 4 log (`8eb6d3c`, code reverted), robust drag grab (`73c1d77`), Iter 5 log +
`PERF_DRAGPROFILE` (`00bd34b`), **Iter 6 `useColor` fix + renderprobe tooling**. Last
LIB CHANGE that's KEPT and shipping: Iter 3 de-emotion + **Iter 6 useColor granular
subscription**. Working tree clean (only `bloat-analysis.txt` untracked).

**State of the loop (T1, GREEN, realistic harness):**
- **Harness v2** is the realistic scene: N nodes (5 representative ~1.7 KB icons,
  varied label colours, ~20% descriptions, ~12% notes) + ~N connectors (⅓ labelled)
  + grouping rectangles. Spawn = one bulk `model.set`. Drag = a connected in-grid
  node dragged through OCCUPIED tiles (collision + connector re-route). Text boxes
  excluded (scene-side size derivation incompatible with bulk set). Calibration
  index in every run.
- **Baseline** (`baseline.md`, FRESH full run post-Iter-6, cal 3.2, KR1 6.2% certified):
  spawn N=1000 **settle 283 / longest 200**; N=500 200/117; N=200 133/50 (UNCHANGED by
  Iter 6 — nodes don't use useColor). **Drag: ALL cells now ~16.7 ms 60 fps, engaged=8/8
  — N=500 collision-drag 30→16.9 (Iter 6); the N=1000 "PROVISIONAL" caveat is GONE
  (grab fix).** KR3 idle PASS (0 retained, 0 long tasks; heap abs 87.5 MB — session-
  dependent, only the 0-retained leak metric matters).
- **Wins kept:** 2a (scrollTo-mount guard), 2b (Stack→flex, ~6%), **Iter 3 wholesale
  de-emotion (BIG spawn: −29% settle @1000)**, **Iter 6 `useColor` granular subscription
  (BIG drag: collision-drag N=500 33→60 fps, −45%)**. Reverted: 2c, 2d, Iter 4 (icon
  de-emotion, bit-identical).
- **⛔ SPAWN-JS T1 IS EXHAUSTED (Iter 4 finding).** Post-Iter-3, the 283 ms settle
  is DOM-volume / layout / paint bound, NOT JS-processing bound: removing the icon's
  per-instance emotion (Iter 4b) AND the two per-node label effects (Iter 4a probe)
  each moved the needle by **zero**. Three corroborating sub-noise results (2c, 2d,
  4). Do **not** re-attempt: more de-emotion, label DOM micro-flatten, or shared-RO
  / per-node-effect changes — all proven dead on spawn (and shared-RO is blocked by
  the H-2 protected test). The only spawn step-change left is T2 (Canvas2D — RED).

**⚠️ MEASUREMENT PROTOCOL (load-bearing — do not skip):** cross-session/run machine
drift is ~9–22%, ≫ the ~2% within-run noise. **Every keep/revert decision MUST be a
same-session interleaved A/B** (measure treatment & reference back-to-back in one
session, ideally T-H-T to bracket warm-up drift; check the calibration index is
stable). NEVER compare a fresh run to a prior-session committed baseline. Mechanism:
`git stash` the change → measure HEAD → `git stash pop` → measure treatment; or
`git checkout <commit>~1 -- <file>` for an isolated revert.

**Headroom — spawn (labels-OFF floor, cal 3.2):** N=1000 labels-OFF = 175 ms settle
/ 83 ms longest; full = 283 / 200. The ~108 ms label residual is DOM-volume/paint
bound and **proven resistant to cheap T1** (2c/2d/4 all sub-noise). The 175 ms
icon/connector/rect floor likewise needs T2 to move. **Spawn has no cheap T1
headroom left.**

**Headroom — DRAG (Iter 6 just won here):** collision-drag N=500 was 30 ms/frame
(33 fps) because ALL 478 connectors re-rendered per frame via `useColor`'s fat
`useScene()` subscription (renderProbe-confirmed; nodes were NEVER the issue — the
Iter-5 "node re-render" reading was wrong). Iter 6 made `useColor` granular →
**16.9 ms (60 fps), −45%, renders 436→7.8/frame.** The drag is now ~at budget.

**NEXT (each via same-session A/B + correctness gate + visual):**
1. **Audit other hot-path `useScene()`/`useSceneData()` over-subscriptions** — the
   SAME bug class as Iter 6. `ConnectorLabel` (renders per labelled connector; likely
   calls useColor/useScene → re-renders all per frame too), and any per-instance
   component pulling the whole scene. Use `PERF_RENDERPROBE` + extend `useRenderProbe`
   to those components. Each is a potential drag win.
2. **Re-profile the N=500 drag** (`PERF_DRAGPROFILE=500`) — it should now be layout/
   paint-bound (like N=1000 was), confirming the JS reconcile is gone. If residual JS
   remains, attribute it (the O(N) `externalOccupied` rebuild, or remaining re-renders).
3. **Cache `externalOccupied` at drag entry** (constant during a drag) — removes an
   O(N) Set rebuild/frame. Small/safe; measure if (2) shows it matters.
4. **Re-test Iter 4 icon de-emotion on the drag path** (now that connectors don't
   storm; if any per-frame `murmur2` remains it'd be connector labels, not icons).
5. **Deferred / memory-only:** icon-dedup (<5 KB/entity memory KR) + transient
   willChange. Only if the drag path stalls.

**Gotchas (carry forward):** machine must be IDLE for spawn (calibration index shows
drift); harness owns the dev server (`build:lib && dev` fresh; kill stray :3000
listeners — `Get-NetTCPConnection -LocalPort 3000` then `Stop-Process`); **`baseline.md`
is regenerated by EVERY run incl. partial `PERF_N`/`PERF_NOLABEL` — after any
diagnostic/partial run, `git checkout -- perf-results/baseline.md`**; only a clean
FULL idle run updates it. Visual drivers in `.scratch/` (`verify-labels.mjs`,
`verify-scene.mjs`) for label/scene checks; node label render is `[data-drag-id]`
count (anti-cheat: must == N). Correctness gate (must stay green):
`npx playwright test --config packages/axoview-e2e/playwright.config.ts --project=chromium drag-collision undo-redo-cross-cutting undo-redo-dual-stack multi-select-drag z-order rectangle-overlap-zorder css-preview-mid-drag rename readable-labels`.

**Open strategic question for after the next T1 levers:** once the label-subtree
residual is chased down (or stalls), the remaining floor (icons/connectors/rects =
175 ms @1000) needs T2 (Canvas2D/WebGL render — RED) for a step change. Re-decide
T1-vs-T2 with the then-current headroom.

---

## Iter 7 — T2 entry: connector-canvas prize sizing (DECISIVE NEGATIVE → pivot to nodes)

**Context:** human signed off the RED gate for T2 (Canvas2D render rewrite;
`perf-results/cold-start-t2.md`). Charter requires a written design + a measured
proof-of-concept finding BEFORE the multi-session overhaul. Design:
`perf-results/t2-design.md`. The cold-start suggested spiking the **connector layer**
to Canvas2D first as the cheapest decoupling. Before building a renderer, sized the
prize (LOOP step 7 — instrument, don't guess).

**Hypothesis:** connectors are a meaningful share of the 283 ms @1000 spawn settle,
so a connector→Canvas2D layer is a worthwhile T2 first spike.

**One variable:** scene built WITHOUT connectors (`PERF_NOCONN=1` diagnostic added
to the harness — mirrors `PERF_NOLABEL`; dormant/byte-identical when off). Spawn
only; drag already at 60 fps so not in question.

**Same-session A/B (cal 3.2 both runs — zero drift):**

| N | settle full | settle no-conn | longest full | longest no-conn | conn removed |
|---|---|---|---|---|---|
| 1000 | 283.3 | **283.3** | 200 | **200** | 968 |
| 2000 | 466.6 | **466.6** | 383.3 | **383.3** | 1955 |

**Result: removing ~968 / ~1955 connectors changed spawn by EXACTLY 0 ms.** Not
noise-masked — byte-identical at identical calibration. **→ REJECT the
connector-canvas direction.** A connector rewrite has no prize: spawn 0, drag
already at budget (Iter 6).

**🔬 Root cause (code-path confirmed):** the harness spawn commits via a raw
`model.actions.set({items, views})` (`engine-perf.spec.ts:602`), which bypasses BOTH
connector-routing paths — `changeView`→`syncScene` (sync, on load/view-switch,
`useView.ts:17`) and `computePathsAsync` (rAF-batched 25/frame, on paste,
`useSceneActions.ts:834`). With no route, `sceneStore.connectors[id].path` is empty
and every `<Connector>` early-returns `null` (`Connector.tsx:160`) → ~0 DOM/paint.
The Iter-6 renderProbe "478 connectors" counted the render *function* executing (and
returning null), not painted polylines.

**Real-app validity:** connector routing is deferred + rAF-batched even on a real
paste, so connectors never block initial scene paint; cost amortizes across
post-settle idle frames. Connectors are architecturally NOT on the spawn critical
path. The 0 is a real property, not only a harness artifact — BUT the harness ALSO
doesn't measure connector routing/paint at all (caveat below).

**Correctness gate:** N/A — no shipping-lib change this iteration (harness-only
`PERF_NOCONN` diagnostic + docs). DOM renderer untouched.

**→ PIVOT (proposed, RED — awaiting go-ahead before overhaul):** target the **node
layer**, where the spawn prize is. Connectors-off = 0 change ⇒ the 283 ms @1000 is
nodes + rects; labels-off floor = 175 ms ⇒ labels ≈ 108 ms, icons/rects ≈ 175 ms.
This is SSB-2000 territory and matches the charter. Pragmatic T2 = **hybrid**: canvas
draws icon + shape + static label text + rects (+ connectors, once routed); DOM
retained only for the selected/editing node's live label input. Folding the
connector polyline draw in afterward is trivial (same canvas + same `visibleItems`
cull). The imperative-draw + store-subscription + iso-matrix machinery in
`t2-design.md` is reused as-is; only the target layer changes.

**⚠️ HARNESS CAVEAT (load-bearing for any future connector work):** the spawn metric
does NOT route or paint connectors (bypasses both routing paths). Before ever
revisiting a connector canvas, make the harness route connectors on spawn
(`changeView`/`computePathsAsync` post-set) so the work is measured. Do not read the
0 as "connectors paint for free" — read it as "the harness spawn never paints them."

---

## COLD-START RESUME POINT — updated Iter 7 (SUPERSEDED by Iter 8 below)

**Branch `perf/engine`, HEAD = Iter 7 commit.** T2 RED gate OPEN (human signed off).
Deliverables this session: `t2-design.md` (Canvas2D design + proof metric + FINDING),
`PERF_NOCONN` harness diagnostic, this Iter-7 row. **Connector-canvas direction is
REJECTED with evidence (0 ms spawn prize, drag at budget).** Node-layer-hybrid canvas
is the PROPOSED T2 direction — **PRESENTED to the human, awaiting go-ahead** before
the multi-session overhaul begins (charter RED rule: present the finding first).

**State unchanged from Iter 6** (no shipping-lib change in Iter 7): baseline still
spawn N=1000 283/200, N=500 200/117; drag all-N ~16.7 ms 60 fps; KR3 PASS. Kept wins:
Iter 3 de-emotion (spawn), Iter 6 useColor granular subscription (drag).

**NEXT once node-layer T2 is greenlit:** node-layer Canvas2D PoC behind
`localStorage axoview-canvas-*` flag (default OFF; DOM path byte-identical). Plumb
`PERF_CANVAS=1`→localStorage in `bootApp` for same-session A/B. PoC scope: draw icon
image + static label text to canvas for all N; measure spawn settle/longest A/B at
N=1000/2000 vs DOM; correctness gate stays green with flag off; visual-verify canvas
mode via `.scratch/verify-scene`. Hybrid keeps DOM only for the editing node's label
(readable-labels counter-scale + F2 inline edit — the hard part). See `t2-design.md`
§6 + FINDING for the full plan. **Also: fix the harness to route connectors on spawn**
before measuring any connector draw (caveat above).

**Gotchas unchanged** (see Iter-6 resume point above): same-session A/B + calibration
index mandatory; `git checkout -- perf-results/baseline.md` after any partial/
diagnostic run; correctness gate command above; kill stray :3000 listeners.

---

## Iter 8 — node-layer Canvas2D PoC (DECISIVE GO → build the production hybrid)

**Context:** human greenlit the node-layer T2 direction (RED gate, see
`perf-results/cold-start-t2-poc.md`). Built the PoC: `NodesCanvas.tsx`, an
imperative draw-only `<canvas>` (icon-bitmap cache + static label `fillText`),
behind `localStorage axoview-canvas-nodes` (default OFF); `PERF_CANVAS=1` plumbs it
in `bootApp`. Design + full finding: `t2-design.md` FINDING (Iter 8).

**Hypothesis:** moving the node draw (icon image + static label) to one Canvas2D
layer with an icon-bitmap cache beats the per-node DOM subtree on spawn beyond
noise, holds drag flat.

**One variable:** the `axoview-canvas-nodes` flag (DOM `<Nodes>` vs `<NodesCanvas>`);
DOM path byte-identical when off.

**Same-session A/B — calibration index 3.1 ms BOTH runs (zero drift):**

| metric | DOM ref | canvas | Δ |
|---|---|---|---|
| spawn settle @500 | 200.0 | 133.4 | −33% |
| spawn settle @1000 | 283.4 | **166.6** | **−41% (−117 ms)** |
| spawn longest @1000 | 200.0 | **83.3** | **−58%** |
| spawn settle @2000 | 466.6 | **233.4** | **−50%** |
| spawn longest @2000 | 383.3 | 150.0 | −61% |
| long-task total @1000 | 1099 | **72** | −93% |
| drag mean @1000 / @2000 | 16.87 / 17.29 | 16.67 / 16.67 | flat (60 fps) |
| rendered DOM nodes @1000 | 1000 | 0 | shells gone |

**Result: DECISIVE GO.** Deltas ≫ the ~5% noise band at identical calibration.
Canvas scales sub-linearly (1000→2000: DOM ×1.65, canvas ×1.40). **Canvas settle
@1000 (166.6) is BELOW the DOM labels-off floor (175)** ⇒ the win is real
canvas-vs-DOM, not just dropped descriptions. **→ KEEP the PoC (flag default-off);
proceed to the production node-layer hybrid.**

**Correctness gate (flag OFF): 13/13 GREEN** — DOM path preserved (only addition is
a one-time localStorage read + a render ternary). Flag-ON gate deferred until the
editing-node DOM hybrid exists (F2 edit + readable-labels need a live DOM label).

**Visual parity:** `.scratch/verify-canvas-nodes.mjs` — icons iso-skewed on correct
tiles, labels centered above, colours correct, 0 page errors.

**Honest scope omissions (charter anti-cheat — full list in t2-design FINDING):**
PoC draws icon + static name only. Deferred to production hybrid: description
RichTextEditor (~20%), notes/link badges (~12%), the editing-node DOM hybrid, and
canvas drag-preview movement (the drag A/B measures "scene renders flat with canvas
present", not canvas drag-preview redraw). Harness note: spawn anti-cheat counts 0/N
DOM shells in canvas mode (expected; full scene still committed); drag grab fell back
to `tileToClient` and engaged 5/5.

**Deliverables committed:** `NodesCanvas.tsx`, Renderer flag wiring, `PERF_CANVAS`
harness plumbing, `.scratch/verify-canvas-nodes.mjs`, t2-design FINDING (Iter 8),
this row. Baseline.md untouched (restored after partial runs).

---

## Iter 9 — editing/dragging-node DOM hybrid (flag-ON correctness gate GREEN)

**Context:** Iter-8 PoC GO'd the node-layer canvas but deferred the flag-ON gate
(`t2-design` FINDING). Per `cold-start-t2-hybrid.md` gap #1, build the production
hybrid so the FULL correctness gate passes flag-ON. Empirical first (LOOP step 7):
added an `AXOVIEW_CANVAS_NODES=1`→localStorage bridge to the e2e fixtures (mirrors
`PERF_CANVAS`; off by default ⇒ committed gate untouched) and ran the gate flag-ON on
the Iter-8 HEAD to see EXACTLY what canvas mode breaks. Result: **10/13 pass**; only
`css-preview-mid-drag` (needs `[data-drag-id]` + `--ff-drag`) and `readable-labels`
(needs a DOM `[data-testid="node-label"]`) fail — the other drag/undo/z-order specs
assert via the debug bridge/store and are renderer-agnostic.

**Hypothesis:** rendering the *actively-manipulated* nodes (the single selected node
∪ the drag set) as DOM `<Node>` overlays — and skipping them on the canvas — passes
the flag-ON gate without measurable spawn cost (nothing is selected/dragging during
bulk spawn).

**One variable:** the canvas-mode render path gains a sparse DOM overlay
(`Renderer`: `selectedNodeId` from `itemControls` ∪ `draggingKey` from `mode.items`
while `DRAG_ITEMS` → `hybridNodes`; `NodesCanvas` gains `skipNodes`). DOM path
byte-identical when flag off. Two test-infra changes (not lib): the fixture env
bridge, and a renderer-aware `readable-labels` helper.

**Why the drag set, not just selection (root cause):** dragging an *unselected* node
never sets `itemControls` (selection-on-mousedown only fires for a click, and
`DragItems.mouseup` clears it), so a selection-only hybrid left the dragged node
canvas-only ⇒ `applyCssOffset` found no `[data-drag-id]` and `css-preview-mid-drag`
still failed (observed: 12/13). The dragged ids live in `uiState.mode.items` while
`mode==='DRAG_ITEMS'`; rendering those as DOM gives the dragged node a real
`[data-drag-id]` for `--ff-drag` — which also means the **drag preview is the DOM
compositor path for free** (gap #3 solved for the common single/multi drag; no canvas
per-frame redraw needed).

**readable-labels (honest accounting):** the spec reads `--axoview-label-scale` off
the first node-label's DOM wrapper — absent in canvas mode for an *unselected* node.
The counter-scale genuinely runs on canvas (`computeLabelCounterScale`→`ctx.scale`,
since the PoC). Rather than re-introduce N DOM labels (would erase the win — rejected)
or weaken the assertion, `NodesCanvas` now publishes the *applied* counter-scale as
`data-label-scale` on the `<canvas>` and the spec helper reads it renderer-agnostically
(DOM wrapper when present — flag-off identical; else the canvas attr). Same feature,
same value, different observation surface; documented as the anti-cheat requires.

**Same-session A/B — DOM cal 3.2 ms, canvas cal 3.1 ms (comparable; Iter-8 used 3.1):**

| metric @1000 | DOM ref (flag off) | canvas hybrid (flag on) | Δ |
|---|---|---|---|
| spawn settle | 283.3 | **166.6** | **−41%** |
| spawn longest | 200.0 | **83.3** | **−58%** |
| long-task total | 1127 | **72** | −94% |

**Result: the Iter-8 spawn win is preserved EXACTLY** (canvas settle 166.6 ms,
byte-identical to Iter-8) — the editing/dragging DOM overlay adds zero spawn cost,
as predicted (nothing selected/dragging during bulk spawn ⇒ `hybridIds` null ⇒
identical draw). **→ KEEP.**

**Correctness gate — flag-ON: 13/13 GREEN** (was 10/13: `css-preview-mid-drag` +
both `readable-labels` now pass). **Flag-OFF: 13/13 GREEN** (no regression — DOM path
byte-identical; the `readable-labels` helper reads the DOM wrapper unchanged when
present). This is the milestone the charter RED rule gates on: the canvas path now
passes the full gate flag-ON — present before making canvas default / deleting DOM.

**Deliverables committed:** `Renderer` hybrid wiring (`selectedNodeId`/`draggingKey`/
`hybridNodes`), `NodesCanvas` `skipNodes` + `data-label-scale`, `AXOVIEW_CANVAS_NODES`
fixture bridge, renderer-aware `readable-labels` helper, this row. Baseline.md restored
after partial PERF_N=1000 runs (still 283/200 @1000, flag-off byte-identical).

---

## ▶ COLD-START RESUME POINT (newest — start here) — updated Iter 9

**Branch `perf/engine`, HEAD = Iter 9 commit.** T2 node-layer Canvas2D hybrid now
**passes the FULL correctness gate flag-ON (13/13)** AND flag-OFF (13/13), with the
Iter-8 spawn win preserved exactly (settle 283→167 @1000, −41%; longest 200→83;
long-task 1127→72). Still RED-gated: the DOM renderer is untouched and canvas is NOT
the default — **present before making canvas default or deleting the DOM renderer**
(charter RED rule). The hybrid renders the selected node ∪ drag-set as DOM `<Node>`
(sparse), canvas draws the rest; flag `localStorage axoview-canvas-nodes` / `PERF_CANVAS=1`
/ gate `AXOVIEW_CANVAS_NODES=1`.

**State:** baseline unchanged (flag-off byte-identical) — spawn N=1000 283/200, N=500
200/117; drag all-N ~16.7 ms 60 fps; KR3 PASS. Kept wins: Iter 3 de-emotion (spawn),
Iter 6 useColor (drag), Iter 8 NodesCanvas PoC, **Iter 9 editing/dragging DOM hybrid
(flag-ON gate green; spawn win preserved)**. Touched: `Renderer.tsx`,
`NodesCanvas.tsx`, `fixtures/app.fixture.ts`, `tests/readable-labels.spec.ts`.

**NEXT (each via same-session A/B + gate + visual):**
1. **Fold in description text + notes/link badges** on canvas; measure the residual vs
   −41% (some of the −41% was dropped descriptions, but canvas already beat the DOM
   labels-off floor, so the core win holds). Currently the canvas draws icon + static
   name only; a node with a description shows only its name on canvas (until selected,
   when the DOM `<Node>` renders the full RichText). Honest gap — close it next.
2. **Fold the connector polyline draw** into the same canvas (trivial — same cull)
   AFTER fixing the harness to route connectors on spawn (Iter-7 caveat).
3. **Present the GO + flag-ON gate evidence** and decide whether to make canvas the
   default and retire the DOM node renderer (charter RED rule — do not do this silently).
   A default-on canvas wants a draw-count anti-cheat (the spawn DOM-shell count reads
   0/N in canvas mode — expected; Iter-8 harness note).

**Visual parity:** covered behaviorally by the flag-ON gate — `readable-labels` asserts
the real applied counter-scale, `css-preview-mid-drag` the real drag-preview offset,
`drag-collision`/`multi-select-drag`/`z-order` the committed geometry. `.scratch/
verify-canvas-nodes.mjs` remains for screenshot spot-checks.

**Gotchas unchanged:** same-session A/B + stable calibration index mandatory (this iter
DOM 3.2 ↔ canvas 3.1, comparable); `git checkout -- perf-results/baseline.md` after any
partial/diagnostic run; **the dev server desyncs from `dist/` after `build:lib` ("Can't
resolve 'axoview'") — let `npm run perf` own the lifecycle (no `PERF_REUSE` against a
hand-started server; this iter wasted two runs learning that the hard way)**; kill stray
:3000 listeners; correctness gate command in the Iter-6 resume point above, run flag-ON
with `AXOVIEW_CANVAS_NODES=1`.
