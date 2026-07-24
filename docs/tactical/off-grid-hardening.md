# Tactical — Off-Grid Rendered-Geometry Hardening (ADR 0023 follow-up)

> **Read first:**
> - [ADR 0023 — Off-Grid Positioning & Per-Item Collision](../adr/0023-off-grid-positioning-and-collision.md) — the contract this hardens. **Known doc bug:** §1 calls `offset` "unprojected px"; the true semantics are **post-projection / SceneLayer px** (see Locked decision 8).
> - [ADR 0022 — Canvas Pointer Interaction Model](../adr/0022-canvas-pointer-interaction-model.md)
> - [ADR 0038 — WebGL Instanced Render Substrate](../adr/0038-webgl-instanced-render-substrate.md) (the second rectangle render path)
> - [guidelines/testing.md](../guidelines/testing.md) — suite conventions; update its additions table when suites land
> - [workflow.md](../workflow.md) — baseline
>
> **Status:** Implemented (A–G) 2026-07-23 — **awaiting the plan author's review**; see the Progress log at the bottom · **Owner:** molikas · **Last updated:** 2026-07-23
>
> This is a **short-lived working doc.** Delete it after the work merges; ADRs are the durable record. PLAN.md gets a one-line entry once shipped — see "Wrap-up".

## Session startup checklist

1. Read this file fully.
2. Read the linked ADR 0023 and skim 0022/0038.
3. Use `TodoWrite` to track the sub-tasks below; mark `[x]` as work completes.
4. Work in workstream order A → G; **commit per workstream** (conventional commits, e.g. `refactor(off-grid): …`, `test(off-grid): …`).
5. On completion, follow "Wrap-up".

## Context — why this exists

Commit `8ee54861` fixed a seven-bug cluster with one root cause: ADR 0023 added `offset` (px residual) beside the authoritative integer `tile`, and **seven consumers re-derived geometry from the tile without composing the offset**. There is no shared "where is this item actually drawn?" helper — every site hand-rolls `getTilePosition(tile) + (offset ?? 0)`, so omission is the default failure mode. The acceptance test (`snap-grid.spec.ts`) asserts only the data model (tile stays integer, offset committed), so all seven bugs were invisible to it.

The fixed sites (for orientation, all in `packages/axoview-lib/src`):

| Bug | Site |
|---|---|
| Selection/hover chrome off-centre | `components/TransformControlsManager/TransformControls.tsx` (+ Node/Rectangle/TextBox variants, `HoverOutline.tsx`) |
| Node hover/click/drag-over missed | `utils/hitDetection.ts` (`itemAtPoint`, now pixel-accurate) |
| Rectangle snapped back on drop (WebGL bulk path) | `components/SceneLayers/Rectangles/RectanglesCanvas.tsx` |
| Textbox/rect hit-test missed | `utils/hitDetection.ts` (`queryTileFor` offset shift, still tile-granular) |
| Right-click opened canvas menu on off-grid items | `interaction/usePanHandlers.ts:~278` |
| Node label grabbed off-position + swallowed right-click | `components/SceneLayers/Nodes/NodeLabelHitLayer.tsx` |

**The one proven-wrong approach (do not retry):** making the tile spatial index offset-aware by re-keying items on `round(tile + fromCanvasPoint(offset))`. The offset is sub-tile; any integer-tile representation discards up to half a tile (real captured case: offset `(-75,-3)` quantised to a diagonal one-tile shift, hit centre ~38 px from the drawn node). All off-grid hit-testing must compare in **px space** against the rendered footprint.

## Goal

Make "forgot the offset" (a) structurally hard to write, (b) impossible to ship unnoticed. One shared rendered-geometry source consumed by every renderer/chrome/hit-test path, one invariant test family that fails if any consumer drifts, and e2e coverage of the sub-tile regime that tile-centre drags structurally cannot exercise.

**Not a goal:** changing off-grid UX behaviour (except the two small consistency items in E), introducing fractional tile coords, adding a spatial index over footprints, or touching the perf-sensitive render loops' output.

## Scope

### In scope
- New `utils/renderedGeometry.ts` single source of truth + refactor of all hand-rolled `+ offset` sites.
- Source-scan contract test enforcing the helper.
- Parametrized invariant test family (render == chrome == hit zone) incl. WebGL corner extraction.
- E2E: sub-tile drags, real-mouse hit/menu assertions, the lasso-accumulate repro.
- `DragItems` snap predicate folded back through `resolvePlacement` (ADR 0023 as-built caveat).
- Terminology cleanup + ADR 0023 addendum; strip/convert the `⚠ TEMP DIAGNOSTIC` code.
- Textbox/rectangle hit-test upgraded from tile-granular to footprint-accurate; NodeLabelHitLayer/LabelHitLayer shared pointer contract.

### Out of scope
- Re-snapping existing off-grid items when the global toggle turns ON (freeze current behaviour with a test; product decision pending — see F3).
- Spatial index over rendered footprints (revisit only if perf-smoke trips; ADR 0021's TileIndex is untouched).
- Connector routing changes.

## Locked decisions (design review 2026-07-23)

| # | Decision |
|---|---|
| 1 | **One helper module, not a selector-layer fold.** `packages/axoview-lib/src/utils/renderedGeometry.ts` exports pure functions — `getRenderedTilePosition({tile, offset}, getTilePosition/strategy)` (origin point in SceneLayer px) and `getRenderedFootprint(item, …)` (iso diamond / 2D square / multi-tile box, the shape hit-testing needs). The store keeps `tile` authoritative (engine invariant, ADR 0023); consumers stop hand-rolling composition. No schema/lean-save churn. |
| 2 | **Enforcement = source-scan contract test**, repo precedent `backendRoutes.contract.test.ts`. It greps `packages/axoview-lib/src` for offset-composition patterns (`offset?.x ?? 0`, `offset?.y ?? 0`, `+ *\w+\.offset\.`) and fails on any file outside an explicit allowlist (`renderedGeometry.ts`, schemas, reducers that *write* offset). ESLint `no-restricted-syntax` rejected: can't distinguish read-compose from legitimate writes. |
| 3 | **Invariant test asserts rendered artifacts, never helper-vs-helper** (a helper-everywhere refactor makes helper comparisons tautological). Sources of truth per surface: RTL-rendered DOM `style.left/top` / CSS vars (`--ff-off-x/y`) for elements and chrome; extracted pure corner functions for WebGL/Canvas2D paths; real `getItemAtTile` calls for hit zones. One-time mutation gate during implementation: comment out the offset composition in one consumer → the suite MUST go red (record which consumer in the test header's "Why this exists"). |
| 4 | **Offset corpus** (used by every parametrized tier): `(0,0)` [snapped], `(-75,-3)` [the real regression case — nearly horizontal, quantises diagonally], `(±halfW−ε, 0)`, `(0, ±halfH−ε)` [half-tile boundaries], `(0.5, 0.5)` [sub-px], `(140, 90)` [multi-tile]. Both canvas modes (ISOMETRIC, 2D). |
| 5 | **Pixel hit-testing stays O(N), no footprint spatial index.** It runs only on gesture paths (hover per tile-crossing, click once); perf-smoke CI + the ADR 0020 harness guard it. Revisit only on measured evidence. |
| 6 | **WebGL path is tested by geometry extraction, not pixel readback** — jsdom has no GL context. Extract the rectangle corner/vertex math from `RectanglesCanvas.tsx` into a pure function (in or beside `renderedGeometry.ts`), and assert **cross-path equality**: WebGL corners == the DOM `<Rectangle>` path's rendered box for the same item. (Bug #3 lived exactly in the gap between these two paths.) Keep it allocation-light — it runs in the bulk render loop. |
| 7 | **E2E drives real `page.mouse` for hit/menu specs** (precedent: `connector-realmouse.spec.ts` — synthetic pointer sidesteps `elementFromPoint`, which is where the label-layer bug lived). Synthetic-pointer stays fine for pure model assertions. |
| 8 | **Canonical terminology: "SceneLayer px (post-projection)".** Derivation, load-bearing: `DragItems.preciseDelta = screenDelta / zoom`, applied after the projection as a translate in SceneLayer space. Fix ADR 0023 via a dated addendum (do not rewrite the accepted text), plus the contradicting comments: `hitDetection.ts:16` ("unprojected/post-projection"), `Node.tsx`, `Rectangle.tsx`, `resolvePlacement.ts`, `snap-grid.spec.ts` header. `renderedGeometry.ts`'s header becomes the one place the coordinate spaces are defined (screen px → ÷zoom → SceneLayer/canvas px → project⁻¹ → tile). |
| 9 | **Diagnostics: strip the log, keep the overlay behind the debug flag.** Remove the `[hover-hit]` console block + temp imports in `Cursor.ts` and the unconditional `<HoverHitDebug />` mount in `Renderer.tsx`. Convert `HoverHitDebug.tsx` into a permanent dev tool (it repeatedly proved decisive): mount only when the existing `enableDebugTools` prop is set (same gate as the debug bridge in `Axoview.tsx`), refactor it onto `renderedGeometry` (drop its hand-rolled composition), drop the "⚠ TEMP" banner. |
| 10 | **DragItems folds its inline `isOffGrid` predicate back through `resolvePlacement`** — closes the "second chokepoint" drift ADR 0023's as-built caveat documents. Behaviour must be byte-identical; existing `resolvePlacement.test.ts` + DragItems mode tests guard it. |

## Sub-tasks

### A. Diagnostics disposition (small, first — clean diffs for everything after)
- [x] `Cursor.ts`: remove the `⚠ TEMP DIAGNOSTIC` imports (~line 26) and the `[hover-hit]` log block (~lines 380–400).
- [x] `Renderer.tsx`: remove the unconditional import + `<HoverHitDebug />` mount (lines ~34–35, ~611–612).
- [x] `HoverHitDebug.tsx`: re-home as a debug tool gated on `enableDebugTools` (wire the flag down or read it from the same source `Axoview.tsx:156` uses); keep `data-axoview-id="debug-cursor-dot"/"debug-footprint-dot"`; update its header comment (no longer TEMP). — moved to `components/DebugUtils/`, mount gated by the `enableDebugTools` Renderer already reads (line ~127, same gate as `<SizeIndicator />`).
- [x] Grep `TEMP DIAGNOSTIC|hover-hit` returns zero hits afterwards.

### B. `renderedGeometry.ts` — single source of truth (the substrate)
- [x] Create `utils/renderedGeometry.ts` with the coordinate-space definition header (decision 8) and pure functions per decision 1. Signature style: take the projection accessor (`getTilePosition` from `useCanvasMode()` / `getStrategy(canvasMode)`), never import React. — exports `getRenderedOffset`, `getRenderedTilePosition`, `getRenderedTileFootprint` / `tileFootprintAt`, `getRenderedAreaCorners` (the extracted WebGL vertex math, decision 6), `footprintContainsPoint`, plus `RENDERED_DRAG_TRANSFORM` / `getRenderedDragTransform` for the two DOM wrapper sites. Decision 1's single `getRenderedFootprint` is split tile/area because the two take different inputs (a tile vs a from/to range). NOT re-exported from `utils/index.ts` (same `src/config` cycle as `resolvePlacement`).
- [x] Refactor every composition site onto it. Current inventory (`grep "offset?.x ?? 0"` + `Node.tsx` CSS vars): `TransformControls.tsx` (offX/offY), `NodeTransformControls.tsx`, `NodeGroupTransformControls.tsx`, `LabelTransformControls.tsx`, `HoverOutline.tsx`, `HoverHitDebug.tsx`, `hitDetection.ts` (`itemAtPoint`), `RectanglesCanvas.tsx`, `NodeLabelHitLayer.tsx`, `Node.tsx` (`--ff-off-x/y` values), `LabelsCanvas.tsx`, `LabelHitLayer.tsx`. Rendered output must be bit-identical — this is a pure refactor. — all done; `Rectangle.tsx` and `TextBox.tsx` added to the list (same residual, applied as a wrapper `translate3d`; they were missed by the `offset?.x ?? 0` grep because they interpolate `${offset.x}px` into a template).
- [x] Apply the terminology fixes (decision 8) in the same pass; write the ADR 0023 addendum. — also `DragItems.ts`, `schemas/{views,label,rectangle}.ts`, `resolvePlacement.test.ts`, `engine-perf.spec.ts`.
- [x] Full unit + e2e suites green before moving on. — unit 150/150; e2e subset covering every refactored path (snap-grid, canvas-node-render, label-drag, label-entity, contextmenu-scope, canvas-selection-polish) 18/18. Full e2e sweep deferred to the end-of-work run.

### C. Source-scan contract test (locks B in place)
- [x] `utils/__tests__/renderedGeometry.contract.test.ts` per decision 2, with a "Why this exists" header telling the seven-bug story in two sentences. Adding a new hand-rolled composition anywhere in `src` fails CI with a message pointing at `renderedGeometry.ts`. — three patterns (nullish-coalesced read, `+ x.offset.x`, `${…offset.x}px` translate), allowlist = `utils/renderedGeometry.ts` only, `__tests__` dirs skipped. Each pattern is itself pinned by a positive/negative sample so a rotted regex can't pass silently. Verified red against a deliberate plant in `HoverOutline.tsx`, then removed.

### D. Invariant test family (the test that would have caught all seven)
- [x] `utils/__tests__/renderedGeometry.invariant.test.tsx` — parametrized: **element kind × offset corpus × canvas mode** (decisions 3–4). Per case assert, within ±0.5 px:
  - node DOM position (`Node.tsx` CSS vars / computed style) == chrome (`TransformControls` ring `left/top` + anchor corners) == hover outline == `getItemAtTile({point})` hit at the rendered centre **and** a miss at the bare-tile centre when the offset is large;
  - rectangle: DOM path box == extracted WebGL corners (decision 6) == hit zone;
  - textbox: rendered box == chrome == hit zone;
  - node label hit box (`NodeLabelHitLayer`) sits at node rendered position + label anchor.

  Landed as 162 cases (2 modes × 9 offsets × 9 tiers). Two deviations from the sketch, both strictly stronger: (a) the tolerance is **1e-6 px, not ±0.5 px** — every assertion is exact arithmetic on style values, and at ±0.5 px the corpus's `(0.5,0.5)` case survives a consumer dropping the offset entirely; (b) the WebGL/DOM rectangle tier asserts the **offset delta** per corner rather than absolute cross-path equality — the bulk's iso matrix is a deliberate 3-decimal approximation with the sub-pixel `e,f` translation dropped (~0.9 px on a 3-tile rect), so an absolute comparison would need a tolerance looser than the offsets it must catch. Expectations are derived from `getStrategy(mode).toScreen` + a hand-written vector add, never from `renderedGeometry`.
- [x] Context-menu variant decision: unit-test the `usePanHandlers` right-click target resolution (or extract it) — off-grid item under cursor → ITEM menu; bare tile beside it → canvas menu. (Bug #6's home; `usePanHandlers.test.ts` already exists to extend.) — new `usePanHandlers.offGridMenu.test.ts` rather than an extension: the existing file stubs `getItemAtTile` wholesale, so it structurally cannot see this bug. The new file drives the REAL hit test with real viewport state; verified red by dropping `point` from the `getItemAtTile` call.
- [x] Label-layer pointer contract shared test: `button !== 0` guard + own `onContextMenu` behave identically in `LabelHitLayer` and `NodeLabelHitLayer` (bug #7 was sibling drift; see E2). — `components/SceneLayers/__tests__/labelPointerContract.test.tsx`, one `describe.each` over both layers. **The `button !== 0` guard parity landed here; the `onContextMenu` parity cases are added to this same file by E2** (node labels have no `onContextMenu` until E2 gives them one, so asserting it in D would commit a red test). Note the file polyfills `PointerEvent`: without it RTL drops `button`, and the guard would appear to hold for the wrong reason.
- [x] Perform + record the mutation gate (decision 3). — consumer used: `HoverOutline.tsx`'s `HoverNode` (reverted to `getTilePosition({tile, origin:'CENTER'})`). Suite went red on 14/14 non-zero-offset cases across both modes; restored. Recorded in the invariant suite's header.

### E. Algorithm consistency fold-ins
- [x] **E1:** `DragItems` → `resolvePlacement` fold (decision 10). — `resolvePlacement.ts` now exports `isSnappedPlacement(snap, globalSnap)`; `resolvePlacement` and `DragItems` are its only callers, so the predicate has ONE definition and the two chokepoints cannot desync. **Why the predicate and not a `resolvePlacement()` call from the drag loop:** the drag needs the decision *before* it has a candidate residual (it picks the CSS preview from it), and routing every dragged item through `resolvePlacement` per frame would (a) allocate a `Placement` + a candidate offset per item per frame in the drag hot path the ADR 0020 harness guards, and (b) change behaviour in the degenerate case where the accumulated residual is exactly `(0,0)` — `resolvePlacement` collapses that to snapped, so the committed model would differ. Decision 10 requires byte-identical behaviour, so the predicate is the fold that satisfies both halves.
- [x] **E2:** Extract the shared label pointer-handling (offset application, `e.button` guard, `onContextMenu`) into one hook/util used by both `LabelHitLayer` and `NodeLabelHitLayer`; give node labels their own `onContextMenu` (today right-click on a node's label opens the canvas menu — floating labels already solve this; adopt their behaviour). — new `utils/labelPointerContract.ts` (`shouldBeginLabelDrag`, `openLabelContextMenu`, `LABEL_DRAG_SLOP_PX`); a plain util, not a hook, since none of it needs React state. Node labels now swallow the press unconditionally (they used to let right/middle fall through as a workaround) and open the NODE's item menu, matching a right-click on the node body. The `onContextMenu` parity cases were added to `labelPointerContract.test.tsx` here, as D planned.
- [x] **E3:** Upgrade textbox + rectangle hit-testing from the tile-granular `queryTileFor` shift to footprint-accurate px containment via `getRenderedFootprint` (removes the residual rounding; nodes already are). Invariant suite (D) must pass unchanged for snapped items. — `queryTileFor` deleted; both shapes now test the cursor against `getRenderedAreaFootprint`, i.e. the EXACT quad `RectanglesCanvas` draws. Snapped behaviour is unchanged (the tile-rounding boundaries and the quad edges coincide at the half-tile lines). The invariant suite gained a "not at the cell it vacated" case that goes red if the area test is put back on the tile path — verified.

### F. E2E — the sub-tile regime
- [x] **F1:** New `off-grid-pointer.spec.ts` (real `page.mouse`, decision 7): sub-tile drag by a non-tile-multiple delta (e.g. +37,+11 px) → element's DOM box moved by exactly that delta (not snapped); hover at the drawn position raises the hover outline whose box ≈ element box; click there selects it; chrome box ≈ element box; right-click on it → **item** menu (assert the per-item Snap/Unsnap entry), right-click one tile away on empty grid → **canvas** menu; node-label grab at its real position. — all landed. Two notes: (a) the per-item Snap/Unsnap entry is deliberately HIDDEN while global snap is off (ADR 0023's 2026-06-21 UX addendum), so that assertion flips the global toggle on first — which the F3 freeze behaviour makes safe; (b) hover needed a parked cursor plus one extra pixel of movement — `hasMovedTile` gates the recompute and the recompute lags the position by one move event. That lag is pre-existing and off-grid-independent (snapped items behave identically); noted, not changed.
- [x] **F2:** Extend `snap-grid.spec.ts` with the user's deterministic repro: unsnap → lasso-select several → move together (accumulates offset) → deselect → right-click each → item menu; plus reload → rendered position (DOM box), not just model offset, survives. — the reload case has to seed `axoview-diagrams` + `axoview-last-opened` as well as `axoview-last-opened-data`: the fixture's diagram is never written to the explorer, so a plain reload comes back on the empty-state screen with the model restored but nothing painted (which is why `label-drag.spec`'s reload case only reads the model). Boot also fit-to-screens, so the assertion is "drawn at tile+offset in the NEW viewport, still clickable there, and NOT at its cell" rather than a client-coordinate comparison across the refit.
- [x] **F3:** Freeze-behaviour test: toggling global snap ON does NOT re-snap existing off-grid items (documents today's behaviour as deliberate pending the product decision; one-line note in PLAN.md open questions). — test also re-checks that the frozen item is still grabbable at its drawn position afterwards. The PLAN.md note lands with G's wrap-up line.
- [x] Assertions via DOM bounding boxes + the `window.__axoview__` bridge for model reads — no screenshots, no bridge extension unless something is genuinely unreachable (if needed, add a read-only `hitTest(point)` to the bridge rather than reaching into internals). — no bridge extension was needed. Two `data-axoview-id` hooks WERE added to product code: `canvas-hover-outline` / `canvas-selection-chrome` on the two chrome components' root `<Svg>`, which carried no identifying attribute at all. Shared helpers live in `packages/axoview-e2e/helpers/offGrid.ts`.

### G. Docs & wrap
- [x] `guidelines/testing.md`: additions table for the new suites (repo discipline), incl. the "Why this exists" pointers. — new "ADR 0023 hardening additions" section + refreshed lib totals (1723 / 154 suites) and the e2e spec-file count.
- [x] ADR 0023 addendum (decision 8 + decisions 5/6 rationale + pointer to the invariant suite as the new acceptance surface). — dated 2026-07-23, §§A–G: terminology, the one-source rule + the proven-wrong tile-rounding fix, the O(N) cost model, WebGL-vs-DOM by construction, the §2 as-built caveat closed (E1), the shared label pointer contract (E2), and the new acceptance surface. The accepted text is untouched; §1 gained a one-line pointer block to the addendum so nobody reads the wrong semantics out of it.
- [x] `git grep` the retired terms ("unprojected px" describing `offset`) → zero live hits. — zero in code and in every doc EXCEPT ADR 0023's own accepted text, which decision 8 says not to rewrite; that text now carries the pointer block above. The surviving `unprojected` matches elsewhere are the legitimate ones (`UNPROJECTED_TILE_SIZE`, `getUnprojectedBounds`, authored-in-unprojected-tile-space stroke widths).

## Wrap-up

1. [x] Add one line under the relevant PLAN.md phase: `Off-grid rendered-geometry hardening shipped — see ADR 0023 addendum + docs/guidelines/testing.md (this file's git history for the plan).` — added to the UX-CANVAS row, together with F3's open question about re-snapping on global-toggle-ON.
2. [ ] Delete this file (after the reviewing agent signs off). — **left in place deliberately; it is the review checklist.**
3. [x] Refresh any memory pointer referencing this tactical.

## Notes for Claude (implementing agent)

- **Never round an offset into a tile.** The postmortem's failed fix is the trap shape for this codebase: verified-on-paper transform identities still discard sub-tile truth. Hit-testing compares px against footprints, full stop.
- **Tautology is the failure mode of the invariant suite.** If a case can only fail when `renderedGeometry.ts` itself is wrong, it's testing nothing — every assertion must read a rendered artifact (DOM style, extracted vertices, real hit-test call). The mutation gate in D is how you prove it.
- Workstream B must be behaviourally invisible. If any e2e moves, you introduced a regression, not a refactor.
- `RectanglesCanvas` corner math runs in the bulk render loop — the extracted function must not allocate per corner per frame (match the current code's discipline).
- jsdom: no WebGL context (hence decision 6) and remember `jest` here resolves `src/...` via ts-jest paths.
- E2E runs `workers: 1`, sharded at file granularity in CI — new spec files are fine; keep them lean; never flip `fullyParallel`.
- The synthetic-pointer POM path forces `isRendererInteraction` and dispatches at a single point — that's exactly the blindness that hid these bugs. Real-mouse for anything asserting hit zones or menus (decision 7).
- `getTilePosition` has ~140 legitimate uses; only *item-position composition* sites move to the helper. Don't refactor grid math, backgrounds, or placement previews that genuinely want the bare tile.
- Run `npm run test:unit` after B/C/D/E; run the two touched e2e specs locally (`npx playwright test snap-grid off-grid-pointer --config packages/axoview-e2e/playwright.config.ts`) before handing to CI.

## Progress log

<!-- One line per landed workstream: date · what landed · commit subject. A fresh
     session resumes from the last entry + the checkboxes above; the hash is
     backfilled by the next workstream's commit (a commit cannot contain its own
     hash), so the newest entry may carry `(this commit)` instead. -->

- 2026-07-23 · **A** — temp `[hover-hit]` log + temp imports stripped from `Cursor.ts`/`Renderer.tsx`; `HoverHitDebug` re-homed to `components/DebugUtils/` behind `enableDebugTools`. Unit suite green (150/150). · `refactor(off-grid): retire the temp hover-hit diagnostics` · `478a4124`

- 2026-07-23 · **B** — `utils/renderedGeometry.ts` created (coordinate-space header + pure composition/footprint helpers); all 14 hand-rolled composition sites refactored onto it, incl. the WebGL rect vertex math extracted out of `RectanglesCanvas`; "unprojected px" retired everywhere it described `offset`; ADR 0023 dated addendum written. Unit 150/150, e2e subset 18/18, knip + tsc clean. · `refactor(off-grid): one rendered-geometry source of truth` (this commit)
- 2026-07-23 · **C** — `renderedGeometry.contract.test.ts` landed and verified red-on-plant. The scan immediately caught a 15th composition site B's `offset?.x ?? 0` inventory had missed (`NodesCanvas.tsx:462`, the WebGL node bulk); refactored onto `getRenderedTilePosition` in this commit. Unit 151/151. · `test(off-grid): fail CI on hand-rolled offset composition` (this commit)
- 2026-07-23 · **D** — invariant suite (162 cases), off-grid right-click menu resolution test, shared label pointer-contract test. Mutation gate performed on `HoverOutline` → 14 red, restored; the menu test independently verified red by dropping `point` from its `getItemAtTile` call. Unit 154 suites / 1719 tests green. · `test(off-grid): invariant suite for render == chrome == hit zone` (this commit)
- 2026-07-23 · **E** — E1 predicate fold (`isSnappedPlacement`), E2 shared `labelPointerContract` + node-label context menu (the one intended behaviour change), E3 footprint-accurate textbox/rectangle hit-testing. Unit 154 suites / 1723 tests; e2e subset over labels, context menus, drag, lasso and snap-grid 19/19. · `refactor(off-grid): fold the drag, label and area-hit paths onto one contract` (this commit)
- 2026-07-23 · **F** — `off-grid-pointer.spec.ts` (3 real-mouse cases: exact sub-tile delta, hover/chrome/menu at the drawn position + canvas menu on the vacated cell, name-chip grab & right-click) and three new `snap-grid.spec.ts` cases (lasso-accumulate → per-item menus, reload-survives-as-painted, global-snap-ON freeze). Shared helpers extracted to `helpers/offGrid.ts`; `canvas-hover-outline` / `canvas-selection-chrome` test hooks added to the chrome components. 9/9 green across both specs. · `test(off-grid): e2e coverage for the sub-tile regime` (this commit)
- 2026-07-23 · **G** — `guidelines/testing.md` additions section + refreshed totals; ADR 0023 addendum extended with E1/E2 and a pointer block on the superseded §1 wording; retired terminology verified clear; PLAN.md wrap-up line + F3 open question; memory pointer refreshed. The tactical doc itself is NOT deleted — it is the review checklist. · `docs(off-grid): record the hardening pass in testing.md, ADR 0023 and PLAN` (this commit)

**Status: A–G complete.** Unit 154 suites / 1723 tests (+1 skipped); the off-grid e2e specs 9/9; `tsc --noEmit`, `eslint`, `knip` and `lint:docs` clean. The full e2e sweep is the remaining gate — see the handover note below.

## Review (plan author, 2026-07-24)

Reviewed against the ten locked decisions: targeted read of `renderedGeometry.ts`, the contract + invariant suites, the E1/E3 diffs, and every flagged deviation. **All deviations accepted:**

| Deviation | Verdict |
|---|---|
| D tolerance 1e-6 px instead of ±0.5 | Approved — strictly stronger; the "(0.5,0.5) survives at ±0.5" argument is correct and fixes a latent weakness in the plan's own spec. |
| WebGL/DOM tier asserts offset **delta** per corner | Accepted. Decision 6's intent (the two paths cannot disagree) is now enforced *structurally* — area hit-testing consumes the identical `getRenderedAreaCorners` the bulk renderer draws — and the delta pin proves offset composition at a tolerance absolute comparison cannot reach (documented ~0.9 px base approximation). See follow-up R1. |
| E1 folds the predicate (`isSnappedPlacement`), not a `resolvePlacement()` call | Approved — one definition, two callers, byte-identical; the zero-residual-collapse observation is a sharp catch that a naive fold would have shipped as a behaviour change. |
| Two `data-axoview-id` chrome hooks in product code | Approved — same affordance class as `data-draw-count` (ADR 0020 anti-cheat). |
| New `usePanHandlers.offGridMenu.test.ts` instead of extending the existing file | Approved — the existing file stubs `getItemAtTile` wholesale and is structurally blind to this bug class; verified red. |
| 15th composition site (`NodesCanvas.tsx:462`) found by C | That is the contract test earning its keep before merge. |

**Follow-ups before wrap (neither blocks the e2e sweep; both are sweep-independent):**

- [x] **R1 (done):** one coarse absolute assertion in the rectangle tier — DOM path base vs `getRenderedAreaCorners` base agree within a documented ~1.5 px on the 3-tile fixture. The delta assertion is structurally blind to a *base* error (matrix fat-finger, wrong origin tile, dropped `origin:'LEFT'`), and because hit-testing shares the function, such an error moves render + hit + chrome *together* — the invariant suite stays green while every rectangle visibly shifts. One cheap tripwire closes that. — landed in the `iso-ring chrome` case of `renderedGeometry.invariant.test.tsx`: the snapped chrome's origin (`useIsoProjection.position`, its own `getTilePosition`/`getBoundingBox` call — independent of `renderedGeometry`) must land on `getRenderedAreaCorners(...)[0]` within 1.5 px. Verified: a one-tile base error in the iso branch trips 18 cases (2D correctly unaffected), and it is the base pin catching it — the delta assertions stay green.
- [x] **R2 (done):** record the two unactioned pre-existing observations in `known_issues.md` (the repo's register — spec comments rot invisibly): (a) hover recompute lags the cursor by one mousemove (`hasMovedTile` gate); (b) the e2e fixture's diagram is never written to the explorer, so a plain reload lands on the empty state with the model restored but nothing painted. — both added as `## Hover feedback lags the cursor by one mousemove` and `## E2E canvasReadyTest fixture: a plain reload lands on the empty state` (each Status: Open, deferred).

**Sign-off:** granted contingent on the full e2e sweep passing and R2 landing (R1 strongly recommended). After that, execute Wrap-up step 2 — delete this file; the ADR 0023 addendum + testing.md are the durable record.
