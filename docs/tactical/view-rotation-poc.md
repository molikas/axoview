# Horizontal view rotation (turntable) — POC hand-off

> **2026-10-03 — no longer the plan.** The productization plan is [view-rotation.md](view-rotation.md), and the decisions are [ADRs 0049–0051](../adr/0049-view-rotation-camera-and-projection-model.md). Keep this file as the walkthrough of the POC code in the working tree (§2–§4). Its §6 risk list, §8 decisions and §9 plan are superseded by those docs, and owner decisions overrode several of them. The angle is free (§8.1), persisted as an explicit per-page default (§8.2), and exported as viewed with the default selectable (§8.3). Delete this file together with `view-rotation.md` at wrap.

**Status:** POC working locally, **uncommitted**, on branch `feat/view-rotation-poc` based on `origin/master` at `731a6c9` (2026-09-30). It was first built against `integration`'s four-canvas renderer and then **ported** onto master's unified `SceneCanvas` + `renderedGeometry` (§3). Not an ADR yet — this doc is the brief for productizing it.
**Date:** 2026-09-30
**What it is:** rotate the isometric ground plane about the vertical axis (like orbiting a camera around the diagram), limited to the horizontal plane. No tilt, no 3D.
**Next step:** `/feature start view-rotation` → ADR (see [§9](#9-suggested-productization-plan)). On master the next free ADR number is `0049`, but `integration` carries unshipped ADRs that reuse `0045`–`0047`, and `lint:docs` does not catch duplicate numbers — check before choosing.

---

## 1. What the user gets

| Control | Behaviour |
|---|---|
| **Dock widget** (bottom dock, left of the zoom controls; isometric mode only) | ⟲ / ⟳ buttons turn 15° with a 220 ms eased tween along the shortest arc; slider −180°…180°; the degree readout resets to 0° on click. |
| **Alt + left-drag on the canvas** | Continuous orbit, 0.4° per horizontal pixel. Dragging right brings the near side of the scene to the right. Swallowed before the interaction manager sees it, so it never also starts a selection, lasso or node drag. |

Everything on the **ground plane** rotates with the floor: grid, rectangles, connectors and their arrowheads, text boxes, flat (non-isometric) icons, selection frames, the cursor tile. Screen-facing chrome (name chips, label stalks) stays upright.

**The one big visual caveat:** isometric node icons are pre-rendered sprites drawn from a single fixed viewpoint. They **do not rotate** — they stay upright as billboards, so a cube shows the same three faces at every angle. That is what makes this a *simulation* of 3D rotation, not 3D. See [§8](#8-decisions-the-owner-needs-to-make).

The camera elevation is fixed (the iso foreshortening ratio, ≈35°). At 45° the floor reads as a squashed top-down view — grid cells are ≈100×58 px rectangles, not diamonds — and at 90° it is the same iso view from a different corner. That cell shape is **correct geometry for an orbit at a fixed elevation, not a bug**; combined with the billboard sprites (diamond-footed icons standing on rectangular cells) it is what can look "awkward" around 30–60°.

---

## 2. How it works

### 2.1 The model never changes — rotation is a view transform

Tiles stay integer `(x, y)`; `tile` remains the source of truth. Before a tile is projected, it is rotated about the tile-space origin by θ:

```
(x', y') = R(θ)·(x, y)                       // rotateTile()
screen   = ( halfW·(x' − y'),  −halfH·(x' + y') )   // the existing iso map, unchanged
```

and the inverse is applied on the way back (`unrotateTile()`), so hit-testing, placement and drag use the same transform. At θ = 0 every function is **bit-identical** to the original (`rotateTile` returns its arguments untouched; the CSS matrices return the original literals).

### 2.2 State — two places that must agree

| Where | What | Why |
|---|---|---|
| [`utils/viewRotation.ts`](../../packages/axoview-lib/src/utils/viewRotation.ts) | module-level `angleRad`, `cos`, `sin` + pure helpers (`rotateTile`, `unrotateTile`, `viewDepth`, `getRotatedIsoMatrix`) | The projection helpers (`strategy.toScreen/fromScreen`, `isoMath.*`) are pure and called from dozens of places, including non-React code. A module var lets them read the angle without threading it through every call site. |
| `uiState.viewRotation` (degrees, normalised to (−180, 180], **not persisted**) | mirror of the module value | Triggers React re-renders. |

Only `uiState.actions.setViewRotation(deg)` should write either one. It also **re-centres the viewport**: it finds the tile under the screen centre with the old angle, swaps the angle, re-projects that tile, and sets `scroll` so it lands back at the centre — the same trick `getCanvasModeSwitchScroll` uses for the iso↔2D switch. A fresh store resets the module var to 0.

### 2.3 Re-render plumbing

`CanvasModeProvider` subscribes to `viewRotation` and mints a **new context value per angle** (new `getTilePosition` identity). `SceneCanvas` — master's single WebGL2 bulk canvas — already lists `getTilePosition` in its geometry-effect deps, so every angle change rebuilds the instance buffers in one pass with no extra wiring; DOM consumers re-render through the same context value. (On the four-canvas renderer the POC was first built on, two of the layers had to have `getTilePosition` added to their deps; the merge removed that trap.)

### 2.4 The CSS matrix for elements on the ground plane

Rectangles, text boxes and flat icons are drawn in their own unprojected px axes and then put on the plane with a CSS `matrix(a,b,c,d,e,f)`. Rotating the plane means pushing each local axis through R(θ) then the iso map. With `c = cosθ, s = sinθ, K1 = 0.707, K2 = 0.409`:

| Orientation | local axes → tile | matrix `[a, b, c, d]` (e, f unchanged: 0, −0.816) |
|---|---|---|
| `X` | u → +x, v → −y | `[K1(c−s), −K2(c+s), K1(c+s), K2(c−s)]` |
| `Y` | u → −y, v → −x | `[K1(c+s), K2(c−s), K1(s−c), K2(c+s)]` |

Exposed as `strategy.projectionMatrix(orientation)`; `getProjectionCss` (context) and `isoMath.getIsoMatrix` both delegate to it. A unit test asserts each matrix equals the projection of the rotated tile axes at seven angles.

### 2.5 Two different meanings of "origin" — the one subtle thing

`getTilePosition({ origin: 'LEFT' | 'TOP' | 'RIGHT' | 'BOTTOM' })` returns **screen-space nudges** from the tile centre (`(−halfW, 0)` etc.). Those are right for anchoring screen-facing things (a node's centre = `BOTTOM − halfH`, popovers, drag-and-drop), and are left alone.

But an element whose **local axes are the tile axes** (a CSS-matrix'd rectangle, a selection frame) must be anchored at the **tile-space corner**, which swings around the centre when the plane rotates. New `getTileCorner({ tile, corner })` returns that: `LEFT = (−½, +½)`, `RIGHT = (+½, −½)`, `TOP = (+½, +½)`, `BOTTOM = (−½, −½)` tile offsets, projected. Consumers switched over: `useIsoProjection`, `renderedGeometry` (`getRenderedAreaCorners`, the rectangle quad), `nodeEmitter` (flat icons, via the new `getRenderedTileCorner`), `NonIsometricIcon`, `TransformControls`. Unrotated, it delegates to the old origin path, so nothing changes at 0°.

### 2.5b `renderedGeometry` — master's single source of truth for "where is it drawn"

Master routes every renderer, chrome and **hit-test** through [`utils/renderedGeometry.ts`](../../packages/axoview-lib/src/utils/renderedGeometry.ts), guarded by a source-scanning contract test (`renderedGeometry.contract.test.ts`: no hand-composed `tile + offset` outside that file) and an invariant suite. The rotation therefore had to land *there*, not only in the strategy:

- `getRenderedAreaCorners` — the rectangle quad: origin at the tile-space `LEFT` corner and edges from `getRotatedIsoMatrix('X', ISO_A, −ISO_B)`. The matrix helper takes the half-extents as parameters because master deliberately derives `ISO_A..D` from `TILE_PROJECTION_MULTIPLIERS` (R1/PROJ-06) while the CSS matrix still uses the 0.707/0.409 literals — each path keeps its own constants, so neither changes at 0°.
- `tileFootprintAt` — the **pixel-accurate hit footprint** of a tile is no longer the fixed iso diamond: under rotation it is the projection of the tile's four tile-space corners (a parallelogram), same TOP/RIGHT/BOTTOM/LEFT order. Without this, clicks would land on the unrotated diamond while the icon is drawn elsewhere.
- `getRenderedTileCorner` — composes the off-grid residual onto a corner anchor (kept in this file so the contract test stays green).

### 2.6 The smaller pieces

- **Depth sort.** Nodes paint back-to-front by `−x − y`; under rotation depth is `viewDepth(tile) = −(x' + y')`. Three places compute it and all three must agree: `SceneCanvas` (draw order; its sort cache is keyed on the angle), `hitDetection` (so the clicked item is the painted one — `itemsInPaintOrder` and the cross-type `isoDepth`), and the DOM `Nodes` overlay (re-sorts on `viewRotation`; rounds the value because it becomes a CSS `z-index`).
- **Grid.** The repeating SVG-tile background cannot represent a rotated grid. While rotated, [`Grid.tsx`](../../packages/axoview-lib/src/components/Grid/Grid.tsx) hides it and strokes projected lines on a Canvas2D (skipped above 600 lines per axis). At 0° the original background is used. The rotated lines are 1.5 px @ 11% rather than the SVG's 1 px @ 15% — see [§6.9](#6-known-gaps-and-risks-most-serious-first) for why, and for the remaining shimmer.
- **Stroke width.** Authored widths are in unprojected px and scaled by the projection. Rotation foreshortens the two tile axes differently, so `widthScale` is now the **mean** of both axis scales (connectors + rectangles) — identical to the old value when unrotated.
- **Drag preview.** `DragItems.tileDeltaToPixels` rotates the tile delta, so the DOM compositor preview follows the cursor.
- **Viewport culling.** `computeTileBounds` takes the AABB of the four screen corners mapped to tiles; that already bounds a rotated viewport (padded), so it needed no change.
- **Alt+drag** is [`useViewRotationGesture.ts`](../../packages/axoview-lib/src/hooks/useViewRotationGesture.ts): a capture-phase `pointerdown` on the renderer container (stops it before the interaction manager's window listeners) plus capture-phase window move/up. Mounted from `Renderer.tsx`.

---

## 3. File map

26 files (22 changed + 4 new), all under `packages/axoview-lib/src/` except this doc.

**New**

| File | Role |
|---|---|
| `utils/viewRotation.ts` | module state, rotate/unrotate, `viewDepth`, `getRotatedIsoMatrix`, `normaliseDeg` |
| `components/ViewRotationControls/ViewRotationControls.tsx` | dock widget |
| `hooks/useViewRotationGesture.ts` | Alt+drag orbit |
| `utils/__tests__/viewRotation.test.ts` | 10 unit tests (strategy, matrix, and the `renderedGeometry` quad / footprint) |

**Modified**

| File | Change |
|---|---|
| `utils/coordinateTransforms.ts` | iso `toScreen` / `fromCanvasPoint` / `fromScreen` rotation-aware; `projectionMatrix()` on the strategy interface; `makeTileCornerFn` |
| `utils/isoMath.ts` | `getTilePosition`, `screenToIso`, `getIsoMatrix` rotation-aware (standalone copies used by non-context callers) |
| `utils/renderedGeometry.ts` | rotated rectangle quad, rotated tile footprint (hit-test), `getRenderedTileCorner`, `TileCornerFn` (§2.5b) |
| `utils/hitDetection.ts` | `viewDepth` in the paint-order sort and the cross-type depth |
| `components/SceneLayers/SceneCanvas.tsx` | `viewDepth` draw order (+ angle in the sort-cache key); passes `getTileCorner` and the ground-plane matrix to the node emitter |
| `webgl/scene/nodeEmitter.ts` | flat-icon matrix and corner anchor come in as inputs (was a fixed constant + screen-space anchor) |
| `webgl/scene/rectangleEmitter.ts`, `webgl/scene/connectorEmitter.ts` | mean-of-both-axes `widthScale` |
| `contexts/CanvasModeContext.tsx` | subscribes to `viewRotation`; exposes `getTileCorner`, `viewRotation`; matrix via the strategy |
| `stores/uiStateStore.tsx`, `types/ui.ts` | `viewRotation` field + `setViewRotation` action (re-centres scroll) |
| `hooks/useIsoProjection.ts` | anchor with `getTileCorner` |
| `components/SceneLayers/Nodes/Nodes.tsx` | `viewDepth` sort + rounded z-index |
| `components/SceneLayers/Nodes/Node/IconTypes/NonIsometricIcon.tsx` | context matrix + corner offset |
| `components/TransformControlsManager/TransformControls.tsx` | selection-frame corners via `getTileCorner` |
| `interaction/modes/DragItems.ts` | rotate the drag delta |
| `components/Grid/Grid.tsx` | rotated-grid canvas |
| `components/BottomDock/BottomDock.tsx`, `components/Renderer/Renderer.tsx` | mount widget / gesture |
| three existing tests | their hand-written `useCanvasMode` mocks gained `getTileCorner` (`IsoTileArea.borderInset`, `useIsoProjection.twoDY`, `renderedGeometry.invariant`) |

> **Porting note.** The first version of this POC patched four separate canvas files (`RectanglesCanvas`, `ConnectorsCanvas`, `NodesCanvas`, `LabelsCanvas`) on `integration`. Master replaced them with one `SceneCanvas` plus emitters (PR #86, ADR 0038 §8) and moved all rendered/hit-test geometry into `renderedGeometry.ts`, so those four edits became the emitter, `SceneCanvas` and `renderedGeometry` rows above. The strategy, store, context, DOM, grid and control code carried over unchanged.

---

## 4. How it was verified

All of this was run **on the master base** (`731a6c9` + the POC) after the port, except where marked.

- **Unit:** 10 new tests — 0° identity (matrix + projection), `toScreen ∘ fromCanvasPoint` round-trip, `fromScreen` picks the clicked tile at 7 angles (strategy and `isoMath` copy agree), CSS matrix == projected rotated axes (X and Y), tile-corner semantics, and — for the master geometry — the rectangle quad equals the projected tile-space corners and a tile's hit footprint contains its own centre but no neighbour's, at every angle, and is the original diamond at 0°. Full lib suite: **206 suites / 2394 tests pass** (1 skipped), including master's `renderedGeometry` contract + invariant suites (0° output unchanged). `tsc --noEmit` clean; `eslint` clean on the touched source files.
- **Real browser** (headless Chromium, SwiftShader WebGL2, dev server): seeded a diagram (2 isometric cubes, 2 flat icons, 3 connectors, 2 rectangles) and screenshotted at 0° / 30° / 60° / 90°. Confirmed floor, rectangles, connectors + sheared arrowheads, flat icons, grid and the cursor tile all rotate together; 0° is the unchanged iso view. The unified canvas reported all 9 entities drawn. No app errors (a refused network request from the backend-less dev server aside).
- **Interaction at a rotated angle** (exercises master's pixel-accurate hit footprints): click-select of a cube and of a flat icon at 60°, and a click on the rotated rectangle selected that rectangle; selection frame hugging a rectangle at 30°; Alt+drag +100 px → 40° with no item moved; slider ArrowRight, ⟳ button, readout-reset; drag-moving a node at 60° — the preview and the dropped position agree and its connectors re-route.
- **Text boxes** were verified rotating with the floor on the earlier `integration`-based build; the DOM path (`useIsoProjection` + context matrix) is unchanged by the port, but the master-base browser run did not include one (a hand-seeded text box lacks the scene-derived `size` and crashes the renderer — create it through the app).

---

## 5. Not verified

Do not assume these work — none were exercised:

- the Playwright e2e suite (including master's new Docker-image regression gate);
- **image export** (master's export now composites the single scene canvas — not exercised rotated), presentation / read-only display routes, share links;
- **fit-to-view** (uses `getTilePosition`, so it should account for rotation — untested);
- lasso / freehand lasso, rectangle and text-box resize handles, floating-label and connector-label dragging, the **selected-connector DOM overlay**, the DOM node overlay's inline rename;
- **Y-orientation** text boxes visually (the matrix is unit-tested only);
- dark mode, 2D mode round-trip with a non-zero angle, touch, multiple diagrams/views;
- any **performance** measurement.

---

## 6. Known gaps and risks (most serious first)

1. **Global module state breaks multiple `<Axoview>` instances on one page.** The library is embeddable; two instances would share one angle. Productizing means making the rotation per-instance — e.g. build the strategy from a rotation value (a factory, as `makeTilePositionFn` already is) instead of reading a module global, and keep the angle only in the instance's store. This is the main architectural change.
2. **Off-grid items will drift relative to the floor** (*from code reading, not tested*). An item's `offset` is, by master's own definition, a **post-projection SceneLayer-px residual** ([renderedGeometry.ts](../../packages/axoview-lib/src/utils/renderedGeometry.ts) header; [ADR 0023](../adr/0023-off-grid-positioning-and-collision.md) 2026-07-23 addendum) added after `getTilePosition`. Under rotation that residual does not rotate with the plane, so an unsnapped node moves up to half a tile relative to its tile and to the rectangle it sits in. The fix has one natural home — `getRenderedOffset` / `getRenderedTilePosition` / `getRenderedAreaCorners`, where every consumer already composes the residual: interpret the stored offset in the unrotated frame and re-project it (`L_θ · L_0⁻¹ · offset`; `resolvePlacement` already has the inverse helpers). `DragItems` commits `screenDelta / zoom` as the offset, so the write side needs the inverse transform too.
3. **Rotation costs O(N) per angle change.** Each angle rebuilds the whole `SceneCanvas` instance buffer on the CPU (one sorted pass over every bulk entity), so the O(1)-pan guarantee of [ADR 0038](../adr/0038-webgl-instanced-render-substrate.md) §5 does not hold *while rotating*. Fine for modest diagrams (nothing measured); for 20k nodes the fix is to move the rotation into the vertex shader as a uniform on tile-space positions. Add a rotation case to the perf harness ([ADR 0020](../adr/0020-engine-perf-harness-and-measurement-protocol.md)) either way.
4. **Not i18n'd.** Tooltips and the slider label in `ViewRotationControls.tsx` are hard-coded English; the repo has 13 locales and a completeness test.
5. **Test doubles:** any hand-written `useCanvasMode` mock now needs `getTileCorner` (three existing tests were patched). Master's contract test also forbids composing the off-grid offset anywhere but `renderedGeometry.ts`, so new corner-anchored code must go through `getRenderedTileCorner`, not hand-add `node.offset`.
6. **Alt+drag collisions:** on some Linux desktops Alt+drag moves the window; on macOS it is Option. Needs a second route (middle-drag, a rotate tool, or a key) — and Alt+click already means "remove waypoint" in [the pointer model](../adr/0022-canvas-pointer-interaction-model.md) (no collision today because the press is swallowed, but worth a conscious ruling).
7. **No keyboard, touch or accessibility route** beyond the slider's own keyboard support. Touch twist is not implemented ([ADR 0018](../adr/0018-touch-pen-gesture-contract.md)).
8. Not persisted: the angle resets on reload and is not saved with the diagram.
9. **Rotated grid shimmer (cosmetic, partly mitigated).** The unrotated grid is a tile image rasterised once, so every line looks identical. The rotated grid strokes each line separately at its own sub-pixel phase, so a 1 px anti-aliased line is sometimes one crisp pixel and sometimes two half-faint ones, plus stair-stepping on near-horizontal/vertical lines. Measured on the grid canvas (peak alpha per line, 0–255): up to a **~4× spread** (10…38) at ~38°. The POC now strokes 1.5 px @ 11% instead of 1 px @ 15%, which evens out near the cardinal angles (45°: 20–36 → 21–28; 60°: 20–38 → 23–28) but **does not help in-between angles** (~20–40° unchanged) — that stair-step is inherent to thin AA lines. The proper fix is to draw the grid through the existing analytic-AA line path (`shapeMode 1`, the `fwidth()` coverage ramp that already makes rectangle borders crisp at every angle, see [canvas-rendering-guidelines](../guidelines/canvas-rendering-guidelines.md)) as a small WebGL layer, instead of Canvas2D. Also consider fading the grid when zoomed far out, and (separately) the cosmetic mismatch between diamond-footed sprites and rectangular cells (§8.1).

---

## 7. Control prior art (from memory — not researched here; verify before citing)

| Convention | Seen in | Fits here? |
|---|---|---|
| Fixed-step turn keys (Q/E, or numpad 4/6 at 15°) | city builders, RTS; Blender orbits 15° per numpad press | Yes — Q/E are free (tool keys today are `s m n r c t l f`) |
| Modifier-drag orbit; Shift snaps to 15° | Blender, Maya/Unity (Alt+drag), Photoshop Rotate View | Alt+drag exists; **Shift-snap is not implemented** |
| Dedicated Rotate-View tool + angle field + reset | Photoshop, Illustrator, Krita, Affinity | Maybe, if rotation should be discoverable from the toolbar |
| Compass / view-cube / "home" button | Blender gizmo, map apps, CAD | A small compass that shows heading and resets on click would also solve "which way is 0°?" |
| Live angle readout at the pointer while dragging | design tools, games | Cheap, high-value feedback |
| Right-drag orbit | many games | **Conflicts** — right-drag is pan in this app ([ADR 0022](../adr/0022-canvas-pointer-interaction-model.md)). A modifier (e.g. Alt+right-drag) would not |

---

## 8. Decisions the owner needs to make

1. **Billboard sprites vs. real views.** Ship the fixed-viewpoint billboards as-is (cheapest; looks right for small angles, "wrong faces" past ~±45°), or commission/derive **4 cardinal sprite views per icon** and swap at 90° snaps (much better, needs art + atlas changes), or restrict rotation to 90° steps only.
2. **Persist the angle?** Ephemeral (current) vs. saved per view (an optional, zero-migration `view.rotation` field, in the spirit of [ADR 0023](../adr/0023-off-grid-positioning-and-collision.md)) — which also decides what shared / presented / exported views show.
3. **Should export capture the rotated view?** (WYSIWYG says yes.)
4. **Control set** — see [§7](#7-control-prior-art-from-memory--not-researched-here-verify-before-citing); minimum suggestion: dock widget + Alt+drag (done) + Q/E keys + Shift-snap + a heading indicator.
5. **2D mode:** keep rotation iso-only (current), or define what "rotate" means in 2D.

---

## 9. Suggested productization plan

1. `/feature start view-rotation` → ADR covering: state ownership (per-instance, see §6.1), the two "origin" meanings (§2.5), persistence (§8.2), and the control set. Cross-link ADR 0022 (pointer model), 0023 (off-grid), 0038 (substrate).
2. **Refactor state out of the module global** (§6.1), keeping the 0°-is-bit-identical property and its test.
3. Fix off-grid drift (§6.2) and add a regression test.
4. Close the §5 list: add e2e specs (rotated click-select, drag, resize handles, lasso, export) — the debug-bridge seeding approach used for the screenshots works for this: write the diagram with `window.__axoview__.model.getState().actions.set(...)`, then resync the scene with `window.__axoview__.changeView(viewId, model)` (without that, connectors have no paths). Two gotchas: a hand-seeded text box lacks the scene-derived `size` and crashes the renderer (create it through the app instead), and master paints *earlier-in-array* rectangles on top, so list a small inner rectangle before the large one. (The `agent` surface used on `integration` is not on master.)
5. i18n + Help-dialog / `docs/features.md` entries; add the perf-harness rotation case; decide the sprite question (§8.1) before polishing visuals.
6. Wrap this tactical per the lifecycle in the [tactical README](README.md).
