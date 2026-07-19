# Tactical — On-Canvas Per-Node Icon Resize

> **Read first:**
> - [ADR 0044 — On-Canvas Per-Node Icon Resize](../adr/0044-on-canvas-icon-resize.md) (this feature)
> - [ADR 0026 — Rectangle Edge-Midpoint Transform Handles](../adr/0026-rectangle-edge-transform-handles.md) (the handle pattern to mirror)
> - [ADR 0030 — Docked Style-Controls Strip](../adr/0030-docked-style-controls-strip.md) (what the strip owns; §1 icon-size partially superseded by 0044)
> - [ADR 0006 — Canvas Selection Contract](../adr/0006-canvas-selection-contract.md) §9 (the selection-ring language the handles live in)
> - [canvas-interaction.md](../guidelines/canvas-interaction.md) (the mode/drag/transaction contract — §4 mode registry, §6.2 drag transactions, §8 abort/commit)
> - [canvas-rendering-guidelines.md](../guidelines/canvas-rendering-guidelines.md) (**every visual change needs a real-browser check — CI can't see GPU output**)
>
> **Status:** Not started · **Owner:** molikas · **Last updated:** 2026-07-19
>
> This is a **short-lived working doc.** Delete it after the work merges; ADR 0044 is the durable record. PLAN.md gets a one-line entry under **UX-CANVAS** once shipped — see "Wrap-up".

## Session startup checklist

1. Read this file fully.
2. Read ADR 0044 + the linked ADRs above.
3. Skim `PLAN.md` Phase Status Dashboard **for context only** (this extends the shipped **UX-CANVAS** phase).
4. Use `TodoWrite` to track the sub-tasks below.
5. Mark `[x]` as work completes.
6. On completion, follow "Wrap-up".

## Goal

Let a user resize a node's icon **directly on the canvas** by dragging a corner handle, replacing the top-bar "Icon size" slider. Size becomes a **per-node** property (a new optional `viewItem.iconScale`) that overrides the shared icon default for that one node — so "grab this node, make it bigger" affects only this node. The change is **zero-migration** and must **round-trip through every persistence path** (owner requirement).

**Not a goal:** multi-tile node footprints (resize is visual scale only — collision/hit-test/connectors keep the single tile); group/proportional resize across a multi-selection; a numeric size input; bulk "resize every same-icon node at once" (deliberately dropped — see Locked #2).

## Scope

### In scope
- New optional `iconScale` on `viewItemSchema`, resolved `viewItem.iconScale ?? icon.scale ?? 1` at all render sites.
- `NODE.TRANSFORM` mode + `TransformNode.ts`, corner-only uniform scale, one undo entry.
- Wiring `NodeTransformControls` handles; coupling the selection ring to the scaled icon extent.
- Removing the strip Icon-size control + its 3 dead i18n keys (×13 locales) + type.
- Verified persistence: zip, lean save, Drive, clipboard, image export.

### Out of scope
- Multi-tile footprint / collision changes.
- Multi-select group resize; numeric entry field.
- Any change to the shared `icons[].scale` field itself (it stays as the fallback default and the import-time authoring scale).

## Locked decisions (from design discussion 2026-07-19)

| # | Decision |
|---|---|
| 1 | **Per-node semantics.** Resize writes a new per-node `viewItem.iconScale` (override); it affects **only that node**. Shared `icons[].scale` stays as the fallback default. Zero-migration (optional field). *(Owner Q1.)* |
| 2 | **Remove the top-bar slider** — canvas is the only sizing surface. Icon size is reclassified styling→geometry; ADR 0030 §1 icon-size partially superseded. Losing "resize all same-icon nodes at once" is **accepted**. *(Owner Q2.)* |
| 3 | **Persistence must work** — `iconScale` round-trips through zip / lean save / Drive / clipboard / image export, with tests at the two real risk sites (clipboard, zip). *(Owner Q1 addendum: "make sure import export works".)* |
| 4 | **Corner handles only, uniform scale about the node's tile centre** (icons are square; edge handles would distort). Clamp `[0.3, 2.5]` inside the schema hard bound `[0.1, 3]`. |
| 5 | **Single-target**, mirroring `RECTANGLE.TRANSFORM`. **Visual scale only** — single-tile footprint unchanged. **One gesture = one undo entry** via the drag transaction. |

## Sub-tasks

### A. Model + render readers (do first — everything reads this)
- [ ] Add `iconScale: z.number().min(0.1).max(3).optional()` to [`schemas/views.ts`](../../packages/axoview-lib/src/schemas/views.ts) `viewItemSchema` with an ADR-0044 comment (mirror the ADR 0023 off-grid field comments).
- [ ] Resolve `viewItem.iconScale ?? icon.scale ?? 1` in all four readers: [`useIcon.tsx`](../../packages/axoview-lib/src/hooks/useIcon.tsx) → [`IsometricIcon.tsx`](../../packages/axoview-lib/src/components/SceneLayers/Nodes/Node/IconTypes/IsometricIcon.tsx) / [`NonIsometricIcon.tsx`](../../packages/axoview-lib/src/components/SceneLayers/Nodes/Node/IconTypes/NonIsometricIcon.tsx) (DOM = selected node) and [`NodesCanvas.tsx`](../../packages/axoview-lib/src/components/SceneLayers/Nodes/NodesCanvas.tsx) `buildInstances` scale choke point (WebGL = unselected). **Both paths or the live-drag and committed node diverge.**
- [ ] A view-item update action for `iconScale` (extend the existing `updateViewItem`/`batchUpdateViewItem*` reducers in [`stores/reducers/viewItem.ts`](../../packages/axoview-lib/src/stores/reducers/viewItem.ts)).

### B. Interaction — the NODE.TRANSFORM mode
- [ ] Add `NODE.TRANSFORM` to the mode union in [`types/ui.ts`](../../packages/axoview-lib/src/types/ui.ts) (beside `TransformRectangleMode`).
- [ ] `interaction/modes/Node/TransformNode.ts` mirroring [`Rectangle/TransformRectangle.ts`](../../packages/axoview-lib/src/interaction/modes/Rectangle/TransformRectangle.ts): `entry` → `beginDragTransaction`; `mousemove` → `Δscale = Δpx_css / (PROJ_W·k·widthScale·zoom)` (sub-tile precise delta), uniform about centre, clamp `[0.3,2.5]`, write the view item in-transaction; `mouseup` → `commitDragTransaction` + `setMode(CURSOR)`.
- [ ] Register it in the [`useInteractionManager.ts`](../../packages/axoview-lib/src/interaction/useInteractionManager.ts) modes map.
- [ ] Wire [`NodeTransformControls.tsx`](../../packages/axoview-lib/src/components/TransformControlsManager/NodeTransformControls.tsx): pass `onAnchorMouseDown(key) → setMode({type:'NODE.TRANSFORM', id, selectedAnchor:key})` and restrict `anchorPositions` to the four corners.

### C. Selection-ring coupling
- [ ] In [`TransformControls.tsx`](../../packages/axoview-lib/src/components/TransformControlsManager/TransformControls.tsx) (or `NodeTransformControls`), derive the ring + corner-handle extent from the node's **scaled icon extent**, not the bare tile (today it's a fixed 100×100 tile diamond — an enlarged icon pokes out of its own ring). Verify in iso **and** 2D.

### D. Remove the strip control + dead i18n (the ripple cleanup)
- [ ] Delete `IconSizeControl`, its `StripButton` (~lines 2085–2104), `applyIconScale`, and the `PhotoSizeSelectLarge`/`IconSizeIcon` import from [`TopBarStyleControls.tsx`](../../packages/axoview-lib/src/components/TopBarStyleControls/TopBarStyleControls.tsx). Keep **Change icon**.
- [ ] Remove `iconSize` / `iconSizeBulk` / `iconSizeDisabled` from **all 13 locales** (`i18n/*`) and the type in [`axoviewProps.ts`](../../packages/axoview-lib/src/types/axoviewProps.ts). Run the i18n key-parity check.

### E. Persistence verification (owner requirement — Locked #3)
- [ ] **Clipboard** — confirm [`clipboard/clipboard.ts`](../../packages/axoview-lib/src/clipboard/clipboard.ts) + [`useCopyPaste.ts`](../../packages/axoview-lib/src/clipboard/useCopyPaste.ts) carry `iconScale` when reconstructing a pasted view item (whitelist risk — the real one).
- [ ] **Project zip** (ADR 0001) — export→import round-trip preserves `iconScale`.
- [ ] **Lean save** (ADR 0003) — `leanSave.ts` strips only duplicate *icons*, not view-item fields, so it should be safe; test a per-node override reload anyway.
- [ ] **Drive save** + **image export** — export renders through `NodesCanvas` (covered by A); smoke it.

### F. Tests
- [ ] `interaction/**/__tests__/TransformNode.test.ts` mirroring `TransformRectangle.test.ts`: corner drag changes `iconScale` uniformly, clamps, one history entry, fallback resolution.
- [ ] Extend [`schemas/__tests__/views.test.ts`](../../packages/axoview-lib/src/schemas/__tests__/views.test.ts): `iconScale` round-trips; absent is valid.
- [ ] Extend the transform e2e (iso + 2D resize; sibling same-icon node unchanged; persists across reload).
- [ ] **Real-browser manual pass** (screenshots — CI can't see GPU): DOM vs GL size parity, ring wraps enlarged icon, strip has no Icon-size control.

## Wrap-up

When all sub-tasks are complete and the smoke checklist passes:

1. Add a single line under `PLAN.md` **UX-CANVAS** section:
   ```
   - On-canvas per-node icon resize shipped — node transform handles + per-node `viewItem.iconScale`; top-bar Icon-size slider removed. See docs/adr/0044 (supersedes 0030 §1 icon-size) and this file's git history.
   ```
2. Delete this file. ADR 0044 is the durable record.
3. Refresh the `defossilization`/item-controls memory pointer only if a decision here supersedes it (it doesn't obviously — this is additive).

## Notes for Claude

- **Group resize + size readout landed (2026-07-19 follow-up to first-use feedback).** `NODE.TRANSFORM` now carries `targets: {id, startScale}[]`; `uiState.iconScaleDrag` is a node→scale **map**; a homogeneous node multi-select shows one group box ([`NodeGroupTransformControls`](../../packages/axoview-lib/src/components/TransformControlsManager/NodeGroupTransformControls.tsx)) that scales all members by a uniform factor (per-node handles suppressed via `showHandles={false}`); the chrome shows a live `×` size pill. See the ADR 0044 dated addenda.
- **Second UX pass (2026-07-19): nodes use a screen-space box, not the iso diamond.** A 3-D icon sprite can't be wrapped by a flat tile diamond, so nodes (selection + hover) now render [`ScreenBoxTransformControls`](../../packages/axoview-lib/src/components/TransformControlsManager/ScreenBoxTransformControls.tsx) sized to the icon's rendered bounds ([`useImageAspect`](../../packages/axoview-lib/src/hooks/useImageAspect.ts) for height). Readout is screen-stable (`1/zoom`) + larger. `TransformControls` (iso ring) now serves rectangles / text boxes only — its `extentScale`/`readout` props are unused and can be pruned in a later cleanup.
- **Group members must be lifted to the DOM overlay to preview (2026-07-19 fix).** During a GROUP resize `itemControls` is null, so only the boxes previewed — the member ICONS stayed on the WebGL bulk (committed scale) until release. Fix: [`Renderer`](../../packages/axoview-lib/src/components/Renderer/Renderer.tsx) `hybridIds` now also includes the `NODE.TRANSFORM` mode's target ids (keyed off a stable joined id list → no per-frame Renderer re-render), so each member renders in DOM where `NodeContent` reads `iconScaleDrag` and previews live. Same DOM-lift pattern connectors use for multi-selection.
- **QA polish (2026-07-19): tile cursor hidden during resize + bigger handle hit-targets.** `NODE.TRANSFORM` sets `showCursor: false` (the blue tile-cursor diamond was ghosting at the pointer tile over the icon mid-resize). [`TransformAnchor`](../../packages/axoview-lib/src/components/TransformControlsManager/TransformAnchor.tsx) gained a transparent `HIT_PAD` forgiveness margin (visible glyph unchanged) so near-miss presses still grab a handle. The tile-cursor diamond is also now hidden when **hovering an item** in select mode (`Renderer`: `mode==='CURSOR' && hoveredItem` — it was drawing a confusing 2nd box over the hover outline). **Still open (owner call):** handles remain zoom-scaled (shrink when zoomed out) — the [ADR 0026](../adr/0026-rectangle-edge-transform-handles.md) open item (screen-stable handles / `scale(1/zoom)`); and the tile cursor still doesn't clear on mouse-leave / whether it should show at all in plain select mode.
- **Two render paths, one field.** The selected node is drawn in the **DOM** (`Node.tsx`/`useIcon`), all others in **WebGL** (`NodesCanvas`). Update **both** readers or the live drag (DOM) and the committed node (GL) render at different sizes. Live drag touches DOM only; set `geomDirtyRef` so the **commit** rebuilds the GL batch (mirrors the CSS-preview move — canvas-interaction.md §6.1).
- **One undo entry.** Route the whole drag through `beginDragTransaction`/`commitDragTransaction` (or `freezePendingPre`/`unfreezePendingPre`). A `modelStore.set` per pointer tick = N undo entries + patch cost per frame (canvas-interaction.md §6.2). There is **no rollback primitive** — Escape does not abort a transform (§8); don't promise a cancel that restores origin.
- **Handle press ≠ body press.** The anchor DOM lives in a `SceneLayer` **above** the `canvas-interactions` box, so a corner press is intercepted there and never reaches `getItemAtTile` — that's exactly what keeps body-drag = move and handle-drag = resize from colliding (same as rectangles). Don't route resize through tile hit-testing.
- **`widthScale` is the projection-safety term.** Reuse the `hypot(getTilePosition({1,0}) − getTilePosition({0,0})) / UNPROJECTED_TILE_SIZE` probe (already in `ConnectorsCanvas`/`RectanglesCanvas` for stroke width). It is what makes the drag→scale mapping identical in iso and 2D — do not hardcode 0.817.
- **Zero-migration is a hard gate** (master merge). `iconScale` must be optional; an old file with no `iconScale` must render byte-for-byte as today via `icon.scale`.
- **Every visual change needs a real browser.** jsdom/SwiftShader can't render the GPU output; the owner verifies via screenshots (canvas-rendering-guidelines.md).
