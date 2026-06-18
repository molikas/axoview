# ▶ COLD-START PROMPT — Engine perf, T2 (Canvas2D render layer)

Paste this as the opening message of a fresh session to continue the self-driving
engine-perf initiative into **T2**. Treat the context window as scratch; disk is the
source of truth.

---

You are resuming the Axoview engine-performance initiative on branch `perf/engine`
(work tree on Windows / PowerShell; Bash tool also available). Read these THREE files
first, in order, and continue from the resume point — do NOT restart the loop or
re-measure committed baselines:

1. `docs/tactical/perf-charter.md` — the durable spec (objective, KR1–KR6, tier
   ladder, operating protocol, autonomy/escalation, STOP rule).
2. `perf-results/decision-log.md` — the running memory. **Start at the bottom:
   `▶ COLD-START RESUME POINT`**, then skim Iter 3 (spawn de-emotion) and Iter 6
   (drag `useColor` fix) — the two kept wins — for context.
3. `perf-results/baseline.md` — the current certified numbers.

## Human sign-off (the RED gate is OPEN)

T1 "stop the bleeding" is **substantially harvested** and the human has **signed off
on the T2 escalation** (the charter's RED gate for an architectural render rewrite).
You are authorized to design and prototype T2. Per the charter, **present a written
design + a measured proof-of-concept finding BEFORE committing to a multi-session
overhaul** — do not silently rewrite the whole renderer.

## State at handoff (all committed + pushed on `perf/engine`)

- **T1 wins kept:** Iter 3 wholesale de-emotion (spawn N=1000 −29% settle / −37%
  longest) and Iter 6 `useColor` granular subscription (collision-drag N=500
  **33→60 fps**, after the renderProbe showed all 478 connectors re-rendered ~436×/frame
  via a fat `useScene()` subscription).
- **Current baseline (cal 3.2, KR1 6.2% certified, KR3 PASS):** spawn N=1000 settle
  **283 ms / longest 200 ms** (down from the PHASE-0 633 ms longest); N=500 200/117;
  N=200 133/50. **Drag is ~16.7 ms / 60 fps at EVERY N** incl. N=1000 with collision +
  connector re-route (`engaged=8/8`).
- **T1 is at a wall:** spawn is DOM/layout/paint-bound, not JS-bound (Iter 4 proved
  de-emotion/effects/flatten are all sub-noise now); the spawn floor (175 ms labels-off
  @1000 = icon/connector/rect DOM) needs a render rewrite to move. Drag is already at
  budget. **The only step-change left is T2.**

## T2 target (from the charter tier ladder)

> **T2 — render rewrite:** SSB 2,000 / LEB60 200, medium world. Unlock required:
> **Canvas2D layer decoupled from React + viewport culling.**

Today the scene is DOM/SVG (~14 elements/node × N, plus per-connector SVG) reconciled
by React. T2 moves rendering to an imperative Canvas2D (or WebGL later — T4) layer that
draws the visible scene each frame, decoupled from React reconciliation, so render cost
scales with VISIBLE entities and paint, not React element count. The engine **already
viewport-culls** by coarse tile bounds (`Renderer.tsx` `visibleItems`/`visibleConnectors`)
— reuse that. Interaction/state stays in the existing stores; only the *draw* changes.

## How to work (carry forward — load-bearing)

- **Run the harness:** `npm run perf` (rebuilds lib + boots a fresh dev server;
  owns its lifecycle). Scope with `PERF_N=500,1000 PERF_REPEATS=5 PERF_WARMUP=2
  PERF_IDLE_MS=2000` for fast iteration. Diagnostics: `PERF_PROFILE=N` /
  `PERF_CPUPROFILE=N` (spawn timeline / JS self-time), `PERF_DRAGPROFILE=N` (drag),
  `PERF_RENDERPROBE=N` (React render fan-out via `?perfprobe=1` + `useRenderProbe`),
  `PERF_NOLABEL=1` (labels-off floor).
- **MEASUREMENT PROTOCOL (mandatory):** cross-session/run machine drift is ~9–22% ≫
  the ~2% within-run noise. **Every keep/revert is a same-session interleaved A/B**
  (stash/pop or `git checkout <ref> -- <file>`, measure treatment & reference
  back-to-back, check the calibration index is stable). NEVER compare to a
  prior-session baseline. A result inside the noise band is NOT a win.
- **Correctness gate (KR5) after every kept change — must stay green:**
  `npx playwright test --config packages/axoview-e2e/playwright.config.ts --project=chromium drag-collision undo-redo-cross-cutting undo-redo-dual-stack multi-select-drag z-order rectangle-overlap-zorder css-preview-mid-drag rename readable-labels`
- **`baseline.md` is rewritten by EVERY run** incl. partial `PERF_N`/diagnostic runs —
  `git checkout -- perf-results/baseline.md` after any partial; only a clean FULL idle
  run updates it. Profile modes (`PERF_PROFILE`/`PERF_CPUPROFILE`/`PERF_DRAGPROFILE`)
  skip the baseline write.
- **Commit the decision log + results after every kept/reverted iteration.** Append
  one decision-log row per hypothesis (KR6). Conventional commits, lowercase subject
  (commitlint), footer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Kill stray `:3000` listeners between runs (`Get-NetTCPConnection -LocalPort 3000` →
  `Stop-Process`). Machine must be IDLE for spawn (calibration index flags drift).

## Suggested T2 first moves (form your own from the trace, charter LOOP step 7)

1. **Design doc first** (`perf-results/t2-design.md`): which layer goes to Canvas2D
   (nodes? connectors? both?), how the imperative draw subscribes to the stores +
   reuses the existing tile-bounds cull, how hit-testing/selection/drag stay correct,
   and how the CSS-var drag-preview (MQA #7) maps onto a canvas. Define the proof
   metric (spawn longest-frame + drag mean-frame at N=1000/2000 vs the DOM baseline).
2. **Spike the cheapest decoupling first** — likely the **connector layer** (pure SVG
   polylines, no text/interaction inside; already path-cull'd) → a single `<canvas>`
   that redraws affected connectors. Measure spawn + drag A/B. If it wins and stays
   correct, it both validates the approach and de-risks the bigger node-layer move.
3. **Then the node layer** (the heavy one — labels/icons/badges). This is where SSB
   2000 lives; it's also where text rendering + the readable-labels counter-scale +
   inline-edit make Canvas2D hardest. Scope carefully; a hybrid (canvas for icon/shape,
   DOM for the editable label) may be the pragmatic T2.
4. Bump the harness N set toward T2 scale (add 2000) once a canvas path renders, and
   add an `SSB`-style sustained-idle-fps probe if needed (the charter's SSB metric).

## Guardrails

- T2 is the RED architectural move you were authorized to take — but keep it
  **reversible and measured**: spike on a branch/flag, prove the win same-session A/B,
  keep the correctness gate green, present the finding. Do NOT delete the DOM renderer
  until a canvas path is proven across the gate.
- If a spike does NOT beat the DOM baseline beyond noise, that's a charter-worthy
  finding (architectural ceiling) — write it up, don't force it.
