# ▶ COLD-START PROMPT — Engine perf, T2 PoC (node-layer Canvas2D, hybrid)

Paste this as the opening message of a fresh session to build the **T2
proof-of-concept**: a node-layer Canvas2D render path, measured A/B against the DOM
renderer. Treat the context window as scratch; disk is the source of truth.

---

You are resuming the Axoview engine-performance initiative on branch `perf/engine`
(Windows / PowerShell; Bash tool also available). Read these files first, in order,
then build the T2 PoC from the resume point — do NOT restart the loop or re-measure
committed baselines:

1. `docs/tactical/perf-charter.md` — the durable spec (objective, KR1–KR6, tier
   ladder, operating protocol, autonomy/escalation, STOP rule).
2. `perf-results/decision-log.md` — the running memory. **Start at the bottom:
   `▶ COLD-START RESUME POINT … updated Iter 7`**, then read the **Iter 7** section
   (connector-canvas rejected) and skim Iter 3 + Iter 6 (the two kept wins).
3. `perf-results/t2-design.md` — the Canvas2D design + proof metric, and the
   **FINDING (Iter 7)** that pivots T2 from connectors to the node layer. §6 + the
   FINDING tail are the node-layer-hybrid plan.
4. `perf-results/baseline.md` — the current certified numbers.

## Human sign-off (RED gate OPEN, node-layer direction approved)

T2 (Canvas2D render rewrite) is human-authorized. **Iter 7 proved the connector
layer is the wrong first move** (removing all connectors changed spawn by 0 ms;
drag already at 60 fps — no prize on either axis; root cause: the harness bulk
`model.set` never routes connectors, and real-app routing is deferred/rAF-batched,
so connectors never block initial paint). The approved T2 first move is the **node
layer**, where the spawn prize lives (connectors-off = 0 ⇒ the 283 ms @1000 settle
is nodes + rects; labels-off floor = 175 ms ⇒ labels ≈ 108 ms, icons/rects ≈ 175 ms).

Per the charter RED rule, keep it **reversible + measured**: build behind a
default-off flag, prove the win same-session A/B, keep the correctness gate green,
present before deleting the DOM path. Do NOT silently rewrite the renderer.

## State at handoff (all committed on `perf/engine`, HEAD = Iter 7)

- **Baseline (cal 3.2, KR1 6.2% certified, KR3 PASS):** spawn N=1000 settle **283 /
  longest 200**; N=500 200/117; N=200 133/50. **Drag ~16.7 ms / 60 fps at EVERY N**
  (incl. N=1000, collision + connector re-route, `engaged=8/8`). N=2000 (Iter-7
  same-session): spawn settle 466 / longest 383; drag ~17 ms.
- **Kept wins:** Iter 3 wholesale de-emotion (spawn −29% @1000); Iter 6 `useColor`
  granular subscription (drag collision N=500 33→60 fps).
- **Spawn-JS T1 exhausted** (Iter 4); the only spawn step-change left is T2.
- **AxoBench (`perf-results/render-bench-design.md`) is DEFERRED** — evaluated, not
  on the PoC critical path (it's a moving-entity/LEB60 showcase that presupposes the
  Canvas2D layer this PoC builds). Revisit post-T2. Do not build it now.

## T2 PoC — what to build (node-layer Canvas2D, hybrid)

Today each node is ~14 DOM elements (icon `<img>`, label subtree, badges) × N,
reconciled by React (`Nodes`/`Node` under `Renderer.tsx`). The PoC moves the node
**draw** to one imperative `<canvas>`:

- **Draw, per visible node:** the icon image (decode once, cache the `HTMLImageElement`
  / `ImageBitmap` per icon id — there are only 5 distinct icons in the perf scene,
  many in the real app, so an icon-bitmap cache is the key spawn win vs N DOM `<img>`
  decodes) + the **static label text** (`ctx.fillText`, honoring `labelColor` /
  `labelFontSize` / `showLabel`). Rects can move to the same canvas or stay DOM for
  the PoC (measure which matters).
- **Reuse the existing machinery** (`t2-design.md`): the `visibleItems` tile-bounds
  cull (already in `Renderer.tsx`), the `SceneLayer` pan/zoom transform model (the
  canvas owns its transform: `setTransform(zoom,…,scroll)` then the fixed iso matrix
  `0.707,-0.409,0.707,0.409,0,-0.816` from `CanvasModeContext.getProjectionCss`),
  and an imperative store subscription (`uiStateStore` scroll/zoom + the model
  view items) with **rAF-coalesced** redraw.
- **Hybrid (the hard part — do it right):** keep DOM only for the **selected /
  editing** node's live label — the readable-labels counter-scale and inline **F2
  edit** are painful on canvas, and only one node edits at a time. Everything else
  is canvas-drawn text. Hit-testing/selection/drag stay in the stores + the
  invisible `canvas-interactions` box (unchanged — the canvas is draw-only).

## Flag + reversibility

- Runtime flag, **default OFF**: `localStorage 'axoview-canvas-nodes'` read in
  `Renderer`, choosing `<Nodes>` (DOM, unchanged) vs `<NodesCanvas>`. DOM path
  byte-identical when off ⇒ committed baseline + full correctness gate stay green.
- **Plumb the harness:** add `PERF_CANVAS=1` → sets the localStorage flag in
  `bootApp` (mirror the existing `PERF_NOLABEL`/`PERF_NOCONN` plumbing), so the
  same-session A/B is flag-off (reference == HEAD) vs flag-on (treatment),
  calibration-index-checked, back-to-back.

## Proof metric (go / no-go)

Same-session, calibration-checked, `PERF_N=500,1000,2000`:

| metric | DOM (ref) | canvas (treat) | go bar |
|---|---|---|---|
| spawn settle @1000 | 283 ms | ? | beat by ≫ noise (≥ ~30 ms) |
| spawn longest @1000 | 200 ms | ? | beat by ≫ noise |
| spawn settle @2000 | 466 ms | ? | scales sub-linearly vs DOM |
| drag mean @1000 | 16.7 ms | ? | **no regression** (≤ ~17.5 ms) |
| rendered DOM nodes | N shells | sparse (editing only) | DOM node count drops |

**Go** = canvas beats DOM spawn beyond noise AND holds drag flat AND visual parity
(icon + static label) verified. **No-go** = if a faithful canvas node-draw does NOT
beat DOM spawn beyond noise → that's a charter-worthy architectural-ceiling finding;
write it up, don't force it.

## How to work (load-bearing — carry forward)

- **Run the harness:** `npm run perf` (rebuilds lib + boots a fresh dev server;
  owns its lifecycle). Scope: `PERF_N=500,1000,2000 PERF_REPEATS=5 PERF_WARMUP=2
  PERF_IDLE_MS=2000` for fast iteration. Diagnostics: `PERF_PROFILE` / `PERF_CPUPROFILE`
  (spawn timeline / JS self-time), `PERF_DRAGPROFILE` (drag), `PERF_RENDERPROBE`
  (React fan-out), `PERF_NOLABEL` (labels-off floor), `PERF_NOCONN` (connectors-off).
- **MEASUREMENT PROTOCOL (mandatory):** cross-session machine drift ~9–22% ≫ ~2%
  within-run noise. **Every keep/revert is a same-session interleaved A/B** (flag
  off vs on back-to-back; check the calibration index is stable). NEVER compare to a
  prior-session baseline. Inside the noise band is NOT a win.
- **Correctness gate (KR5) — must stay green** (with the flag OFF after every kept
  change; ALSO run it flag-ON before proposing to make canvas the default):
  `npx playwright test --config packages/axoview-e2e/playwright.config.ts --project=chromium drag-collision undo-redo-cross-cutting undo-redo-dual-stack multi-select-drag z-order rectangle-overlap-zorder css-preview-mid-drag rename readable-labels`
- **Visual parity:** `.scratch/verify-scene.mjs` / `verify-labels.mjs` — capture
  canvas-mode vs DOM-mode and diff icon placement + label text/colour/scale. The
  `readable-labels` spec is the counter-scale guard; the `rename` spec is the F2
  inline-edit guard — both are why the hybrid keeps DOM for the editing node.
- **`baseline.md` is rewritten by EVERY run** incl. partial `PERF_N`/diagnostic —
  `git checkout -- perf-results/baseline.md` after any partial; only a clean FULL
  idle run updates it. (Profile modes skip the baseline write.)
- **Commit the decision log + results after every kept/reverted iteration** (one
  decision-log row per hypothesis, KR6). Conventional commits, lowercase subject
  (commitlint), footer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Kill stray `:3000` listeners between runs (`Get-NetTCPConnection -LocalPort 3000`
  → `Stop-Process`). Machine must be IDLE for spawn (calibration index flags drift).

## Suggested first moves (form your own from the trace, charter LOOP step 7)

1. **Profile the spawn node-subtree first** (`PERF_PROFILE=1000` / `PERF_CPUPROFILE=1000`)
   to confirm where the 283 ms goes (icon decode vs label layout vs React mount vs
   paint) — so the canvas draw targets the real cost, not a guess. The labels-off
   floor (175 ms) already says icons+rects dominate; confirm the icon-`<img>`-decode
   share, since an icon-bitmap cache is the cheapest big win.
2. **Spike the icon layer to canvas first** (draw cached icon bitmaps for
   `visibleItems`; leave labels in DOM) — the cheapest decoupling that should move
   the icon/rect floor. Measure spawn A/B. If it wins + stays correct, it validates
   the canvas machinery before the harder label-text + hybrid-edit work.
3. **Then static label text on canvas** (the ~108 ms label residual) with the
   counter-scale math ported to `ctx` transforms; keep DOM for the editing node.
4. Measure A/B at N=500/1000/2000; gate; visual-verify; write the finding. Present
   before deleting the DOM node renderer.

## Guardrails

- Reversible + measured + flagged; prove the win same-session A/B; keep the gate
  green; present the finding. Do NOT delete the DOM node renderer until the canvas
  path passes the full correctness gate in canvas mode.
- A faithful canvas that does NOT beat DOM beyond noise is a charter-worthy finding
  (architectural ceiling) — write it up, don't force it.
- **Harness caveat (from Iter 7):** the spawn metric does NOT route/paint connectors
  (bulk `model.set` bypasses `changeView`/`computePathsAsync`). Irrelevant for the
  node PoC (nodes ARE rendered), but if you later fold connector draw into the same
  canvas, first make the harness route connectors on spawn or the connector draw is
  measured as free.
