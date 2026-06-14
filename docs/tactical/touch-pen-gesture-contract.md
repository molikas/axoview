# Tactical — Touch / Pen Canvas Gesture Contract (Consolidated Execution Plan)

> **Read first (in order):**
> - [ADR 0018 — Touch / Pen Canvas Gesture Contract](../adr/0018-touch-pen-gesture-contract.md) — the locked contract (decisions now resolved; see §0 here).
> - [canvas-interaction-baseline.md](canvas-interaction-baseline.md) — DOM stacking + event routing + the `isRendererInteraction` gate (the **mechanical** layer, §1–§5).
> - [canvas-interaction-behavior-map.md](canvas-interaction-behavior-map.md) — per-mode state tables, algorithm contracts, the **PERFORMANCE DOSSIER (§3)**, the abort/undo divergence register (§4), the coverage matrix + gap list (§5), and the one-screen rewrite checklist (§6). **Read §3 before touching the dispatcher.**
> - [ADR 0006 — Canvas Selection Contract](../adr/0006-canvas-selection-contract.md) — selection invariants every touch path must preserve.
> - [docs/ux-principles.md](../ux-principles.md) §4 (`isItemInteractable`), §4.4 (waypoint grouping), §8.8 (canvas-anchored chrome counter-scale), §8.11 (annotation = the Pointer-Events precedent).
>
> **Status:** Ready to implement — **decisions locked 2026-06-14** · **Owner:** molikas · **Last updated:** 2026-06-14
>
> Short-lived working doc. Delete after merge; ADR 0018 + the two reference docs are the durable record. See "Wrap-up".

---

## Executive summary (cold-start for the new session)

**Objective:** Replace the canvas's `window`-mouse + touch-synthesis input path with a single Pointer Events layer bound to `rendererEl`, branching on `pointerType` — mouse/trackpad keep press-drag-release, touch/pen get tap-to-select / tap-to-place — to a maintainability standard, with the full suite green, the canvas-interaction e2e gaps closed, and zero dead code. The confirmed P0 undo bug (D-7) lands first.

**Key Results (binary):**
- **KR0.** D-7 dual-stack undo skew is fixed (sequence-stamping) and the corrected-behavior assertion in `undo.dualStackSkew.test.tsx` is unskipped and green, **before** the input rewrite lands in the branch.
- **KR1.** The `window` mouse+touch listeners and the mouse-synthesis path are GONE; one Pointer Events layer is bound to **`rendererEl`** (not the inner box). `grep` for `onTouchStart/Move/End` + the `window` mouse listeners in `useInteractionManager` returns zero hits.
- **KR2.** `pointerType` branch works: the FULL existing e2e suite is green after only the CanvasPOM/connector-helper `MouseEvent→PointerEvent` migration (zero assertion changes = mouse path unchanged); touch/pen run the SELECT→GRAB→PLACE machine.
- **KR3.** The px tap-vs-pan threshold replaces the whole-tile one; all four guardrails are live on the container; touch navigation is complete — one-finger drag pans, two fingers pinch-zoom + pan — all routed through `setScroll`/`setZoom` (React-render-free).
- **KR4.** Canvas-interaction e2e coverage gaps closed: new `hasTouch` project + touch specs; the §5.1 P0 gaps (CSS-preview mid-drag invariant, drag-start threshold re-point, D-7 skew, NodeActionBar, per-mode Escape-abort) are guarded.
- **KR5.** No dead code / no parallel paths: `SlimMouseEvent` retained as the internal adapter; typecheck + lint + build + `npm test` + the e2e suite all clean.

**Git:** branch `feat/touch-pen-gesture` off `integration`; PR targets `integration`. Commit/push only when asked.

---

## 0. Locked decisions (consolidated)

ADR 0018 Decisions 1–8 stand, **with the corrections + resolutions below applied** (2026-06-14). These supersede the "Open contract questions" — ADR 0018 is being updated to match.

| # | Decision | Note |
|---|---|---|
| 1 | Foundation = Pointer Events on **`rendererEl`** (the Renderer container), `window` mouse+touch listeners + synthesis removed. | **Corrected** from "canvas-interactions Box": anchors/labels are sibling subtrees of the inner box (baseline §6.2/§8). `setPointerCapture` on the **interactions Box** so `isRendererInteraction` stays true mid-gesture. |
| 2 | Branch on `pointerType`: `mouse` → press-drag-release (unchanged); `touch`/`pen` → tap-to-place. Additive branch. | — |
| 3 | Tap-to-place = **SELECT → GRAB → PLACE**: tap selects, tap-same-item grabs, tap target places at nearest unoccupied tile. No finger-follow. | — |
| 4 | Tap-vs-pan is **pixel-based** (`TAP_SLOP_PX`/`TAP_TIME_MS`, config module), applied to **all** `pointerType`s (also fixes the trackpad whole-tile bug). | — |
| 5 | Long-press-to-grab **rejected** (collides with native OS long-press menu). | — |
| 6 | `pointercancel` / second finger mid-GRAB aborts the carry; **node stays at origin — scoped to the CSS-preview node carry only** (D-2 resolved). | **LOCKED:** no `rollbackDragTransaction` in this feature. Reconnect/rectangle/textbox abort is out of scope (they mutate per-frame, no rollback). ADR Decision 6 reworded to say "node carry". **Context precedence:** during a GRAB a 2nd finger = abort; **outside** a grab, 2 fingers = pinch/two-finger pan (D-12). |
| **D-12** | **Touch navigation = one-finger pan + two-finger pinch-zoom + two-finger pan.** Pinch is **IN scope** (was an ADR non-goal). | **LOCKED 2026-06-14.** No hand-tool required. 2-pointer tracking: distance ratio → `setZoom`, centroid shift → `setScroll`, both through the `SceneLayer`-subscribed store (render-free, behavior-map §3.8). Zoom-to-centroid mirrors wheel zoom-to-cursor. On-screen `+`/`−` (ZoomControls) remain as the button path. ADR non-goal + consequence updated. |
| 7 | Four guardrails on the container: `touch-action:none`, `user-select:none` + `-webkit-touch-callout:none`, `contextmenu` preventDefault (incl. during grab), `pointercancel` abort. | On **`rendererEl`** so they cover the `auto` anchor/label elements too. |
| 8 | Surface vocabulary (ADR 0008 D2) not extended; "carrying" = canvas drag-preview chrome via the `DragItems` preview path + §8.8 counter-scale. | — |
| **D-6** | **Per-item actions on touch route through the Properties (right) panel.** The floating NodeActionBar stays **desktop/right-click-only**. | **LOCKED 2026-06-14.** No new gesture, no new canvas chrome. tap-on-selected stays GRAB (Decision 3). Confirm every NodeActionBar action (delete / assign-layer / start-connector / z-order / edit name/style/notes/link) has a Properties-panel route on touch; file a follow-up for any that don't. |
| **D-7** | **The dual-stack undo fix lands as commit 1 of this branch**, before the input rewrite. | **LOCKED 2026-06-14.** Sequence-stamping across `useHistory` + both stores + `useSceneActions`; unskip the corrected-behavior test. See Phase 0. |

---

## 1. Consolidated divergence register — dispositions

From behavior-map §2.8/§4. Every item has an explicit destination so nothing is silently dropped.

| # | Finding | Disposition in this initiative |
|---|---|---|
| **D-7** | Dual-stack undo skew → invisible connector (CONFIRMED P0) | **FIX — Phase 0 (commit 1).** Sequence-stamping. Unskip `undo.dualStackSkew.test.tsx`. |
| **D-8** | paste→undo→redo restores empty connector paths (D-7 family) | **FOLD INTO Phase 0** if the stamping fix covers it; else add a guarding test + fix in the same commit. Confirm during Phase 0. |
| **D-9** | cross-view page-switch undo applies scene patches to wrong view (D-7 family) | **FOLD INTO Phase 0** (same family). Add the code-traced repro as an e2e in Phase D; fix with the stamping work if in reach, else file a tracked follow-up — do **not** silently leave it. |
| **D-1** | Only CONNECTOR draw aborts on Escape | **OUT OF SCOPE** (D-2 locked to node-carry-only → no uniform abort this feature). Catalogue; revisit with a future `rollbackDragTransaction`. |
| **D-2** | No `rollbackDragTransaction` | **RESOLVED — node carry only** (Decision 6). No primitive added. |
| **D-3** | Rectangle/transform/textbox = N undo entries + per-frame immer (no drag-txn) | **FOLD INTO Phase C** *opportunistically*: since the px-slop threshold (Decision 4) makes these emit more intermediate writes, wrap them in `beginDragTransaction` while in the file. If it balloons scope, catalogue + file follow-up. |
| **D-4** | Right-click mid-connector may leak the drag-txn | **RUNTIME-VERIFY in Phase A.** If confirmed, fix in Phase A (the abort-symmetry invariant). Add the guard from behavior-map §3.1. |
| **D-5** | Mid-drag tool-hotkey = undocumented partial-abort | **CATALOGUE.** Document; no behavior change unless it falls out of the abort work. |
| **D-6** | Touch has no NodeActionBar path | **RESOLVED — Properties panel** (above). Phase C verifies routes. |
| **D-10** | Duplicated tile→px projection math (`DragItems.tileDeltaToPixels`) | **FIX IF CHEAP in Phase C** (derive preview delta from the active strategy). Else catalogue. |
| **D-11** | `getMouse` ISO-hardcoded default `screenToTileFn` | **GUARD in Phase A:** every rewrite call to `getMouse` injects `useCanvasMode().screenToTile`. Rewrite invariant. |
| **I-1** | `isItemInteractable` (locked/hidden non-interactive) | **INVARIANT** — every new tap-select path consults it (Phase C). |
| **I-2** | `getConnectorWaypointRefs` (connector carries waypoints) | **INVARIANT** — touch connector-select pulls waypoints (Phase C). |
| **I-3** | single-source selection (selectedIds ⇔ itemControls) | **INVARIANT** — touch SELECT goes through `setSelectedIds`/`setItemControls` (Phase C). |

---

## 2. Sequenced plan

Land each phase **green before the next**. Use `TodoWrite` to track.

### Phase 0 — D-7 dual-stack undo fix (commit 1, before the rewrite)

> Why first: the rewrite makes paired drag-commits the **hot path**, raising the odds of hitting the skew. The fix is cross-cutting (not store-local), so it gets its own commit with its own green gate.

- [ ] Implement **logical-action sequence-stamping** (behavior-map §4.5 minimal-fix design): a monotonic counter shared by `modelStore` + `sceneStore`; each history entry a `set()` pushes is stamped; a logical action (`beginDragTransaction` / `transaction` / standalone `set`) allocates **one** sequence and both stores stamp the same value.
- [ ] `useHistory.undo`: `target = max(modelTopSeq, sceneTopSeq)`, undo **only** the stack(s) whose top equals `target`; redo symmetric with `min` of future tops.
- [ ] Spans `useHistory` + `modelStore` + `sceneStore` + `useSceneActions` (seq allocation).
- [ ] **Unskip** the corrected-behavior assertion in [`undo.dualStackSkew.test.tsx`](../../packages/axoview-lib/src/__perf_refactor_regression__/undo.dualStackSkew.test.tsx); it must pass. The characterization (skew-source) assertions stay.
- [ ] Confirm **D-8** (paste→undo→redo) and **D-9** (cross-view undo) against the fix; add the two e2e repros (Phase D). Fix what the stamping covers; file a tracked follow-up for any residual, explicitly (no silent drop).
- [ ] `connector.createUndoRedo.test.tsx` (MQA #5 direction) stays green — the fix must not regress the store-local correctness.

### Phase A — Pointer-event unification (foundation)

- [ ] Bind `pointerdown/move/up/cancel` + `contextmenu` to **`rendererEl`** ([Renderer.tsx:167-181](../../packages/axoview-lib/src/components/Renderer/Renderer.tsx#L167-L181)); keep `wheel`/`dragstart` on `rendererEl`. **Remove** the `window` mouse listeners, `onTouchStart/Move/End`, and the `(0,0)` synthesis ([useInteractionManager.ts:864-967](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L864-L967)). **REPLACE, do not ADD** (double-fire is the top correctness trap).
- [ ] Map `PointerEvent → SlimMouseEvent` inside the manager — keep it **mouse-shaped** (`type ∈ {mousedown,mousemove,mouseup}`, carry `button`/`buttons`/modifiers). Mode reducers stay untouched.
- [ ] `setPointerCapture(interactionsBox)` on `pointerdown` (after `targetAnchorId` is read from `e.target`), implicit/explicit release on up/cancel — so `isRendererInteraction` (`=== interactions box`) stays true mid-gesture and replaces the old "moves fire on `window`" property. Keep the `data-anchor-id` exception in the gate (D-11-adjacent — anchor overlay).
- [ ] Thread `pointerType` into the mode `State` (a new field; keep it **out** of any slice the SceneLayers subscribe to — behavior-map §3.3).
- [ ] Route **touch/pen around `usePanHandlers`** (it is `e.button`-shaped, mouse-only — a touch `button:0` would trip `emptyAreaClickPan`). Mouse keeps the `usePanHandlers` path verbatim.
- [ ] Preserve `INTERACTIONS_DISABLED` early-return: bind **no** pointer listeners when disabled (behavior-map §1.12).
- [ ] `getMouse` calls always inject `useCanvasMode().screenToTile` (D-11).
- [ ] **RUNTIME-VERIFY D-4:** confirm `dragInProgress===false` after a right-click-cancel of an in-flight connector; fix the leak if present (abort symmetry, behavior-map §3.1/§4.5).
- [ ] Verify wheel-zoom + every mouse path behaviourally identical (mode unit tests + migrated e2e green).

### Phase B — CSS / event guardrails (on `rendererEl`)

- [ ] `touch-action: none` on `rendererEl` (covers anchors/labels too — baseline §8).
- [ ] `user-select: none` + `-webkit-user-select: none` + `-webkit-touch-callout: none` on `rendererEl`.
- [ ] `contextmenu` `preventDefault` retained; additionally suppressed during a GRAB.
- [ ] `pointercancel` wired to the abort transition (Phase C).
- [ ] Confirm `touch-action:none` does not block page scroll outside the canvas (scoped to `rendererEl`).

### Phase C — Tap-to-place state machine (touch/pen)

- [ ] Add the px tap-vs-pan classifier (`TAP_SLOP_PX` / `TAP_TIME_MS`) in a **config module** (e.g. `src/config/tapGesture.ts`, mirroring `config/hotkeys.ts`). Apply it to **all** `pointerType`s — it replaces the whole-tile drag-start in [Cursor.ts:501-505](../../packages/axoview-lib/src/interaction/modes/Cursor.ts#L501-L505) (compare `position.screen` vs `mousedown.screen`, zoom-independent px) **and** the whole-tile click-vs-clear in [Cursor.ts:561](../../packages/axoview-lib/src/interaction/modes/Cursor.ts#L561). Re-point the existing drag-start unit test (§5.1 / gap 3), don't delete it.
- [ ] Implement SELECT → GRAB → PLACE for `touch`/`pen`. **Recommended:** route touch/pen through `processMouseUpdate` with `pointerType` in State; SELECT reuses the existing tap=click select in `Cursor`; add a dedicated **`CARRY_ITEM` mode** for GRAB/PLACE/abort (holds the carried `ItemReference`; the Node reads it for the affordance). Keep the `pointerType` branch **in one place** (the manager's touch path + the `CARRY_ITEM` transition), not scattered per mode. Extract the tap-decision into a **pure, unit-testable** function (mirror the `Cursor.mousedown({...State})` test pattern).
- [ ] PLACE reuses `findNearestUnoccupiedTile` + the [`PlaceIcon`](../../packages/axoview-lib/src/interaction/modes/PlaceIcon.ts) commit path; returns to SELECT at the new tile.
- [ ] **Touch one-finger drag = pan:** a press that exceeds `TAP_SLOP_PX` before lift scrolls via `setScroll` (mirror [`Pan.mousemove`](../../packages/axoview-lib/src/interaction/modes/Pan.ts#L72-L84)) — through the store the `SceneLayer` direct-DOM subscription reads, so pan stays **React-render-free** (behavior-map §3.8). Not lasso, not item-drag.
- [ ] **Two-finger gestures = pinch-zoom + pan (D-12, IN scope):** maintain a map of active pointers (each finger = a `pointerId`, `isPrimary` marks the first). When a **2nd** pointer goes down **outside a GRAB**, suspend single-finger pan and enter a pinch gesture: track the two fingers' **centroid** and **distance**; per move, `setZoom(distanceRatio)` (zoom-to-**centroid**, mirroring the wheel zoom-to-cursor math in [useInteractionManager.ts:899-942](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L899-L942)) + `setScroll(centroidDelta)` — both through the `SceneLayer`-subscribed store so zoom/pan stay **render-free**. On lift back to 1 finger, resume single-finger pan. Clamp to `MIN_ZOOM`/`MAX_ZOOM`. **Context precedence:** during a GRAB a 2nd finger **aborts** the carry (Decision 6), it does **not** zoom.
- [ ] Graceful degradation even if a finger is added unexpectedly: a 2nd pointer must never make the canvas lurch — suspend the in-flight single-finger pan immediately when the 2nd finger lands.
- [ ] "Carrying" affordance: reuse the `DragItems` CSS-preview path (`--ff-drag-*` on `[data-drag-id]`) + §8.8 counter-scale (elevation/scale/opacity lift on the carried node). React-driven from `CARRY_ITEM` (carry is low-frequency, not the per-frame hot path). No new surface.
- [ ] **Invariants:** every new selection/move path consults `isItemInteractable` (I-1) and pulls `getConnectorWaypointRefs` for connector selections (I-2); SELECT writes through `setSelectedIds`/`setItemControls` (I-3).
- [ ] `pointercancel` / second finger aborts GRAB → node stays at origin (CSS preview discarded; **node carry only**, D-2).
- [ ] **D-6:** verify each NodeActionBar action has a Properties-panel route on touch; file a follow-up for gaps.
- [ ] **(Opportunistic) D-3:** wrap rectangle/transform/textbox per-frame writes in `beginDragTransaction` so the px-slop threshold doesn't worsen their N-entry undo. Drop to a follow-up if it balloons scope.
- [ ] **(If cheap) D-10:** derive `DragItems` preview delta from the active `CoordinateTransformStrategy` instead of the duplicated math.

### Phase D — E2E revision (canvas interaction coverage) — see §3

The headline deliverable beyond the rewrite. Canvas interaction is the most fragile, highest-UX-impact surface and is **under-covered today** (zero touch coverage; six P0/P1 gaps in behavior-map §5.1). §3 below is the full plan.

### Phase E — Per-device manual QA (ADR 0018 matrix)

- [ ] PC touchscreen (Win 11 Chrome/Edge): tap→tap→tap-target relocates; no corner jump; app-switch aborts.
- [ ] iPad/Safari (+ Apple Pencil = `pen`): no callout menu, no rubber-band scroll/zoom hijack; tap-to-place works.
- [ ] Android/Chrome: no native long-press menu; tap-to-place works.
- [ ] Laptop trackpad (`pointerType:mouse`): short tap selects, small drag moves (no whole-tile swallow).
- [ ] External mouse: press-drag-release byte-for-byte unchanged.
- [ ] Touch: per-item actions reachable via the Properties panel (D-6).

> Real devices are **mandatory** — DevTools emulation does not reproduce `pointerType:'pen'`, the iOS callout, or Android long-press timing.

---

## 3. E2E revision plan — make canvas interaction covered

**Principle:** canvas interaction is fragile and user-facing; every gesture that ships must have an automated guard at the lowest reliable level (unit mode-reducer where possible, e2e where the gesture is DOM/capture-dependent). This plan (a) migrates the harness, (b) adds the missing touch project, and (c) **closes the behavior-map §5.1 P0/P1 gaps** — not just the new touch work.

### 3.1 Harness migration (MouseEvent → PointerEvent) — enables everything else

- [ ] [`CanvasPOM.dispatchAt`](../../packages/axoview-e2e/pom/CanvasPOM.ts): dispatch `new PointerEvent(type, { pointerId:1, pointerType:'mouse', isPrimary:true, button, buttons, clientX, clientY, bubbles:true })`. **Preserve the per-event `requestAnimationFrame` await** (the `useRAFThrottle` dependency — behavior-map §3.7).
- [ ] Same migration for `connector.spec.ts#clickCanvasAt`.
- [ ] **Zero assertion changes** elsewhere → ~21 specs revive and that is the proof the mouse path is unchanged (KR2). `page.mouse.*` specs (connector-creation/-deep, annotation-overlay) likely survive — **verify, don't assume**.

### 3.2 New touch project + touch specs (the total gap — §5.1 P0)

- [ ] Add a `hasTouch: true` project to [`playwright.config.ts`](../../packages/axoview-e2e/playwright.config.ts) (today: single Desktop Chrome, no touch).
- [ ] New specs driven by **real `page.touchscreen` / pointer input** (not synthetic dispatch — `setPointerCapture` has no synthetic-event semantics):
  - `touch-tap-select.spec` — tap a node selects it (Properties opens); tap empty clears.
  - `touch-tap-place.spec` — tap→tap-same (GRAB)→tap-target relocates to nearest unoccupied tile; **no corner jump** (the old `(0,0)` bug); carrying affordance visible in GRAB.
  - `touch-tap-place-new.spec` — tap-to-place a new node from the Elements panel.
  - `touch-tap-vs-pan.spec` — small tap selects; one-finger drag **pans** (scroll changes, no selection/lasso).
  - `touch-pinch-zoom.spec` — two-finger pinch changes `zoom` (zoom-to-centroid), two-finger drag pans; zoom clamps at MIN/MAX; **assert zero scene React re-render** during the gesture (render-probe). (Two-pointer input via the CDP `Input.dispatchTouchEvent` / Playwright multi-touch path.)
  - `touch-pointercancel-abort.spec` — second finger / cancel mid-GRAB → node stays at origin (2nd finger aborts, does **not** zoom, during a carry).
  - `touch-connector-select.spec` — tap a connector pulls its waypoints (I-2); locked/hidden item not selectable (I-1).
  - `touch-actions-via-properties.spec` — per-item actions reachable via the Properties panel on touch (D-6).

### 3.3 Close the existing P0/P1 coverage gaps (behavior-map §5.1)

These are pre-existing canvas-interaction gaps the rewrite must not inherit blind:

| Gap (behavior-map ref) | Pri | Test to add |
|---|---|---|
| **CSS-preview mid-drag invariant** (§3.4) | **P0** | Unit/e2e: mid-drag, `view.items[].tile` unchanged **while** `[data-drag-id]` carries non-zero `--ff-drag-*` (proves no per-frame model write). The single highest-value, easiest-to-break perf invariant. |
| **Drag-start threshold** flips whole-tile → px-slop (§1.1) | **P0** | Re-point `Cursor.modes.test.ts` DRAG_ITEMS-transition assertion to the px classifier; add a sub-tile-drag-moves-node case (the trackpad fix). |
| **D-7 dual-stack skew** (§4.5) | **P0** | e2e `undo-redo-dual-stack.spec`: both-store op → model-only op → undo → assert no orphaned/invisible connector (the hazardous order the shipped spec omits). Pairs with the unskipped unit test. |
| **NodeActionBar invocation/dismissal** (§4.3) | **P1** | e2e: right-click item opens bar; left-click/Escape/multi-select dismiss; **touch routes via Properties** (D-6). No e2e exists today. |
| **Per-mode Escape-abort matrix** (D-1) | **P1** | e2e `mode-abort.spec`: assert the documented abort behavior per mode (connector aborts; others persist) so future changes are intentional. |
| **paste→undo→redo empty paths** (D-8) | P1 | e2e repro in Phase 0; assert pasted connectors keep their paths through undo/redo. |
| **cross-view undo** (D-9) | P1 | e2e repro: edit connector on page 1 → switch page → Ctrl+Z → assert no phantom connector / no off-screen revert. |
| **RAF throttle under load** (§3.7) | P1 | unit: assert `pointermove` coalesces to ≤1 processed update/frame under a burst. |
| **pan/zoom = zero scene re-render** (§3.8) | P1 | render-probe assertion (`?perfprobe=1`) that pan/zoom triggers no SceneLayer React render. |

### 3.4 Target-state canvas-interaction coverage matrix

After Phase D, every row in behavior-map §5.1 marked **GAP** at P0/P1 should be **covered**. Track it by re-running the §5.1 matrix as the acceptance checklist; the rewrite is not "done" until the P0 rows are green. Lower-priority (P2) rows (rectangle min-size/zero-area, undo-grouping divergence detail) may stay catalogued with an explicit follow-up note — not silently dropped.

### 3.5 Test-infra notes

- Mode-reducer unit tests (`Cursor.modes.test.ts` et al.) stay green **iff** `SlimMouseEvent` stays the internal contract — the cheapest desktop-regression guard. Don't leak `PointerEvent` into modes.
- `interactionManager.depStability.test.tsx` regex-greps the keydown effect's dep array — **re-tune** after the pointer-listener effects/refs change (§5.1).
- The device-agnostic perf anchor (`connector.dragPerf.test.tsx` + the 80-node fixture) **survives the rewrite unchanged** — run before/after as the timing/correctness baseline (behavior-map §3.11).

---

## 4. Load-bearing perf invariants (behavior-map §3 — do NOT silently regress)

- **RAF throttle:** every `pointermove` stays on `useRAFThrottle`; flush on `pointerdown`/`up`/`cancel`. `pointermove` fires denser than `mousemove` — dropping the throttle re-opens the MQA #7 cliff. The e2e per-event RAF await depends on it.
- **CSS-preview node drag:** keep `--ff-drag-dx/dy` on `[data-drag-id]`, the single `previewConnectorPaths` + `flushSync`, commit on up — for `mouse` **and** the touch carry (Decision 4). Writing the model per `pointermove` reinstates the cliff. `data-drag-id` is part of the contract.
- **Touch pan + pinch-zoom** drive `setScroll`/`setZoom` through the `SceneLayer`-subscribed store (mirror `Pan.mousemove` + wheel zoom) → React-render-free (§3.8). A pinch that routes zoom/scroll through component state instead of the store re-renders every node per frame.
- **One `beginDragTransaction`↔`commit` per gesture; no open-txn leak on any abort path** (D-4). A leak suppresses `saveToHistoryBeforeChange` for later edits → dropped undo history.
- **Both history stacks symmetric** on begin/commit/abort — never one without the other, or the MQA #5 invisible-connector symptom returns (§4.5). D-7 (Phase 0) is the precondition.
- **Don't worsen the open connector-drag GC cliff** (§3.10) — keep CONNECTOR/RECONNECT per-frame writes no more frequent than today (RAF-throttled). Routing them through the preview path is a **separate** session.
- Keep `pointerType` and any new pointer state **out** of slices the SceneLayers subscribe to (§3.3).

---

## 5. Wrap-up

When all phases complete and per-device QA passes:

1. `PLAN.md` Phase 6: one line — `Touch/pen canvas gesture contract shipped — see docs/adr/0018; D-7 dual-stack undo fix landed (see undo.dualStackSkew.test.tsx).`
2. `known_issues.md`: remove the "Touch/touchpad node drag" entry; update/close the **D-7** entry (fixed).
3. Delete this file + the two reference docs (baseline, behavior-map) **only after** confirming ADR 0018 carries the durable contract and the reference docs' load-bearing facts (perf invariants) are reflected where they live durably (perf-troubleshooting.md). When in doubt, keep behavior-map §3 — it is durable perf knowledge.
4. Memory: `project_docs_convention.md` — drop the active-tactical bullets; ADR 0018 Proposed→Accepted.

---

## 6. Notes for Claude

- **Lib-side work**, two packages. Dev-server friction: restart `npm run dev` after `npm run build:lib` or rsbuild's resolver desyncs.
- **The `mouse` branch is a regression magnet** — keep it behaviourally identical; the only intended mouse-side change is the px-slop threshold (Decision 4).
- **REPLACE the window listeners, don't ADD beside them** — double-firing is the top correctness trap.
- **Don't re-attempt the `changedTouches[0]` drop-coordinate patch** — tried and reverted; it treats a symptom.
- **Decisions are locked (§0).** Do not reopen ADR 0018 decisions. If implementation reveals the contract is actually *wrong* (not just inconvenient), STOP and surface it — don't silently deviate.
- **In scope (added 2026-06-14):** pinch-to-zoom + two-finger pan (D-12). **Out of scope:** multi-touch beyond pinch/two-finger-pan/second-finger-abort (e.g. 3-finger gestures, rotate); uniform cross-mode abort (D-1, gated on a future rollback primitive).
</content>
