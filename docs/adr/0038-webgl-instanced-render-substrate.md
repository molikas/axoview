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
- selected node + drag set (`hybridNodes` → DOM `<Nodes>`), for F2 inline-rename
  and the drag preview;
- selected connector (single `itemControls` **and** every multi-selected
  `selectedIds` connector — a lasso selects into `selectedIds`), degenerate
  1-tile connectors (dot cue), and unroutable connectors (error badge)
  (`connectorHybridIds` → DOM `<Connectors>`);
- the dragged rectangle (`rectHybridIds` → DOM `<Rectangles>`);
- the selected connector's labels (F2/inline-edit) and the inline-edited text box.

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

- **WebGL context-loss recovery.** No `webglcontextlost`/`webglcontextrestored`
  handling yet. On a GPU reset (tab reclaim, driver crash) the GL layers go blank
  until remount. Fix: `preventDefault` on loss + rebuild atlas/program/VAO/VBO on
  restore (needs refactoring `createSpriteBatch` init into a rebuildable closure).
- **GPU dashed/dotted/double-line connectors.** `style` (DASHED/DOTTED) and
  `lineType` (DOUBLE/DOUBLE_WITH_CIRCLE) are not yet emitted by
  `ConnectorsCanvas`; an unselected styled connector draws as a solid single line
  (selecting it promotes it to the correctly-rendered DOM `<Connector>`). Owner
  decision: implement on the GPU (mirror `<Connector>`'s strokeDashArray +
  offset-path geometry), not route back to the DOM. Needs visual verification.
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

## §7 — Relationship to ADR 0019

ADR 0019 remains the record of *why* the bulk moved off DOM/SVG and of the
DOM-hybrid + export invariants. This ADR supersedes only its **substrate**
decision: Canvas2D is no longer a rung at all (the fallback was removed), and
WebGL2 is the sole bulk substrate. ADR 0019 is marked "Superseded by: ADR 0038
(bulk substrate only)".
