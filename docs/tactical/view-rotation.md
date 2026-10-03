# Tactical — View Rotation (productization)

> **Read first:**
> - [ADR 0049 — View Rotation: Camera & Projection Model](../adr/0049-view-rotation-camera-and-projection-model.md)
> - [ADR 0050 — View Rotation: Render & Legibility Policy](../adr/0050-view-rotation-render-and-legibility-policy.md)
> - [ADR 0051 — View Rotation: Default Angle, Sharing & Export](../adr/0051-view-rotation-default-angle-sharing-and-export.md)
> - [view-rotation-poc.md](view-rotation-poc.md): the POC walkthrough (how the code in the working tree works). It is not the plan.
> - [docs/workflow.md](../workflow.md) · [canvas-rendering-guidelines](../guidelines/canvas-rendering-guidelines.md) · ADRs [0022](../adr/0022-canvas-pointer-interaction-model.md), [0023](../adr/0023-off-grid-positioning-and-collision.md), [0038](../adr/0038-webgl-instanced-render-substrate.md), [0020](../adr/0020-engine-perf-harness-and-measurement-protocol.md)
>
> **Status:** Not started · **Owner:** molikas · **Last updated:** 2026-10-03
>
> This is a **short-lived working doc.** Delete it, together with `view-rotation-poc.md`, after the work merges; the ADRs are the durable record. Once it ships, PLAN.md gets a one-line entry referencing the ADRs (see "Wrap-up").

## Session startup checklist

1. Read this file fully.
2. Read each linked ADR.
3. Skim the `PLAN.md` Phase Status Dashboard **for context only**; do not modify it during this work.
4. Mark `[x]` as work completes.
5. On completion, follow "Wrap-up" to add the single PLAN.md line.

## Goal

Ship the turntable view rotation: free-angle, per instance, correct for off-grid content, legible at every angle, smooth on large diagrams. Viewers can rotate too. A page can carry an authored default angle, and export can capture the view as seen. **Not a goal:** tilt or elevation change, per-angle sprite art, rotation in 2D, or touch twist.

## Scope

**In scope:** everything ADRs 0049–0051 decide, as sub-tasks A–H below.

**Out of scope:** a share-link angle parameter (deferred, ADR 0051 §4); dark-mode grid colour (the uniform is ready, but there is no theme yet); sprite mirroring and multi-view art; the pre-existing Quill link-tooltip offset.

## Locked decisions (owner, 2026-10-03)

| # | Decision |
|---|---|
| 1 | Free angle at rest. The recommended 90°-step model was declined; non-diamond cells and sprite-footprint mismatch at in-between angles are accepted. |
| 2 | Persistence is an explicit per-page default (`view.defaultRotation`). Rotating itself never writes the model. |
| 3 | Export uses the angle as viewed by default, with the page default selectable when the two differ. |
| 4 | Controls are the dock buttons plus reset, Q/E, and Alt+drag on the canvas. Touch twist and dial-drag are not in v1. |
| 5 | Viewers (display, share and Present routes) get the rotation controls, minus "Set as page default". |

**Open questions** (TODO blocks in the ADRs):
- Step size (15°, with Shift jumping to the next cardinal angle), dropping the slider, drag sensitivity.
- The perf thresholds.
- Whether Present opens at the page default or at the presenter's live angle.

## Findings register (2026-10-03 investigation; POC lines are working-tree)

| # | Finding | Evidence |
|---|---|---|
| F1 | The export dialog's hidden instance resets the module-global angle | `uiStateStore.tsx:53` (POC), `ExportImageDialog.tsx:932-956`, `Axoview.tsx:375-391` |
| F2 | Offsets are a post-projection residual; three sites compose them by hand | `connectorEmitter.ts:251-266`, `Connector.tsx:45`, `ViewModeInfoPopover.tsx:240-245`, `LabelHitLayer.tsx:429-436` |
| F3 | Every angle step triggers a full rebuild and a re-render of every consumer | `SceneCanvas.tsx:818-831`, `CanvasModeContext.tsx:80,103`; ADR 0038 §5 |
| F4 | Fixed orientation: arrow nudge uses fixed tile deltas, flat-icon resize uses fixed screen diagonals, and the DOUBLE connector's line-2 label uses a tile-space normal | `handleArrowKey.ts:29-54`, `TransformNode.ts:26-31,75-83`, `ConnectorLabel.tsx:628-648` |
| F5 | At cardinal angles, depth ties fall to float noise | `viewRotation.ts:31-34` (POC), `renderOrder.ts:21-27,85-92` |
| F6 | θ leaks into 2D (depth has no mode check, and `reprojectOffset` uses the rotated strategy); memos are keyed on `projectionName` | `useCanvasModeToggle.ts:44`, `Connector.tsx:39-51`, `Cursor.tsx:40-41` |
| F7 | Alt+drag swallows Alt+click waypoint removal | `useViewRotationGesture.ts:25-34` (POC), `Cursor.ts:207-218,265-279`, `i18n/en-US.ts:133` |
| F8 | Annotation ink is re-projected on iso↔2D only | `AnnotationLayer.tsx:267-276`, `useCanvasModeToggle.ts:109-114` |
| F9 | The grid is an SVG background; the GL context has no background pass | `Grid.tsx:183-191`, `Grid.tsx:42-112` (POC), `glSpriteBatch.ts:911-963` |
| F10 | GPU content is captured at screen dpr in export | `SceneCanvas.tsx:699`, `glSpriteBatch.ts:373-375` |
| F11 | Views round-trip unknown keys; top-level keys are dropped | `useInitialDataManager.ts:179,224-226`, `DiagramLifecycleProvider.tsx:889-904,1807-1821` |
| F12 | The dock renders for viewers; the POC widget is not mode-gated | `Axoview.tsx:354-366`, `ViewRotationControls.tsx:56` (POC) |
| F13 | Every key must be classified for read-only mode | `readonlyPolicy.ts:48-73`, `readonlySurfaces.contract.test.ts:93-124` |
| F14 | Load resets zoom and scroll but not the angle | `useInitialDataManager.ts:229-237` |
| F15 | Rotate icons clash with the item "Rotate 90°" handle (ux §2.2) | `TransformControls.tsx:3`, `RectangleTransformControls.tsx:74` |
| F16 | Already rotation-safe; no work needed | lasso `Lasso.ts:230-256`, handles `TransformControls.tsx:142-252`, paste `useCopyPaste.ts:193-202`, fit `renderer.ts:257-309` |

## Sub-tasks

### A. Foundation: per-instance strategy (ADR 0049 §1–§3, §5)
- [ ] Commit the POC as-is on this branch first; the code and its brief are still untracked.
- [ ] Add `makeIsometricStrategy(θ)` and `getStrategy(mode, θ)`. θ = 0 must return the shared strategy (identity test).
- [ ] Keep θ in `uiState` only: delete the module state and the reset in `initialState`, and use exact trig at cardinal angles.
- [ ] Inject `strategy` into the interaction `State`. Replace the `canvasMode` parameters in the pure utilities, and re-key memos on the strategy.
- [ ] Revert the POC's `isoMath.ts` copies, and make the `renderer.ts` fallbacks required.
- [ ] One depth comparator plus tiebreak in `renderOrder.ts`, with no θ in 2D. Add a two-instance test.

### B. Offsets and input orientation (ADR 0049 §4, §7)
- [ ] Render offsets as `M(θ)·o` and write them through `M(−θ)`. Fold the three hand-composed sites into `renderedGeometry` and extend the contract test.
- [ ] Re-project iso↔2D between the unrotated strategies.
- [ ] Remap arrow nudge; give flat-icon resize the real screen direction; compute the DOUBLE line-2 label normal from the projected path.
- [ ] Refresh the cursor tile after a rotation, so paste targets the right tile.

### C. Motion without per-frame rebuilds (ADR 0049 §6)
- [ ] Add a `mat2` uniform and instance classes in `glSpriteBatch.ts`, and split the chip/stalk screen offset from the anchor.
- [ ] Remove θ from SceneCanvas's geometry deps, apply `M(θ − θ₀)` at draw time, and settle-rebuild under a re-baseline policy.
- [ ] DOM content layers update by transform only; hit proxies and handles are suspended until settle.
- [ ] Add the `PERF_ROTATE` harness case and record its row in `perf-results/decision-log.md`.

### D. Render and legibility (ADR 0050)
- [ ] Keep-upright predicate with hysteresis, wired into the DOM matrix, the flat-icon emitter, the inline editor and export.
- [ ] Procedural grid pass; retire the SVG tiles and the Canvas2D path; side-by-side screenshots at 0°.
- [ ] Export at `dpr = export scale`; this ships together with the grid.
- [ ] Draw annotation ink through `M(θ)` with non-scaling strokes.

### E. Default angle, sharing and export (ADR 0051)
- [ ] Add `defaultRotation` to `viewSchema`, with round-trip and old-client tests. Lean save omits it at 0.
- [ ] "Set as page default": EDITABLE only, one undo step.
- [ ] Apply the default on load, page switch and display routes; reset goes to the default; support `initialData.viewRotation`.
- [ ] Add the export angle option. The hidden instance and the bounds use the chosen angle; the file explorer uses the default.

### F. Controls and UX (ADR 0049 §7)
- [ ] Dock widget: new icons, readout as a button, no slider, disabled with a tooltip in 2D, and `view-rotation-*` test ids.
- [ ] Q/E (plus Shift) in the keydown handler, classified `viewer` in `readonlyPolicy.ts`.
- [ ] Alt+drag becomes an interaction mode with click/drag separation, rAF-coalesced, with Shift-snap. Delete `useViewRotationGesture.ts`.
- [ ] Animations follow the shortest arc, respect `prefers-reduced-motion`, and a canvas press completes them.
- [ ] Add a `viewRotationControls` namespace to all 13 lib locales; add Help rows (keyboard and mouse); announce the angle via aria-live on settle.

### G. Verification
- [ ] Unit tests per each ADR's acceptance criteria; `tsc`, lint, and both lib and app builds.
- [ ] E2E: rotated select, drag, resize and lasso; display-route default; no dirty state for viewers; export at both angles.
- [ ] A real-GPU browser pass (not SwiftShader) with screenshots at 0°, 37°, 90° and 180°.

### H. Docs at ship
- [ ] `/feature extend 0022` for the Alt+drag orbit, and `/feature extend 0038` for the grid pass and the motion transform.
- [ ] Add entries to canvas-interaction.md and canvas-rendering-guidelines.md; flip ADRs 0049–0051 to Accepted.

## Wrap-up

When every sub-task is complete and the smoke checklist passes:

1. Add one line under the `PLAN.md` **UX-CANVAS** row:
   ```
   - View rotation shipped — see docs/adr/0049..0051 and (this file's git history).
   ```
2. Delete this file and `view-rotation-poc.md`, and remove the row in `README.md`.
3. Update the view-rotation memory pointer.

## Notes for Claude

- **Branch:** `feat/view-rotation-poc`, cut from master. `integration` is reserved, so the PR goes straight to master.
- **ADR numbers:** integration's three MCP ADRs (0045–0047) already collide with master's, and 0048–0051 are now taken, so they must renumber to 0052 or higher before #79 ships.
- **GPU visuals:** CI is pixel-blind. Headless runs default to SwiftShader, so keep the real-GPU flags in `perf.config.ts`. The e2e webServer serves the lib's `dist`: rebuild the lib and kill :3000 on every iteration.
- **Seeding test diagrams:** use `window.__axoview__`, then call `changeView` (connectors have no paths without it). Create text boxes through the app, because a hand-seeded one crashes the renderer. Rectangles earlier in the array paint on top.
- **Guardrails:** hand-written `useCanvasMode` mocks need the new strategy fields, and `renderedGeometry`'s source-scan test forbids composing offsets by hand.
