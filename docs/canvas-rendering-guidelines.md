# Axoview Canvas Rendering Guidelines

**Last updated:** 2026-07-08 (WebGL-fold productization, PR #63 — findings folded into rules)
**Status:** Living reference. Update when the render substrate evolves.
**Audience:** Anyone (or any agent) touching the GPU bulk layers, the sprite atlas, line-style geometry, or image export.

This is the fidelity contract for Axoview's GPU render substrate — the sibling of [ux-principles.md](ux-principles.md). Where ux-principles governs the *design language* of the UI, this governs the *pixels inside the canvas region*: how the WebGL2 bulk layers stay visually identical to true vector output, and the pitfalls that cost us a real bug each.

WebGL2 is the **sole** bulk substrate ([ADR 0038](adr/0038-webgl-instanced-render-substrate.md)) — there is no Canvas2D/DOM fallback. Everything the user sees at scale (nodes, labels, connectors, rectangles) is instanced textured quads drawn one `drawArraysInstanced` per layer, with the tile→screen transform computed in the vertex shader. That efficiency is why fidelity is subtle: a chip is a *cached texture*, not a per-frame re-raster, so sampling artifacts that a 2D canvas hid now show.

When in doubt, **mirror what already exists** in the reference implementations at the bottom, and remember the meta-rule (§11): **CI cannot see any of this** — every visual change needs a real-browser check.

Each numbered rule below is one hard-won finding: **symptom → root cause → rule.**

---

## 1. The atlas is a premultiplied-alpha pipeline — all four parts or none

**Symptom:** a dark grey ring around dotted-connector dots, and "two circles + a black-bordered rectangle" on dashed connectors. Every small sprite grew a dark fringe on its edges.

**Root cause:** the atlas stored *straight* alpha on a black, fully-transparent surround. Mip minification of a small sprite averages the coloured shape with black-transparent texels → a dark grey fringe on every edge.

**Rule:** rasterised sprites uploaded to a GPU atlas MUST use a **premultiplied** pipeline, end to end. All four pieces are load-bearing; any one missing re-introduces the fringe:

1. `premultipliedAlpha: true` on the context,
2. `gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)` before every upload,
3. `gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)` (premultiplied blend),
4. a fragment shader that outputs premultiplied colour: `tex * vec4(tint.rgb * tint.a, tint.a)`.

```glsl
// ✅ Correct — premultiplied output; reduces to identity for opaque tints,
//    composites correctly for translucent halos / fillOpacity.
outColor = tex * vec4(v_tint.rgb * v_tint.a, v_tint.a);

// ❌ Wrong — straight-alpha modulate on a black gutter → dark mip fringe.
outColor = tex * v_tint;
```

The tint math is exact: for an opaque tint (`a = 1`) it is the identity (chips, opaque icons unchanged); for a translucent tint it produces correct premultiplied compositing (halos, rectangle fill opacity). Image export is safe because `premultipliedAlpha: true` is the WebGL default that `toDataURL`/`dom-to-image-more` assume, and the export path composites via the browser's native `drawImage`/`toDataURL` — never raw `getImageData`/`readPixels` pixel math that would mis-read premultiplied data.

Reference: [`glSpriteBatch.ts`](../packages/axoview-lib/src/webgl/glSpriteBatch.ts) (`FRAG_SRC`, context attrs, `blendFunc`).

---

## 2. Never draw at the texture edge — inset content and UVs by a texel

**Symptom:** a chip's 1px border was present on the top/left but missing on the right/bottom corner.

**Root cause:** two edge effects compounded — a border stroked exactly at the texture boundary was clipped by the canvas bounds, AND the atlas's half-texel UV inset trimmed it asymmetrically.

**Rule (two halves):**

- **Rasterisation:** inset drawn content ≥1px from the raster edge. Never stroke a border at the texture boundary.
- **Sampling:** use a half-texel UV inset so `LINEAR` sampling at a sub-rect edge samples strictly *inside* the slot, never reaching the neighbouring gutter (the classic atlas seam). Origin nudged +½ texel, span shrunk by a full texel — symmetric, so no edge is favoured.

```ts
// ✅ Correct — half-texel inset, symmetric (atlasUVRect)
u0 = (x + 0.5) / atlasSize;   uS = (w - 1) / atlasSize;

// ❌ Wrong — samples the gutter at the far edge
u0 = x / atlasSize;           uS = w / atlasSize;
```

The inset math is extracted as the pure, unit-tested [`atlasUVRect`](../packages/axoview-lib/src/webgl/glSpriteBatch.ts); the ≥1px content inset lives in [`rasterizeNodeChip`](../packages/axoview-lib/src/webgl/itemRaster.ts) and `drawLabelChip`.

---

## 3. A DOM overlay sized to a canvas-measured chip must be `content-box`

**Symptom:** the inline label editor collapsed to one character per line.

**Root cause:** the library's `GlobalStyles` sets `div { box-sizing: border-box }`. An inline editor sized `minWidth = chipInnerWidth` under border-box has that width eaten by its own padding + border → content area ≈ one character.

**Rule:** any DOM overlay whose size mirrors a **canvas-measured** dimension must pin `boxSizing: 'content-box'`. Canvas `measureText` is content-space; the global border-box reset silently shrinks anything that trusts it.

```tsx
// ✅ Correct — the measured width IS the content width
sx={{ boxSizing: 'content-box', minWidth: chipInnerWidth }}

// ❌ Wrong — global border-box eats the width into padding+border
sx={{ minWidth: chipInnerWidth }}
```

Reference: `LabelInlineEditor` in [`LabelHitLayer.tsx`](../packages/axoview-lib/src/components/SceneLayers/Labels/LabelHitLayer.tsx).

---

## 4. Walk parametric geometry by integer index, never a float cursor

**Symptom:** `RangeError: Array buffer allocation failed` when applying a dashed/dotted border — a hard crash.

**Root cause:** the dash/dot walker advanced a float cursor by a variable step. Near a segment boundary the step rounded to ~0, and once the cursor was a few hundred px in, `cursor += tiny` was absorbed by float precision → the loop never advanced → the GPU staging `Float32Array` grew until it OOM'd.

**Rule:** walk parametric geometry by **integer index** (`k * spacing`), so it always advances; cap spans per segment as a backstop against a pathologically small period.

```ts
// ✅ Correct — integer index always advances (walkDots / walkDashes)
for (let k = kStart, n = 0; k * spacing <= segEnd; k++, n++) {
  if (n >= MAX_SPANS_PER_SEGMENT) break;
  emit(k * spacing - s);
}

// ❌ Wrong — float accumulation can stall → infinite loop → OOM
for (let cur = start; cur <= segEnd; cur += step) emit(cur);
```

Reference + unit tests: [`lineStyle.ts`](../packages/axoview-lib/src/webgl/lineStyle.ts), [`lineStyle.test.ts`](../packages/axoview-lib/src/webgl/__tests__/lineStyle.test.ts) (the "pathologically tiny spacing/period" cases pin this).

---

## 5. Authored widths are unprojected — scale every GPU stroke by the projection factor

**Symptom:** GPU strokes were ~1.22× too thick in isometric view (and inconsistent between connectors and rectangles).

**Root cause:** authored stroke widths are **unprojected tile-px** — the DOM scales them via `getProjectionCss`. The GPU drew them raw in **projected** scene space, skipping the ~0.816 iso factor.

**Rule:** scale every GPU stroke width by the projection's linear factor, measured once from a unit tile step:

```ts
// widthScale == the DOM's getProjectionCss scale — correct for iso AND 2D
const o0 = getTilePos({ tile: { x: 0, y: 0 } });
const o1 = getTilePos({ tile: { x: 1, y: 0 } });
const widthScale = Math.hypot(o1.x - o0.x, o1.y - o0.y) / UNPROJECTED_TILE_SIZE;
```

Measuring from `getTilePosition` (not a hard-coded iso constant) keeps connectors and rectangles consistent and correct if the projection ever changes. Reference: [`ConnectorsCanvas`](../packages/axoview-lib/src/components/SceneLayers/Connectors/ConnectorsCanvas.tsx) + [`RectanglesCanvas`](../packages/axoview-lib/src/components/SceneLayers/Rectangles/RectanglesCanvas.tsx).

---

## 6. Sheared sprites soften — anisotropic filtering is a mitigation, not a cure

**Symptom:** every chip/line/dot looked fuzzy in isometric but crisp in 2D.

**Root cause:** in iso, each quad is a **sheared** parallelogram; isotropic mip/linear filtering blurs along the shear axis.

**Rule:** enable anisotropic filtering (`EXT_texture_filter_anisotropic`) on any atlas sampled through a non-axis-aligned transform — it sharpens sheared sampling materially. But **know it is a mitigation, not a cure**: the ceiling is fundamental to rasterised sprites. The crisp fix is geometry/SDF, not filtering (see §12).

Reference: `aniso` setup in [`glSpriteBatch.ts`](../packages/axoview-lib/src/webgl/glSpriteBatch.ts).

---

## 7. Tint white for baked light outlines; arbitrary tint only for flat sprites

**Symptom:** connector arrowheads were invisible on dark lines.

**Root cause:** the arrow sprite bakes a white outline. A `(0,0,0,1)` tint multiplied that outline to black, erasing it on dark connectors.

**Rule:** a sprite that bakes a light outline (arrows, rings) must be tinted white `(1,1,1,1)` so its own colours survive. Only a **flat-colour** sprite (the `white` texel, the `dot`) may take an arbitrary tint.

```ts
// ✅ Correct — baked-outline sprite keeps its own colours
addSprite(..., arrowUV, 1, 1, 1, 1, 0);

// ❌ Wrong — a black tint zeroes the baked white outline
addSprite(..., arrowUV, 0, 0, 0, 1, 0);
```

Reference: arrow emission in [`ConnectorsCanvas`](../packages/axoview-lib/src/components/SceneLayers/Connectors/ConnectorsCanvas.tsx).

---

## 8. Projection is a geometry-rebuild dependency — DOM hit-proxy and GPU paint share it

**Symptom:** a floating label became unselectable after switching 2D ↔ iso — the visible chip and its clickable hit-area separated.

**Root cause:** the geometry-rebuild effect omitted `strategy.projectionName`, so the GPU chip kept the *old* projection's position while the DOM hit-proxy moved to the new one.

**Rule:** any GPU layer whose geometry is tile→scene **projected** must list `strategy.projectionName` in its rebuild deps (mirror `NodesCanvas`). A DOM hit-proxy and its GPU paint must share **one** projection, or they drift apart — a hybrid-boundary invariant (ADR 0038 §2).

Reference: rebuild-effect deps in [`LabelsCanvas`](../packages/axoview-lib/src/components/SceneLayers/Labels/LabelsCanvas.tsx) / [`NodesCanvas`](../packages/axoview-lib/src/components/SceneLayers/Nodes/NodesCanvas.tsx).

---

## 9. Clamp the backing store, and feed the effective dpr through the whole render path

**Symptom (latent):** a very-high-DPI large viewport pushes `W · dpr` past the browser's max canvas dimension / area cap, and the browser hands back a blank or failed GL surface.

**Root cause:** the backing store `bw/bh = W·dpr × H·dpr` was uncapped.

**Rule:** clamp the backing store against the canvas caps and treat `dpr` as the export path treats its scale multiplier — reduce it to the largest value that fits, degrading *resolution* rather than blanking. Crucially, the **effective dpr feeds the entire render path** — the backing-store size AND the `zoom·dpr` view scale AND the device origin `(W/2 + scroll)·dpr` — or the scene and its buffer desync (the CSS canvas stays `W×H`, so a smaller buffer just upscales).

```ts
// ✅ Correct — one effective dpr, used everywhere downstream
const { width: bw, height: bh, dpr } = computeBackingStore(W, H, window.devicePixelRatio || 1);
const originXDev = (W / 2 + scroll.x) * dpr;
b.render(bw, bh, zoom * dpr, originXDev, originYDev, counterScale);

// ❌ Wrong — clamp bw/bh but leave zoom·dpr / origin on the raw dpr → desync
```

There must be exactly **one** backing-store computation per layer, and it must be the clamped one — don't leave an unclamped `round(W*dpr)` lying around for a future reader to wire up. Reference: [`computeBackingStore`](../packages/axoview-lib/src/utils/renderTarget.ts), wired into all four bulk layers.

---

## 10. Rebuild geometry only on a scene change — never per frame

**Symptom (would-be regression):** frame time climbs with N during pan/zoom.

**Root cause:** doing per-node CPU work (`buildInstances`) inside the per-frame draw.

**Rule:** `buildInstances` runs only on a scene/geometry change or an LOD-band crossing. Pan/zoom is **one uniform write + one draw call** — no per-frame CPU loop over N. The harness pins this machine-checkably: `data-build-count` must stay flat across a pan (ADR 0038 §5). Any change that rebuilds geometry per frame is a regression, even if it looks correct.

Reference: `drawGLBatch` vs `buildInstances` split in every `*Canvas.tsx`; anti-cheat in the perf harness (ADR 0020, amended).

---

## 11. CI is pixel-blind — every visual change needs a real-browser check

**Symptom:** none of findings §1–§8 could be caught by the test suite.

**Root cause:** jsdom has no WebGL2, and headless Chrome falls back to SwiftShader (software) — pixels never render in CI. The perf anti-cheat can only gate **structure** (`dataset.drawCount` == committed count), not appearance.

**Rule:**

- Green CI is **not** visual confirmation. Every visual GPU change is handed to the owner for a real-browser screenshot check.
- Gate what *is* machine-checkable: pure geometry (walkers, UV math, backing-store clamp — all unit-tested), the no-per-frame-CPU invariant, and draw-count structure.
- When profiling, log `[perf] WebGL renderer:` and force a real GPU — SwiftShader numbers are meaningless.

```ts
// ✅ Correct — extract the pure math out of the GL closure so CI can test it
export const atlasUVRect = (x, y, w, h, atlasSize) => ({ /* … */ });

// ❌ Wrong — bury bug-prone math in createSpriteBatch, untestable without a GPU
```

---

## 12. Crisp iso line rendering — the open frontier

Lines/dots/borders are the least crisp thing in iso. A line/dash *body* is a solid `white`-texel parallelogram whose long edges **alias** (the context is `antialias:false`); a dot/round-cap/chip-border is a **sampled sprite** that softens under filtering (§6). A *selected* connector looks crisp only because it is drawn by the DOM `<Connector>` SVG overlay (true vector) — the GPU bulk is not there yet.

Evaluated fixes:

- **MSAA (`antialias:true`)** — **rejected.** MSAA multisamples *geometry-edge coverage*. It does nothing for the sampled-sprite case (the feature is inside the quad, produced by texture fetch), and gives only an uncontrolled partial improvement on the solid-quad edges — at a real fill-rate cost. Wrong tool.
- **Analytic edge-AA on real geometry** — **recommended.** Expand each stroke quad by a small feather, carry the perpendicular distance-from-centreline as a varying, and `smoothstep` the alpha against the true half-width in the fragment shader. `fwidth()` makes the feather ≈1 screen px at **any** zoom/shear. This is the deck.gl / Mapbox line technique. It reuses the existing single-atlas instanced batch — one shader branch + a couple of spare per-instance floats — so it is incremental, not a rewrite.
- **SDF (signed distance field) textures** — crisp at arbitrary scale/shear too, but needs offline SDF generation per shape and is a bigger upfront lift. Better only if we later need arbitrary vector *glyphs/shapes*; overkill for straight strokes + discs.

**Recommendation: analytic edge-AA**, because straight strokes and circular caps have closed-form distance functions (no texture needed at all), and it grafts onto the current batch with minimal surface area. SDF is the escalation path if shape complexity grows.

**Prototype (geometry half, shipped + unit-tested; shader half specified, not yet wired):**
[`buildAaLineQuad`](../packages/axoview-lib/src/webgl/lineStyle.ts) fattens `segment()`'s parallelogram by `feather` on each perpendicular side and reports the true `halfWidth`, so a distance-field fragment ramp has room to feather. The companion shader:

```glsl
// vertex — pass the signed perpendicular distance in SCENE units.
//   i_misc = (counterScaleFlag, shapeMode, halfWidth, halfExtent)
//   q.y ∈ [0,1] across the fat quad; centre is 0.5.
v_sd = (q.y - 0.5) * (i_misc.w * 2.0);   // scene-space distance from centreline

// fragment — controlled ~1px feather at any zoom/shear; no texture sampling.
float d  = abs(v_sd);
float aa = fwidth(d);                                  // scene units per screen px
float cov = 1.0 - smoothstep(u_halfWidth - aa, u_halfWidth + aa, d);
outColor = vec4(v_tint.rgb * v_tint.a, v_tint.a) * cov;
```

A disc (dots/round caps) is the same idea with a radial distance (`length(q - 0.5)` thresholded at `0.5`), replacing the `dot` sprite entirely. **Wiring the shader branch is a real-browser-verified follow-up** (§11) — the geometry and the recommendation are here; the pixels are the owner's to confirm.

---

## Deferred ADR 0038 items

Live status of the follow-ups scoped in [ADR 0038 §Deferred](adr/0038-webgl-instanced-render-substrate.md), reconciled here as they close:

| Item | Status |
|---|---|
| Premultiplied-alpha mip fringing (§1) | **Accepted.** Owner-verified on dashed/dotted; the pipeline is uniform across all sampled surfaces (one shader, one blend), the tint math reduces to identity for opaque tints, and export composites via native `toDataURL` (no raw premult readback). No colour/export regression by construction. |
| Backing-store viewport clamp (§9) | **Done.** `computeBackingStore` wired into all four bulk layers; the effective dpr feeds the whole render path. |
| WebGL unit tests (line walkers + atlas UV) | **Done.** No ts-jest blocker existed for pure `webgl/` files; the atlas-UV math was extracted (`atlasUVRect`) out of the GL closure so it is testable. See `webgl/__tests__`. |
| Export Renderer context teardown on dialog close | **Deferred.** Still ~8 live GL contexts vs a ~16 cap; tearing down the hidden export Renderer's contexts on close is unchanged. Out of scope here (touches the export lifecycle, needs its own verification). |
| Rounded-rectangle corners on the bulk | **Deferred (out of scope).** Still approximated (sharp). A natural fit for the §12 analytic-AA/SDF work once that lands. |
| Adaptive/lazy atlas + `sampler2DArray` | **Deferred (out of scope).** Today's graceful `atlasFull` degradation stands; only unbounded distinct-chip scenes need this. |
| Context-loss recovery | **Done (prior PR).** `webgl/contextLoss.ts`; manual `WEBGL_lose_context` smoke still recommended. |

---

## Reference implementations

When building or debugging a GPU layer, **read these first**:

| Concern | Reference file |
|---|---|
| Atlas, blend, aniso, context attrs, premultiplied shader | [`glSpriteBatch.ts`](../packages/axoview-lib/src/webgl/glSpriteBatch.ts) |
| Line-style walkers + analytic-AA prototype | [`lineStyle.ts`](../packages/axoview-lib/src/webgl/lineStyle.ts) |
| Chip rasterisation (content inset, supersample) | [`itemRaster.ts`](../packages/axoview-lib/src/webgl/itemRaster.ts) |
| Context-loss recovery | [`contextLoss.ts`](../packages/axoview-lib/src/webgl/contextLoss.ts) |
| Backing-store / export scale clamp | [`renderTarget.ts`](../packages/axoview-lib/src/utils/renderTarget.ts) |
| The canonical bulk layer (build vs draw split, projection deps) | [`NodesCanvas.tsx`](../packages/axoview-lib/src/components/SceneLayers/Nodes/NodesCanvas.tsx) |
| Projection-scaled widths + line-styles | [`ConnectorsCanvas.tsx`](../packages/axoview-lib/src/components/SceneLayers/Connectors/ConnectorsCanvas.tsx) |
| Unit-testable pure math (the CI-visible surface) | [`webgl/__tests__`](../packages/axoview-lib/src/webgl/__tests__) · [`renderTarget.test.ts`](../packages/axoview-lib/src/utils/__tests__/renderTarget.test.ts) |

---

## When this document is wrong

It's a snapshot of what the GPU fold taught us, not a law. If a rule here contradicts something the owner just verified in a real browser — the browser wins (§11). Update this doc afterwards as part of wrap-up so the finding isn't relearned. If you deliberately break a rule, leave a short note in [ADR 0038](adr/0038-webgl-instanced-render-substrate.md) explaining why.
