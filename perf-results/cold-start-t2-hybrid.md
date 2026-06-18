# ▶ COLD-START PROMPT — Engine perf, T2 production node-layer hybrid

Paste this as the opening message of a fresh session to build the **production
node-layer Canvas2D hybrid** on top of the Iter-8 PoC. Treat the context window as
scratch; disk is the source of truth.

---

You are resuming the Axoview engine-performance initiative on branch `perf/engine`
(Windows / PowerShell; Bash tool also available). The T2 node-layer Canvas2D
direction is **already validated with a measured GO** — do NOT re-litigate it or
re-measure committed baselines. Read these first, in order, then continue the loop
from the resume point:

1. `docs/tactical/perf-charter.md` — durable spec (objective, KR1–KR6, tier ladder,
   operating protocol, autonomy/escalation, RED gate, STOP rule).
2. `perf-results/decision-log.md` — running memory. **Start at the bottom:
   `▶ COLD-START RESUME POINT … updated Iter 8`**, then read the **Iter 8** row
   (node-layer PoC GO) and skim Iter 7 (connector reject) + Iter 3/6 (kept wins).
3. `perf-results/t2-design.md` — the Canvas2D design; read the **FINDING (Iter 8)**
   tail (the GO evidence, scope omissions, and the production NEXT list).
4. `perf-results/baseline.md` — current certified numbers.
5. The code you are extending: `packages/axoview-lib/src/components/SceneLayers/
   Nodes/NodesCanvas.tsx` (the PoC), its wiring in `Renderer.tsx`
   (`readCanvasNodesFlag` / the `canvasNodes` ternary), and the DOM path it mirrors
   (`Nodes.tsx` / `Node.tsx`).

## Where things stand (all committed on `perf/engine`, HEAD = Iter 8)

- **Iter 8 PoC GO (committed, flag default-OFF):** a draw-only `<canvas>`
  (`NodesCanvas`) draws icon-bitmap-cache + static label text. Same-session A/B
  (cal 3.1 both): **spawn settle @1000 283→167 ms (−41%), longest 200→83 (−58%);
  @2000 467→233 (−50%, sub-linear); long-task @1000 1099→72 ms; drag flat 60 fps;
  rendered DOM nodes N→0.** Canvas @1000 (167) beats even the DOM labels-off floor
  (175) ⇒ real canvas-vs-DOM win. Gate 13/13 green flag-OFF. DOM renderer untouched.
- **Flag:** `localStorage 'axoview-canvas-nodes'` (default OFF; DOM byte-identical
  when off). Harness: `PERF_CANVAS=1` → sets it in `bootApp`.
- **Kept shipping wins:** Iter 3 de-emotion (spawn), Iter 6 useColor (drag).
- **Baseline (cal-dependent, same-session only):** spawn N=1000 283/200, N=500
  200/117, N=2000 466/383; drag all-N ~16.7 ms 60 fps; KR3 PASS.

## What the PoC deliberately does NOT do yet (the production gaps to close)

The PoC drew the representative case only. Build these — **one variable per
iteration**, each with a same-session A/B + the correctness gate + a visual check:

1. **Editing-node DOM hybrid (do FIRST — it unblocks the flag-ON gate).** Keep ONE
   live DOM label for the selected/editing node (the F2 inline edit + the live
   readable-labels counter-scale are painful on canvas, and only one node edits at a
   time); everything else stays canvas-drawn. Hit-testing/selection/drag already run
   off the stores + the invisible `canvas-interactions` box — keep the canvas
   draw-only. Goal: the **flag-ON** correctness gate passes `rename` +
   `readable-labels`.
2. **Fold in description text + notes/link badges** on the canvas; measure the
   residual win vs the −41% (part of which was dropped descriptions — but the canvas
   already beat the labels-off floor, so the core win holds independent of this).
3. **Canvas drag-preview redraw.** The DOM path moves the dragged node via
   `--ff-drag` CSS vars (compositor-only); the canvas has no equivalent yet, so the
   Iter-8 drag A/B only proved "the scene renders flat with the canvas present."
   Add an O(visible) canvas redraw on the drag-preview tick so the dragged node
   actually moves on canvas; re-measure drag A/B (no-regression bar ≤ ~17.5 ms).
4. **Fold the connector polyline draw** into the same canvas (trivial — same
   `visibleItems`/`visibleConnectors` cull, same iso matrix) — but FIRST fix the
   harness to route connectors on spawn (`changeView`/`computePathsAsync` post-set),
   per the Iter-7 caveat, or the connector draw is measured as free.
5. When the **full correctness gate passes flag-ON in canvas mode** and visual
   parity is confirmed → present the finding before deleting the DOM node renderer
   (charter RED rule). Only then is making canvas the default on the table.

## Proof metric (each iteration)

Same-session, calibration-checked, `PERF_N=500,1000,2000`: spawn settle + longest
must stay ≫ noise better than DOM (the −41% @1000 is the bar to hold/beat as you add
fidelity); drag mean ≤ ~17.5 ms (no regression). Track `rendered` DOM node count and
note any new DOM the hybrid re-introduces (the editing-node label is sparse — ~1).

## How to work (load-bearing — carry forward)

- **Run the harness:** `npm run perf` (rebuilds lib + boots a fresh dev server; owns
  its lifecycle). Fast scope: `PERF_N=500,1000,2000 PERF_REPEATS=5 PERF_WARMUP=2
  PERF_IDLE_MS=2000`. Flag-on: prefix `PERF_CANVAS=1`. Diagnostics: `PERF_PROFILE` /
  `PERF_CPUPROFILE` (spawn), `PERF_DRAGPROFILE` (drag), `PERF_RENDERPROBE`,
  `PERF_NOLABEL`, `PERF_NOCONN`.
- **MEASUREMENT PROTOCOL (mandatory):** cross-run machine drift ~9–22% ≫ ~2–5%
  within-run noise. Every keep/revert is a **same-session A/B with a STABLE
  calibration index** (Iter 8: re-ran the reference warm so both halves were cal 3.1;
  a 3.8-vs-3.1 pair was discarded). Inside the noise band is NOT a win.
- **Correctness gate (KR5):** must stay green **flag-OFF** after every kept change,
  and **flag-ON** before proposing canvas as default:
  `npx playwright test --config packages/axoview-e2e/playwright.config.ts --project=chromium drag-collision undo-redo-cross-cutting undo-redo-dual-stack multi-select-drag z-order rectangle-overlap-zorder css-preview-mid-drag rename readable-labels`
- **Visual parity:** `.scratch/verify-canvas-nodes.mjs` (DOM vs canvas screenshots +
  DOM-marker counts) and `.scratch/verify-labels.mjs` / `verify-scene.mjs`. The
  `readable-labels` spec is the counter-scale guard; `rename` is the F2 inline-edit
  guard — both are why the hybrid keeps DOM for the editing node.
- **`baseline.md` is rewritten by EVERY run** incl. partial/diagnostic —
  `git checkout -- perf-results/baseline.md` after any partial; only a clean FULL
  idle run updates it.
- **Build/dev gotcha:** the rsbuild dev server desyncs from `dist/` after
  `build:lib` (Iter 8 hit a "Can't resolve 'axoview'" build failure). Let
  `npm run perf` own the lifecycle (build + fresh boot); do NOT `PERF_REUSE=1`
  against a hand-started dev server unless you just rebuilt+restarted it. Kill stray
  :3000 listeners between runs (`Get-NetTCPConnection -LocalPort 3000` → `Stop-Process`).
- **Commit after every kept/reverted iteration** (one decision-log row per
  hypothesis, KR6). Conventional commits, lowercase subject, footer
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## Guardrails

- Reversible + measured + flagged; prove each win same-session A/B; keep the gate
  green; present before deleting the DOM node renderer. RED gate: this is the
  multi-session overhaul — proceed within it (the direction is signed off), but do
  NOT silently make canvas the default.
- Honest accounting (charter anti-cheat): when you add fidelity, report how the win
  moves; when you defer something, write it down (no silent caps).
- Harness caveat (Iter 7/8): the spawn metric does NOT route/paint connectors, and
  in canvas mode the `[data-drag-id]` anti-cheat reads 0/N (shells gone — expected).
  A default-on canvas wants a draw-count anti-cheat instead of a DOM-shell count.
