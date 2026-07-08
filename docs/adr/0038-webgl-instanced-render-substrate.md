# ADR 0038 — WebGL2 Instanced GPU Render Substrate (T4)

**Status:** Accepted (shipped with the WebGL-fold productization, PR #63)
**Date:** 2026-07-08
**Supersedes:** ADR 0019 (Canvas2D node render layer) — as the *bulk substrate* only; see §7
**Related:** ADR 0020 (perf harness — amended same day, GPU draw-count anti-cheat), ADR 0015/0024 (label legibility/positioning — now computed in the vertex shader), ADR 0025 (image export — depends on `preserveDrawingBuffer`), ADR 0008 (surface vocabulary — the unsupported-browser *Screen*)

## Context

ADR 0019 made Canvas2D the bulk node-render substrate and explicitly named a
future **T4 = WebGL instanced** rung (ADR 0020 tier ladder) for sustaining
thousands of moving entities. That rung has now shipped: `glSpriteBatch`
(instanced, single-atlas WebGL2) renders nodes, labels, connector bodies and
rectangle bodies as **one `drawArraysInstanced` per layer per frame**, with the
tile→screen transform (isometric shear + label counter-scale) computed in the
vertex shader. Geometry uploads **once per scene change**; pan/zoom is one
uniform update. Result: navigation is **O(1) on the CPU at any N**.

Measured (real GPU, AC power, all-element-types pan — N nodes + ~N connectors
each with 3 labels + grouping rectangles + floating labels):

| N | before (all DOM/Canvas2D) | after (all GPU) |
|---|---|---|
| 1000 | 22.8 ms | **16.67 ms (60 fps)** |
| 2000 | 45.5 ms (653 ms long-tasks) | **16.67 ms** |
| 5000 | ~100 ms+ | **16.67 ms** |

Every "after" cell reports `noCPU-rebuild=true` + `longtask=0` (see §5).

This ADR records the load-bearing contracts of the substrate — the things a
future contributor will otherwise re-derive or violate.

## Decision

**1. WebGL2 is the sole bulk render substrate.** There is no Canvas2D/DOM
bulk fallback. A browser without a working WebGL2 batch is shown the
`WebGLUnsupportedScreen` gate (a *Screen* per ADR 0008), rendered by `Renderer`
when `isWebGL2Supported()` is false, rather than a silent blank canvas or a
slow DOM path. This is the Lucid-app model: WebGL2 is a hard requirement.
(The prior Canvas2D bulk fallback and the `__axoviewNoGpuFold` A/B knob were
removed as dead code in the same change.)

**2. DOM/GPU hybrid boundary.** The GPU draws the bulk; the DOM keeps only a
**sparse hybrid** — this is an interaction/editing layer, NOT a fallback, and it
coexists with the GPU permanently:
- selected node + drag set **+ the name-label-drag node** (`hybridNodes` → DOM
  `<Nodes>`), for F2 inline-rename, the drag preview, and the label-as-handle drag;
- selected connector (single `itemControls` **and** every multi-selected
  `selectedIds` connector — a lasso selects into `selectedIds`), degenerate
  1-tile connectors (dot cue), and unroutable connectors (error badge)
  (`connectorHybridIds` → DOM `<Connectors>`);
- the dragged rectangle (`rectHybridIds` → DOM `<Rectangles>`);
- **all** connector labels (`<ConnectorLabels>` over the full visible set — there
  is no GPU connector-label layer), and the inline-edited text box.

**3. Picking stays geometric.** All hit-testing is `getItemAtTile` over scene
data (`hitConnectors`/rectangles/nodes), never GPU readback. Removing a visible
element from the DOM must never change what is selectable.

**4. Export depends on `preserveDrawingBuffer: true`.** The GL context is
created with `preserveDrawingBuffer: true` so `dom-to-image-more` can capture the
drawn layer via `canvas.toDataURL()`/`drawImage` (ADR 0025). This costs some
frame throughput (the browser cannot fast-swap/discard the buffer) but is
required for image export to include GPU-painted content. Non-negotiable.

**5. No per-frame CPU geometry work (folded from `no-cpu-work-check.md`).**
`buildInstances` runs only on a scene/geometry change or an LOD-band crossing —
never during pan/zoom. The harness asserts this machine-checkably via each
canvas's `data-build-count` staying flat across a pan (`buildDelta === 0` in
`measurePan`). Any change that rebuilds geometry per frame is a regression.

**6. Fidelity trade — texture-atlas chip cache.** Node/label chips are
rasterised by Canvas2D (`itemRaster`) into a content-keyed atlas at
`CHIP_SUPERSAMPLE`×dpr, then sampled through mipmaps. Glyphs stay crisp to ~2×
zoom-in and clean (mip-minified) when zoomed out; beyond ~2× zoom-in they
soften — the one fidelity trade vs the old per-frame Canvas2D re-raster.
Effective dpr is **clamped at 2** for chip rasterisation (a 3× screen would
otherwise rasterise at 6× = 36× area). The node atlas is **8192²**, capped to
**4096²** (~67 MB vs ~268 MB) on high-DPR/mobile (`devicePixelRatio ≥ 2`), and
clamped to `MAX_TEXTURE_SIZE`. Backing-store dimensions are the caller's concern
(see the deferred viewport clamp, §Deferred).

## Deferred (recorded, not yet shipped)

These were scoped in the productization audit and deliberately deferred; each is
a follow-up, not a silent gap:

- **WebGL context-loss recovery — IMPLEMENTED 2026-07-08 (this PR).** All four GPU
  layers now `preventDefault` on `webglcontextlost` (so the browser is allowed to
  restore) and rebuild their `SpriteBatch` on `webglcontextrestored` — fresh
  atlas/program/VAO/VBO via a new `createSpriteBatch`, with `ConnectorsCanvas` also
  re-packing its captured arrow-sprite UV — through the shared
  [`webgl/contextLoss.ts`](../../packages/axoview-lib/src/webgl/contextLoss.ts)
  helper. Draw-only: scene/model state is untouched (picking is geometric per §3),
  so no user work is lost across a loss/restore cycle. **Not exercisable in CI**
  (jsdom has no WebGL2; the perf/e2e suites can't force a loss) — verify with a
  manual `WEBGL_lose_context` smoke, and add a unit test once the `webgl/` ts-jest
  transform blocker (Test follow-ups) is resolved. The probe-vs-`createSpriteBatch`
  capability gap (below) still yields a *first-paint* blank on a browser that
  advertises WebGL2 but fails shader/link/atlas-alloc; that path now emits a
  `console.warn` per layer rather than being fully silent.
- **GPU connector/rectangle line-styles — IMPLEMENTED 2026-07-08 (this PR;
  pending visual verification).** `ConnectorsCanvas` now emits the full DOM
  matrix: `style` DASHED/DOTTED (dash-walked via the shared
  [`webgl/lineStyle.ts`](../../packages/axoview-lib/src/webgl/lineStyle.ts)) and
  `lineType` DOUBLE / DOUBLE_WITH_CIRCLE (two offset polylines + a mid-path ellipse
  ring), mirroring `<Connector>`'s strokeDashArray + offsetPaths geometry.
  `RectanglesCanvas` gained dashed/dotted borders the same way. **Width fidelity
  fix (same change):** all bulk stroke widths are now scaled to scene space by the
  projection's linear factor (measured from `getTilePosition`; the DOM's authored
  widths are unprojected tile-px scaled by `getProjectionCss`), so GPU strokes are
  no longer ~1.22× too thick in iso, and are consistent across connectors and
  rectangles. The connector arrow now draws with a `(1,1,1,1)` tint so its baked
  white outline survives (a black tint had blacked it out, hiding it on dark
  lines). Rounded rectangle corners remain approximated (sharp) on the bulk.
- **Premultiplied-alpha mip fringing.** The atlas stores straight alpha; mip
  minification can pull a faint dark halo into anti-aliased edges when zoomed out.
  Fix (premultiply on upload + `blendFunc(ONE, ONE_MINUS_SRC_ALPHA)`, or edge-
  dilate the chip gutter) risks a broader color regression and needs pixel-diff
  verification before shipping.
- **Backing-store viewport clamp.** `bw/bh = W·dpr` is not yet clamped against
  `MAX_VIEWPORT_DIMS` / max canvas area; a very-high-DPI large viewport could
  exceed the cap. A clamp helper exists (`renderTarget.ts`) but is wired only to
  export.
- **Adaptive/lazy atlas + `sampler2DArray`** for unbounded distinct-chip scenes
  (current: graceful `atlasFull` degradation).

## Consequences

- Browsers without WebGL2 (a small minority; SwiftShader covers most GPU-less
  machines) get the gate Screen instead of a diagram. Accepted per the hard-
  requirement decision.
- ADR 0019's core claim ("Canvas2D is the default and sole bulk substrate") is
  now false; it is superseded here for the substrate decision. Its still-valid
  rules (the DOM-hybrid rationale, HTML-entity decode, the `data-all-icons-drawn`
  export gate) are retained — `NodesCanvas` still publishes them.
- The perf-harness anti-cheat now reads GPU draw-counts (`dataset.drawCount`), not
  DOM element counts (ADR 0020, amended).
- **GL context budget.** Each mounted `Renderer` opens four WebGL2 contexts (one
  per bulk layer); image-export mounts a *second* hidden `Renderer` (ADR 0025), so
  a session can hold ~8 live contexts against the browser's ~16 cap. The capability
  probe (`isWebGL2Supported`) now releases its own context immediately
  (`WEBGL_lose_context`, 2026-07-08) so it no longer leaks a persistent extra;
  tearing down the export Renderer's contexts on dialog close remains a follow-up.
  Reaching the cap force-loses the oldest context — now recovered by the
  context-loss handling above rather than blanking permanently.

## §7 — Relationship to ADR 0019

ADR 0019 remains the record of *why* the bulk moved off DOM/SVG and of the
DOM-hybrid + export invariants. This ADR supersedes only its **substrate**
decision: Canvas2D is no longer a rung at all (the fallback was removed), and
WebGL2 is the sole bulk substrate. ADR 0019 is marked "Superseded by: ADR 0038
(bulk substrate only)".
