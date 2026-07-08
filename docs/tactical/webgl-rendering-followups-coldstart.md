# WebGL rendering — guidelines + deferred follow-ups (cold-start prompt)

**Created:** 2026-07-08 (WebGL-fold shake-out, PR #63 / branch `integration`)
**Status:** Work brief. The three tasks below are unstarted; the findings in Task 1
are the durable record of what this session troubleshot.
**Audience:** the next agent/session that picks up canvas rendering work.

This doc has two jobs: (1) preserve the WebGL rendering findings from the fold so
they aren't lost, and (2) carry the copy-paste **cold-start prompt** that kicks off
the follow-up work. Paste the fenced block at the bottom into a fresh session.

---

## Why this exists

WebGL2 is now the **sole** render substrate (ADR 0038, PR #63) — Canvas2D fallback
removed. Folding the bulk layers (nodes, labels, connectors, rectangles) onto the
GPU surfaced a cluster of **rendering-fidelity** bugs that are distinct from the
UI/UX design-language concerns in [ux-principles.md](../ux-principles.md). They
deserve their own durable "pitfalls & rules" doc so we don't relearn them, and the
remaining deferred ADR 0038 items should be cleared.

---

## Session findings (raw material for the guidelines doc)

Each is **symptom → root cause → rule**. These are what we actually hit.

1. **Dark ring / "bubbles" / grey border on dots + dash-caps (premultiplied vs straight alpha).**
   The atlas stored *straight* alpha on a black, fully-transparent surround. Mip
   minification of a small sprite averages the coloured shape with black-transparent
   → a dark grey fringe on every edge; on dotted/dashed connectors it read as a grey
   ring around each dot and "two circles + a rectangle with black borders" on dashes.
   → **Rule:** rasterised sprites uploaded to a GPU atlas MUST use a premultiplied
   pipeline: `premultipliedAlpha:true` context, `UNPACK_PREMULTIPLY_ALPHA_WEBGL`,
   `blendFunc(ONE, ONE_MINUS_SRC_ALPHA)`, and a shader that outputs
   `tex * vec4(tint.rgb*tint.a, tint.a)`. Straight alpha + a black gutter fringes.
   (Fixed this session, commit `1ec42b0`.)

2. **Partial grey border on chips (atlas half-texel UV inset + edge clipping).**
   A 1px chip border stroked exactly at the texture edge was clipped by the canvas
   bounds AND trimmed asymmetrically by the atlas's half-texel UV inset → border
   present on some sides, missing on right/corner.
   → **Rule:** inset drawn content ≥1px from the raster edge; never stroke at the
   texture boundary. (Fixed in `drawLabelChip` + `rasterizeNodeChip`, commit `c452ec1`.)

3. **Inline editor collapsed to one char/line (global `border-box` vs measured widths).**
   `GlobalStyles` sets `div { box-sizing: border-box }`. An inline editor sized with
   `minWidth = chipInnerWidth` under border-box has that width eaten by padding +
   border → content area ≈ one character → text wraps a letter per line.
   → **Rule:** any DOM overlay whose size mirrors a **canvas-measured** chip must pin
   `boxSizing: 'content-box'` (canvas measureText is content-space), or the global
   reset silently shrinks it. (Fixed in `LabelHitLayer`'s `LabelInlineEditor`.)

4. **`RangeError: Array buffer allocation failed` applying a dashed/dotted border (float-cursor non-advancement).**
   The dash/dot walker advanced a float cursor by a variable step that rounded to ~0
   at segment boundaries; once the cursor was large, `cursor += tiny` was absorbed by
   float precision → infinite loop → the GPU staging Float32Array grew until it OOM'd.
   → **Rule:** walk parametric geometry by **integer index** (`k*spacing`), never by
   accumulating a float delta; cap spans per segment as a backstop. (Fixed in
   `webgl/lineStyle.ts` — `walkDots` / `walkDashes` — commit `d4271bb`, hardened after.)

5. **GPU strokes ~1.22× too thick in iso (unprojected widths in projected space).**
   Authored widths are **unprojected tile-px** (the DOM scales them via
   `getProjectionCss`); the GPU drew them raw in **projected** scene space, skipping
   the ~0.816 iso factor.
   → **Rule:** scale every GPU stroke width by the projection's linear factor,
   measured from `getTilePosition` (`hypot` of a unit tile step / `UNPROJECTED_TILE_SIZE`),
   so widths match the DOM and are consistent across connectors + rectangles.
   (Fixed in `ConnectorsCanvas` + `RectanglesCanvas`, commit `d4271bb`.)

6. **Sheared sprites blur in iso (isotropic filtering of a sheared quad).**
   Every chip/line/dot samples a **sheared** quad in iso; isotropic mip/linear
   filtering blurs along the shear. Anisotropic filtering
   (`EXT_texture_filter_anisotropic`) sharpens it materially but not fully — the
   ceiling is fundamental to rasterised sprites. The deep fix is geometry/SDF (Task 3).
   → **Rule:** enable anisotropic filtering on any atlas sampled through a non-axis-
   aligned transform; know it's a mitigation, not a cure. (Aniso added in `c452ec1`.)

7. **Arrowheads invisible on dark lines (black tint zeroed a baked-white outline).**
   The arrow sprite bakes a white outline; a `(0,0,0,1)` tint multiplied it to black,
   erasing the outline on dark connectors.
   → **Rule:** a sprite with a baked light outline must be tinted white `(1,1,1,1)`;
   only flat-colour sprites take an arbitrary tint. (Fixed in `ConnectorsCanvas`.)

8. **Floating label unselectable after a 2D↔iso switch (missing effect dep).**
   `LabelsCanvas`'s geometry-rebuild effect omitted `strategy.projectionName`, so the
   GPU chip kept the old projection's position while the DOM hit-proxy moved to the
   new one — the visible chip and its clickable div separated.
   → **Rule:** any GPU layer whose geometry is tile→scene **projected** must list
   `strategy.projectionName` in its rebuild deps (mirror `NodesCanvas`). A DOM
   hit-proxy and its GPU paint share one projection or they drift. (Fixed in `c452ec1`.)

9. **CI can't see any of this.** jsdom has no WebGL2 and headless Chrome falls back to
   SwiftShader (software), so pixels never render in CI. The perf anti-cheat can only
   gate **structure** (`dataset.drawCount` == committed count), not appearance.
   → **Rule:** every visual GPU change needs a **real-browser** check (owner
   screenshots). Don't treat green CI as visual confirmation. Log
   `[perf] WebGL renderer:` and force a real GPU when profiling.

---

## Deferred ADR 0038 items (bundle these with the guidelines work)

From [ADR 0038 §Deferred](../adr/0038-webgl-instanced-render-substrate.md):

- **Premultiplied-alpha fringing — IMPLEMENTED this session (`1ec42b0`).** Dashed/
  dotted verified good by owner; confirm no colour/transparency regression on chips,
  translucent rectangle fills, icons and image-export, then flip the ADR entry to done.
- **Backing-store viewport clamp.** `bw/bh = W·dpr` isn't clamped against
  `MAX_VIEWPORT_DIMS` / max canvas area. Helper (`webgl/renderTarget.ts`) exists but is
  wired only to export — wire it to all four bulk layers.
- **Export Renderer context teardown on dialog close.** ~8 live GL contexts per session
  vs a ~16 browser cap; tear down the hidden export Renderer's contexts on close.
- **WebGL unit tests.** Resolve the ts-jest transform blocker for
  `packages/axoview-lib/src/webgl/__tests__/` so `webgl/` gets unit coverage
  (context-loss rebuild, `lineStyle` walkers, atlas UV math).
- **Rounded-rectangle corners on the bulk** are still approximated (sharp).
- **Adaptive/lazy atlas + `sampler2DArray`** for unbounded distinct-chip scenes
  (today: graceful `atlasFull` degradation).

---

## New item this session: crisp iso line rendering

Lines/dots/borders are rasterised sprites; sheared in iso they soften even with
anisotropic filtering (finding #6). A *selected* connector is crisp only because it's
drawn by the DOM `<Connector>` SVG overlay (true vector). Evaluate the standard
GPU-vector techniques and pick one:

- **MSAA** (`antialias:true` context attr) — cheap, but only anti-aliases quad edges,
  not the thin feature *inside* the quad. Expected to NOT fix this. Confirm/reject fast.
- **Analytic edge-AA on real geometry** — expand each polyline to a triangle strip and
  compute distance-to-edge in the fragment shader (`smoothstep` the alpha). deck.gl /
  Mapbox line approach. Crisp at any zoom/shear.
- **SDF (signed distance field)** line/shape textures — Valve/Mapbox technique; crisp at
  arbitrary scale + shear, cheap to sample. Best long-term fit; more upfront work.

Prototype behind the existing `webgl/lineStyle.ts` abstraction; verify in a real browser.

---

## Working notes for the next session

- Branch `integration`. Lib build: `cd packages/axoview-lib && npm run build`
  (there is no `build:lib`). Gates: `tsc`, `jest`, `eslint`.
- Real-browser visual verification is **owner-driven** (screenshots). CI is pixel-blind.
- `git` from repo root or use `git -C /c/mytemp/axoview …`; a persisted `cd` into the
  lib dir doubles relative paths.
- Commitlint: lowercase, non-sentence-case subject (`feat(canvas): …`).
- Key files: `webgl/glSpriteBatch.ts` (atlas, blend, aniso, context attrs),
  `webgl/lineStyle.ts` (walkers), `webgl/contextLoss.ts`, `webgl/renderTarget.ts`
  (clamp helper), `components/SceneLayers/{Connectors,Rectangles,Labels,Nodes}/*Canvas.tsx`,
  `utils/labelChip.ts` + `webgl/itemRaster.ts` (chip raster), `components/.../WebGLUnsupportedScreen`.

---

## Cold-start prompt (paste into a fresh session at repo root)

```
We're on branch `integration`. WebGL2 is now the sole render substrate (ADR 0038,
PR #63). Read docs/tactical/webgl-rendering-followups-coldstart.md end to end — it
holds the findings, the deferred list, and the reference files. Then do three things,
committing each with a lowercase conventional-commit subject:

1. Author docs/canvas-rendering-guidelines.md — a sibling to docs/ux-principles.md
   covering GPU rendering fidelity. Turn the 9 "session findings" into concise
   symptom → root cause → rule entries. Cross-link it from ADR 0038 and add a one-line
   pointer from ux-principles §8 (canvas region). Match ux-principles.md's tone and
   structure (numbered rules, ✅/❌ where it helps, reference-file links).

2. Clear the deferred ADR 0038 items in the doc's "Deferred ADR 0038 items" section:
   flip premultiplied-alpha to Accepted once you've confirmed no colour/export
   regression; wire the renderTarget.ts viewport clamp into all four bulk layers;
   resolve the ts-jest blocker and add webgl/ unit tests (lineStyle walkers + atlas UV).
   Do the cheaper/safer ones first; leave the atlas-array + rounded-corner items
   deferred if out of scope, but say so.

3. Investigate crisp iso line rendering (the doc's "crisp iso line rendering" section):
   quickly confirm/reject MSAA, then prototype analytic edge-AA or SDF line geometry
   behind webgl/lineStyle.ts. Recommend one with a short trade-off note.

Remember: WebGL doesn't render in CI (jsdom/SwiftShader) — gate structure only and
hand visual changes to the owner for a real-browser screenshot check. Build the lib
with `cd packages/axoview-lib && npm run build`.
```
