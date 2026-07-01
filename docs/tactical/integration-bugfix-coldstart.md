# Cold-start — integration bug-fix + zero-migration slices (post-UX-sweep)

> **STATUS (2026-07-01).** Round 1 (S1–S5) **DONE & committed** on `integration`, one commit each, unit+e2e+typecheck green, **not shipped to master** (zero-mig window still open):
> - **S1** rectangle z-order (#2) — `7d45852`
> - **S2** node label↔name decouple (#4) — `c6ed63d` (ADR 0032 amendment; Details field → "Label" per owner)
> - **S3** selection clarity — `365b538` (A1 node-ring glow + A2 connector halo + #5 exact-tile click; **A3 hover-outline was deferred**)
> - **S4** bulk styling (#7 + #11) — `23c86e4` (ADR 0030 §2 amendment)
> - **S5** quick wins (#10 shift-select, M1, L3, M2) — `24c2458`
> - Perf gate re-run for S2: same-machine A/B 0.4% p95 (no regression).
>
> **ROUND 2 — owner follow-ups DONE & committed (2026-07-01):**
> 1. **#8 connector tool → DEFAULT style each draw** (`resetConnectorDefaults` on commit; ADR 0030 §2 note).
> 2. **A3 hover outline** (faint `subtle` outline on hovered ITEM/RECTANGLE via `HoverOutline`).
> 3. **i18n L2** = `rightSidebar` namespace (13 locales); persisted defaults (`'Untitled'`/`'Text'`/'Untitled Diagram') left canonical per the translate-at-render rule.
> 4. **Presenter hover popover = notes-only** (`ViewModeInfoPopover` hover path requires notes; pinned click unchanged).
>
> **ROUND 3 — parked items, owner-decided 2026-07-01, DONE & committed:**
> - **E2 absolute z-order** → Bring-to-front / Send-to-back menu items + `Ctrl+Shift+]/[`, and `Ctrl+]/[` extended to rectangles + labels.
> - **Connector-color discoverability** → arm-time accent-ring hint + "next connection" tooltip on the connection controls.
> - **B1/B2 placement cue** → ghost preview + mode-hint pill for text box / label (and rectangle-draw pill).
> - **#8 sticky-vs-default** → owner picked **default** (done in Round 2 above).
>
> **Still parked:** **N2** session-badge copy/color (intentional; leave unless reworded). **K1** keyboard-selectable canvas — larger a11y track, schedule separately. **#3** "click connection offset" — owner chose **retest after the #5 fix** (verify in the next hands-on pass; likely resolved by S3's #5 exact-tile click).

> **How to use this doc.** This is a self-contained implementation brief for a fresh session. Read this file + [`ux-sweep-triage-2026-06-30.md`](ux-sweep-triage-2026-06-30.md) (verdicts) + [`owner-field-feedback-2026-06-30.md`](owner-field-feedback-2026-06-30.md) (raw owner items). Every `file:line` anchor below was produced by the ADR 0028 code-verification gate (two `ux-finding-verification` workflows, 15 read-only verifiers) — **confirm each anchor on touch** (line numbers drift). Implement slice by slice, in order; commit each slice separately.

## Mission
Land the verified, owner-approved fixes from the 2026-06-30 five-persona UX sweep on the `integration` branch — including the **two schema-reshaping slices the owner chose to keep inside the zero-migration window** (#2 rectangle z-order, #4 node label↔name decouple).

## Guardrails (do not violate)
- **Branch:** `integration`. **DO NOT `/ship` or merge to `master`.** The zero-migration window stays open until the master merge; #2 and #4 reshape persisted schema and must land *before* it.
- **Commits:** one conventional commit per slice (`fix(...)`, `feat(...)`, `refactor(...)`). Keep schema diffs isolated and reviewable so the zero-migration claim is verifiable in one place.
- **Build/dev:** run the combined command — `npm run build:lib && npm run dev` (separate invocation flakes on `axoview` resolution).
- **Perf gate:** any change to a Canvas2D render layer (S2 node label, S3 connector highlight) must re-run the relevant [ADR 0020](../adr/0020-engine-perf-harness-and-measurement-protocol.md) scenario and stay within the **<10% noise band** vs the baseline in [`perf-results/e-slice-gate.md`](../../perf-results/e-slice-gate.md). The Label substrate is Canvas2D ([ADR 0031](../adr/0031-floating-label-entity-model.md)) — do not regress it.
- **Tests:** add/update unit + e2e per slice. Don't land a slice red.

## Owner decisions locked (2026-06-30)
- **Both #2 and #4 land in the zero-migration window.**
- Decision-lane items (#8 sticky-style, connector-color discoverability, N2 badge copy, E2 absolute z-order) are **still open** — NOT in this scope (see triage Lane B; bring them back to the owner separately).
- A11y keyboard-selectable-canvas (K1, S2/L) is a **separate track** — not in this scope.

---

## Slice S1 — Rectangle z-order (#2)  ·  zero-migration  ·  effort M
**Goal:** a big rectangle can sit behind smaller rectangles stacked on top (owner's exact scenario). Today rectangles are pure insertion-order; `Avancer/Reculer` exist only for ITEM+LABEL.

**Verified anchors & fix:**
- `schemas/rectangle.ts:4-23` — rectangleSchema has **no** `zIndex`. Add optional `zIndex: z.number().int()` (zero-migration-free addition on the unpushed branch).
- `reducers/rectangle.ts` — `createRectangle` unshifts at head (~:37); `updateRectangle` merges fields. Add a z-order update path (mirror the LABEL `nudgeZOrder` → `scene.updateLabel`).
- `CanvasContextMenu.tsx:335` — `canZOrder = target.type === 'ITEM' || target.type === 'LABEL'` → add `|| target.type === 'RECTANGLE'`.
- `CanvasContextMenu.tsx:207-222` — `nudgeZOrder` → extend to call `scene.updateRectangle` for RECTANGLE.
- `Rectangles.tsx:17` — replace the bare insertion-order `.reverse()` with a sort by `(zIndex ?? 0)` + stable tiebreak, mirroring `LabelsCanvas.tsx:126-128`.
- `CanvasContextMenu.tsx:333-334` — fix the **stale comment** ("text boxes / labels"); TEXTBOX is excluded and has no zIndex.

**Notes:** rectangles still always paint *under* nodes/labels by SceneLayer order (`Renderer.tsx:355`); `zIndex` only reorders rectangle-vs-rectangle — exactly the target scenario. TEXTBOX z-order is **optional**, out of scope unless trivial.

**AC:** draw a big rect, two small rects on top; send the big one backward / bring a small one forward; survives JSON round-trip. **Test:** reducer unit test for zIndex ordering + a context-menu action test.

---

## Slice S2 — Node label ↔ name decouple (#4)  ·  zero-migration  ·  effort L
**Goal:** the on-canvas node label becomes a field **distinct from `name`**; `name` is hidden from the canvas and becomes the Layers/identity string editable from the Layers panel. This is the **#1 confirmed cross-persona confusion** (Devin D1/D11, Tomás T3) — three testers broke on "I typed in Name and nothing appeared on the shape."

**This reverses ADR 0032 Option A — START WITH AN ADR 0032 AMENDMENT** that supersedes the relevant decision points and resolves these open questions before any code:
1. **New field & owner:** add `label` (on-canvas text) — recommend on `modelItem` (it's content, not view-specific); `name` stays on `modelItem` as the Layers/identity string. (Confirm vs putting `label` on `viewItem`.)
2. **Visibility gate:** repurpose the existing `views.ts:21 showLabel` to gate the new `label` on canvas (instead of `name`).
3. **Render:** `NodesCanvas.tsx:392,532` reads `label` instead of `name`.
4. **Rename entry points:** Layers row (`LayerItemRow.tsx:170`) edits **`name`** (identity); decide what **canvas F2** (`useInteractionManager.ts:397` inline-rename) and the Details Name field (`NodeInfoTab.tsx`) edit — recommend F2/inline-on-canvas edits **`label`**, Layers + Details "Name" edit **`name`**.
5. **Seed / preserve saved text (critical):** existing saved nodes have a `name` that currently renders on canvas. **Seed `label = name`** at load so current diagrams keep their visible text (the verifier flagged ADR 0032 §Context: node data has an installed base — do NOT lose saved `name`). Update bundled fixtures.

**Scope:** NODE only. RECTANGLE and TEXTBOX are **already** decoupled (their `name` is Layers-only); CONNECTOR name-as-label is **out of scope** (leave as-is).

**Perf:** the label render path stays Canvas2D — re-run the `label-heavy` ADR 0020 scenario; confirm within the <10% band (it's the same draw path, just a different source field, so ≈0 delta expected).

**AC:** typing the node's on-canvas label shows on the shape; renaming via Layers changes the identity but not necessarily the canvas text (per the resolved design); old diagrams render their previous names unchanged; no migration converter exists (verify against the unpushed baseline). **Tests:** schema round-trip, render-source, Layers-rename, seed-from-name.

---

## Slice S3 — Selection clarity (A1 / A2 / A3 + #5)  ·  schema-free  ·  effort M
**Goal:** make "what's selected" obvious (owner #1 + #9, Maya). One cohesive slice — same complaint across element types.

**Verified anchors & fix:**
- **A2 (REAL — highest priority): connectors have no selected-state at all.** `Connector.tsx:229-247` renders identical stroke regardless of selection; the only cue is `ConnectorAnchorOverlay.tsx:234-255` end-handles. → pass `isSelected` (from `itemControls`) into `Connector` and render a wider semi-transparent accent "halo" polyline under the path.
- **A1: node selection is a faint 2px dashed single-tile box.** `TransformControls.tsx:20,100-108` (color `config.ts:199 TRANSFORM_CONTROLS_COLOR`). → solid/higher-contrast ring and/or soft glow / icon scrim.
- **A3: no hover highlight** (cursor change already works — `Cursor.ts:543-546` sets pointer). → render a faint hover outline on the hovered item id (already computed in `updateHoverCursor`).
- **#5 connector hit-halo:** `hitDetection.ts:113-120` keeps a ±1-tile Chebyshev halo on every connector segment; #54 fixed only node-endpoints. Occupied tiles already win, so this only mis-grabs **empty** tiles beside a segment. → narrow **click-selection** (`Cursor.ts:295-298`) to exact-tile / sub-tile px distance; **keep** the ±1 halo for hover/reconnect. Do not break connector clickability on its own tiles.

**AC:** a selected connector is obvious in a dense diagram; a selected node reads clearly; hovering shows feedback; clicking an empty tile beside a connector clears selection instead of grabbing it. **Tests:** hit-detection unit (empty-adjacent-tile no longer resolves to connector) + visual/selection e2e. **Perf:** connector highlight is one extra polyline for the single selected connector — re-run the connector scenario only if you touch the shared render loop.

---

## Slice S4 — Bulk styling + bulk label font-size (#7 + #11)  ·  schema-free  ·  effort M
**Goal:** apply a style change across a homogeneous multi-selection (owner #7); add a relative +/− label font-size control (owner #11). Today the strip is single-selection-gated.

**START WITH AN ADR 0030 §2 AMENDMENT** (it currently forbids >1: "With 0 or >1 selected, every control is disabled").

**Verified anchors & fix:**
- `uiStateStore.tsx:220-230` — sets `itemControls: null` for `>1`. → when all selected ids share a `.type`, expose a **homogeneous bulk target** alongside `itemControls`.
- `TopBarStyleControls.tsx:445,464` — reads single `sel`. → each control's writer fans out over the selection inside `useScene().transaction()` so it lands as **one undo entry**. Precedent: `useSceneActions.ts:831-918 deleteSelectedItems` already iterates a multi-selection in a transaction.
- `TopBarStyleControls.tsx:559-566` — label font-size is a single-target absolute % slider. → add a relative **+/− stepper** (nudge each selected label's `fontSize` by step, clamp 8–48) routed through the same transaction. No schema change (`fontSize` already on Label).
- Keep **heterogeneous** multi-select disabled.

**AC:** select N connectors → recolor all in one undo; select N labels → bump font size up/down for all. **Tests:** bulk-apply unit (single history entry) + e2e.

---

## Slice S5 — Quick wins  ·  schema-free  ·  effort S (×4)
- **#10 Shift-select** — `Cursor.ts:516-517` reads only ctrl/meta. → `const additive = modifiers?.ctrl || modifiers?.meta || modifiers?.shift` and use it in `handleItemClickSelection` + `handleConnectorClickSelection`. Verified collision-free (Shift unbound on canvas). Amend [ADR 0006](../adr/0006-canvas-selection-contract.md) §2 gesture matrix.
- **M1 annotation palette persists after Present→edit** — `uiStateStore.tsx:109-114 setEditorMode` doesn't reset annotation. → set `annotation: { ...state.annotation, open: false }` on mode switch; **keep strokes** (ADR 0014 session-scoped). Test mirrors `annotationOpenReset.contract.test.ts`.
- **L3 clock i18n** — `StatusCluster.tsx:17,20` uses `toLocaleTimeString([])` → OS locale. → pass `i18n.language` (mapped to BCP-47) to the Intl calls.
- **M2 view-mode left-drag pan threshold (S2)** — `Pan.ts:72-84` scrolls with no left-button slop; `RIGHT_DRAG_THRESHOLD` (`usePanHandlers.ts:10,190-197`) guards only the right button. → add a ~4px left-button travel threshold in EXPLORABLE_READONLY before `Pan.mousemove` scrolls, so a slight click-wobble pins the popover instead of flinging the diagram off-screen. Test.

---

## Optional — i18n L2 default strings  ·  schema-free  ·  effort M
`config.ts:119,201` ('Text', 'Untitled'), `RightSidebar.tsx:108` empty-state, 'Untitled Diagram' literals → lib i18n keys; **translate at render, never write translated text into persisted JSON**. May fold into the existing **D1** i18n slice (the strip tooltips, already in the productization plan) rather than standing alone.

---

## Reviewer's pass (where my review refines the gate's verdicts)
- **#5 is safe to fix but surgical:** only remove the +1 over-claim on *empty* neighbors for *click-selection*; preserve connector clickability on-tile and the ±1 tolerance for hover/reconnect. The owner's screenshot (empty tile beside a connector → connector selected) matches this exactly.
- **#4 scope is NODE-only.** Rectangle/textbox are already decoupled; connector stays as-is. The ADR amendment must explicitly supersede the ADR 0032 Option A decision points and **seed `label = name`** so no diagram visibly changes.
- **A1/A2/A3 + #5 belong together** as "selection clarity" — same root complaint, ship as one reviewable slice; A2 (connectors invisible when selected) is the strongest single finding in the sweep.
- **Do NOT implement the debunked items:** fill-button-deselect (artifact), marquee-broken (artifact), session-badge-moved-shape (artifact), Sam's focus-rings (artifact — theme already rings every button), long-right-drag native menu (artifact / needs-repro). See triage Lane D.
- **Needs a repro before any work:** owner #3 "click connection offset" — either the cosmetic arrowhead-one-tile-short render offset (distinct, S4) or a duplicate of #5. Get a one-line repro first.
- **Keep out of scope (decisions / separate tracks):** #8 sticky-style, connector-color discoverability, N2 copy/color, E2 absolute z-order, K1 keyboard-selectable canvas, B1/B2 placement-mode cue. They're real but need owner sign-off or are larger tracks.

## Suggested sequencing
S1 (rect z-order) → S2 (node decouple; ADR amendment first) → **commit the two zero-migration slices before anything risks the window** → S3 (selection clarity) → S4 (bulk styling) → S5 (quick wins) → optional i18n. Re-run the perf gate after S2 and (if the shared render loop is touched) S3. Do not ship to master.
