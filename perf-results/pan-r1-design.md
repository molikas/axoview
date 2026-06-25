# T2.5 — Large-diagram pan floor (R1): `measurePan` harness + fix scope

**Status:** scoped 2026-06-25, not started. Active perf sub-track (branch
`fix/large-diagram-pan-perf`). Charter tier **T2.5** ([../docs/tactical/perf-charter.md](../docs/tactical/perf-charter.md));
open item **R1** in [../known_issues.md](../known_issues.md); resume point in
[decision-log.md](decision-log.md) (2026-06-25). Follows the ADR-0020 measurement
protocol + the charter empirical LOOP.

## Objective

Lift the per-frame **pan** repaint floor on large diagrams to a steady 60 fps on AC
and a usable rate under CPU throttle, **without** reintroducing the #54 cross-surface
"rubber-band" and **without** regressing spawn/drag. First make it *measurable* (the
harness has zero pan coverage today), then fix it under same-session A/B discipline.

## Root cause (verified — recap from known_issues R1)

`NodesCanvas.drawNow()` repaints the full **O(visible)** node set **synchronously on
every scroll write** — the deliberate #54 design (commit `b62dec79`) that keeps the
canvas in lockstep with the DOM `SceneLayer`/`Grid` transforms (which apply their CSS
transform synchronously in the same store notification) to kill cross-surface skew. At
~54 visible nodes that per-frame repaint (per node: `drawImage` + dotted stalk stroke +
chip `roundRect` + `fillText`) is the steady frame-time floor — it does **not** need a
tile-boundary crossing. Under CPU throttle the same repaint overruns the throttled
budget → the >50 ms long-task storm (~6–8 fps on battery vs ~24–55 fps on AC).
The 2026-06-24 fixes (#54, `3cf76c08`) removed the *bursts* (culling decoupled from the
pan frame, array-identity stabilised, Grid reflow removed) but **not this floor**.

## Key results (binary-verifiable)

- **KR-P1 — `measurePan` committed.** New harness scenario reports mean + p95 frame
  time + long-task total during a sustained pan, with the draw-count anti-cheat, at
  N ∈ {50, 100, 200, 500, 1000}, in **both** an AC and a CPU-throttled regime.
  Within-run CoV < 10% on the load-bearing range (N ≥ 200) per ADR-0020.
- **KR-P2 — large-N `scrollSync` guard variant committed.** Renders `nodes=[~many]`
  and asserts the synchronous repaint draws **all** of them in the `setScroll` tick.
  Proven a true falsifier: a throwaway node-count-gated `sync→async` mutation must make
  it RED (the current `nodes={[]}` test stays green under that mutation — the false-safe
  this closes).
- **KR-P3 — pan baseline recorded** in `baseline.md` (the floor to beat) before any fix.
- **KR-P4 — the fix.** R1 pan p95 ≤ 16.6 ms on AC at the R1-class scene, and materially
  lifted under throttle, via a **dirty-region / scroll-blit redraw** — with the large-N
  `scrollSync` guard + `css-preview-mid-drag` staying green (no rubber-band) and spawn +
  drag within the same-session noise band (no regression).
- **KR-P5 — correctness gate green** after every kept change (the 9-spec anti-cheat).

## Prerequisite guards (land BEFORE any fix — charter LOOP step 2)

1. **`measurePan` harness scenario** (design below). Without it the floor is unmeasured
   by CI and no keep/revert is valid.
2. **Large-N `NodesCanvas.scrollSync` guard variant.** The existing guard
   ([NodesCanvas.scrollSync.test.tsx](../packages/axoview-lib/src/components/SceneLayers/Nodes/__tests__/NodesCanvas.scrollSync.test.tsx))
   renders `nodes={[]}`, so a "sync only when small, async when large" fix would keep it
   green while regressing real scenes. Add a sibling test that renders a populated
   `nodes` array and asserts the per-node draw calls (`drawImage`/`roundRect`/`fillText`)
   fire **synchronously** in the `setScroll` `act()` (rAF stubbed to never flush, same
   technique). This is the falsifier that makes a node-count-gated regression impossible.

## `measurePan` — harness design (mirror `measureDrag`)

Add `async function measurePan(N, steps)` to
[engine-perf.spec.ts](../packages/axoview-e2e/perf/engine-perf.spec.ts), modeled on
`measureDrag` (L665) — same `buildScene(N,1)` + `fitForGrid(1,N)` + `quiesce()` setup,
so **N = visible entity count**, consistent with spawn/drag.

- **Gesture:** drive the **real** pan path so `setScroll` runs inside the
  `useRAFThrottle` callback and `drawNow()`'s synchronous repaint is exercised. Engage
  pan exactly as the app does (mirror `usePanHandlers` / `interaction/modes/Pan.ts` —
  right-button drag, `button=2`, or the Pan tool then left-drag) on the
  `[data-axoview-id="canvas-interactions"]` element.
- **Amplitude:** oscillate a **bounded** pan (e.g. ±~120 px over `steps` rAF frames) so
  the visible set stays ≈ N and `drawNow` repaints ≈ N nodes each frame (the R1 regime —
  not a cull). Capture per-frame `raf()` deltas + `observeLongTasks`, as `measureDrag`.
- **Anti-cheat (two):** (1) assert `ui.scroll` changed each frame (a failed pan reads
  idle 16.7 ms and must be flagged, like `dragEngaged`); (2) assert the canvas
  `data-draw-count` stays ≈ N across the pan (the pan repaints, doesn't cull away).
- **Throttled regime:** add a CPU-throttle knob (CDP `Emulation.setCPUThrottlingRate`,
  e.g. `PERF_THROTTLE=4`|`6`) so the battery collapse — where R1 is worst and a fix must
  prove itself — is reproducible. AC same-session A/B drives keep/revert; throttled is a
  directional confirmation.
- **Wiring:** a focused `PERF_PAN=N` mode (like `PERF_DRAGPROFILE`) for iteration; fold a
  pan column into the baseline loop + `baseline.md`. Headline metric = **p95 frame time
  during sustained pan** (continuous, per ADR-0020 §0d — not vsync-quantized percentiles).

## Fix approaches

- **(a) LEAD — dirty-region / scroll-blit redraw.** On a pure pan only the nodes'
  *screen position* changes, not their pixels. Translate the existing canvas bitmap by
  the scroll delta and redraw only the thin **newly-revealed margin** (+ any nodes
  intersecting it) → per-frame cost O(revealed), independent of visible N. **Keeps the
  synchronous lockstep #54 requires** (DOM layers also translate synchronously) → no
  rubber-band by construction. Fallback within (a): a layered/offscreen canvas compositing
  a cached static-node bitmap under a cheap transform, if blit math proves too fiddly.
- **(b) FALLBACK ONLY — sync-small / async-large hybrid.** Repaint sync at low node
  count, schedule rAF at high count. **Risky:** the async path trails the DOM by a frame
  — reintroducing the exact #54 rubber-band on the large scenes R1 is about — unless the
  *whole* pan is re-architected to batch the DOM-layer transforms into the same rAF. Only
  consider if (a) fails; gated hard by the large-N `scrollSync` guard.

Lead with (a): it attacks the actual cost (the draw calls — drag CPU profiles show ~0
self-time in string normalisation) while preserving the lockstep invariant.

## Empirical loop (charter discipline)

Build KR-P1/P2/P3 first (harness + guards + baseline), then loop on KR-P4: **one
variable per iteration**, **same-session interleaved A/B (T-H-T)** with a stable
calibration index, correctness gate after each kept change, **one decision-log row per
iteration**, `git checkout -- perf-results/baseline.md` after any partial run, only a
clean full idle run updates the baseline.

## Risks

- **Blit at non-1 zoom / dpr:** bitmap translate goes sub-pixel. Mitigation: blit only on
  *pure scroll*; full redraw on any zoom change; round the blit delta to device pixels.
- **Rubber-band regression:** the large-N `scrollSync` guard + `css-preview-mid-drag` are
  the falsifiers; any async path must keep both green.
- **Throttled-run noise:** CPU-throttled cells are noisier; keep/revert rests on the AC
  same-session A/B, throttle is directional.
- **Pan-engagement fragility:** a mis-wired gesture reads idle; the two anti-cheats
  (scroll-delta-per-frame + draw-count ≈ N) catch it.

## Out of scope (separate items)

Connector fold (DOM-volume headroom — separate decision-log next-step), the T3
tick-workload harness, the `NodeLabelHitLayer` per-node DOM-div cap, the O(N)
`scene.items.find` multi-drag anti-pattern. Each tracked in `known_issues.md` / the
decision log.
