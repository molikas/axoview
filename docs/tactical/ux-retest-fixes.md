# Tactical — UX Re-test Fixes (2026-06-21 run)

> **Read first:**
> - [ADR 0028 — UX Journey-Testing Protocol](../adr/0028-ux-journey-testing-protocol.md) — the method that produced this backlog.
> - [ADR 0019 — Canvas2D node render layer](../adr/0019-canvas2d-node-render-layer.md) — A1/A2 live here.
> - [ADR 0022 — Canvas pointer interaction model](../adr/0022-canvas-pointer-interaction-model.md) — most of section B.
> - [ADR 0027 — Canvas context menu](../adr/0027-canvas-context-menu.md) — D1 (context-menu i18n).
> - [ADR 0011 — Error-UX contract](../adr/0011-error-ux-contract.md) · [ADR 0013 — Preview-mode layer switcher](../adr/0013-preview-mode-layer-switcher.md) — referenced by section F.
> - [docs/tactical/canvas-interaction-behavior-map.md](canvas-interaction-behavior-map.md) — the `isRendererInteraction` mouseup contract B1 restores.
> - [docs/ux-principles.md](../ux-principles.md) · [docs/workflow.md](../workflow.md)
>
> **Status:** Not started · **Owner:** molikas · **Last updated:** 2026-06-21
>
> This is a **short-lived working doc.** Delete it after the work merges; the ADRs are the durable record.
> PLAN.md gets a one-line entry once shipped — see "Wrap-up".

## Session startup checklist

1. Read this file fully.
2. Read the linked ADRs' headers (full body for ADR 0019/0022/0027 when touching those sections).
3. Skim `PLAN.md` Phase Status Dashboard **for context only** — do not modify it during this work.
4. `TodoWrite` the section you're taking.
5. Mark `[x]` as each sub-task lands + verifies.
6. On completion, follow "Wrap-up".

## Goal

Implement the verified fixes from the 2026-06-21 persona UX journey-test run (ADR 0028) against the
`integration` preview. Every item below was **cross-checked against current code** before it landed here;
each carries a root cause (`file:line`), a concrete fix, severity, and effort. **Not** a goal: chasing
the four verified **artifacts** (section F — test hardening only, no behaviour fix); the product/UX-policy
calls (section G — they need a decision, not code).

## Scope

### In scope
- Canvas rendering correctness (A), interaction integrity (B), accessibility (C), i18n coverage (D),
  polish/convention (E).
- Regression tests that would have caught these (existing e2e dispatches synthetic events directly on the
  interactions box, so it is blind to real-gesture bugs like B1).

### Out of scope
- The four verified artifacts as behaviour changes (F is tests only).
- Product decisions in G (isometric-default, Save-vocabulary, etc.) — schedule a separate review.
- Any new feature work beyond the verified fixes.

## Locked decisions (from the 2026-06-21 verification pass)

| # | Decision | ADR obligation at ship |
|---|---|---|
| 1 | Canvas text (name + caption) is **decoded** (HTML entities → chars) before draw, via one shared `htmlToPlainText` util; the three ad-hoc `&nbsp;` replacers converge on it. | `/feature extend 0019` |
| 2 | `PlaceIcon.mouseup` **gates on `isRendererInteraction`** (matching Cursor/Lasso/ReconnectAnchor + the behavior-map contract); an off-canvas release keeps the placement armed, it does not place. | `/feature extend 0022` |
| 3 | **Esc** prioritises connector-abort over selection-clear while a connection is in progress; `NodeActionBar.handleStartConnector` clears the lingering selection. | `/feature extend 0022` |
| 4 | Connector **first click on empty canvas is a no-op** until an ITEM is targeted (option A — no free-floating tile-anchored connectors from a stray click). | `/feature extend 0022` |
| 5 | `NodeActionBar` gains **screen-space edge flip/clamp** (mirroring `ViewModeInfoPopover`) and renders above the LeftDock stacking context. | `/feature extend 0005` or 0022 |
| 6 | A **theme-wide `:focus-visible` outline** on `MuiButtonBase` (no `outline:0` anywhere); existing per-row rings stay. | none (wiring) |
| 7 | Elements icon tiles are **keyboard-operable** (roving tabindex + Enter/Space arms placement). | none (a11y wiring) |
| 8 | Chrome strings are **internationalised at the component** (hardcoded English is an all-locales defect, *not* the de-DE/id-ID stub). | none (i18n wiring) |
| 9 | **Double-click-to-add is removed for good** (2026-06-21 call) — right-click → "Add item" is the canonical add affordance and is subjectively better UX; a second add trigger is redundant. Strike the stale QuickAdd promise from ADR 0022 §3, the `Cursor.ts:624` comment, and the Help `addNodeGroup` row. Double-click stays = open Details (on an item) / no-op (empty canvas). | `/feature extend 0022` |

## Sub-tasks

### A. Canvas rendering correctness *(ADR 0019)*

- [ ] **A1 · Caption/name renders literal `&nbsp;` on the Canvas2D label** — S2, effort **S**. *(P4-01/P4-08; regression: T2 `c6bb4f8`)*
  `getDescriptionText()` strips tags but never decodes entities, so Quill's literal `&nbsp;` reaches
  `ctx.fillText`. Correct in the DOM/popover path (browser decodes), wrong on the default canvas layer.
  → Add `utils/htmlToPlainText.ts` (strip + decode `&nbsp;&amp;&lt;&gt;&#39;&quot;` + numeric), apply in
  [`getDescriptionText` NodesCanvas.tsx:127](../../packages/axoview-lib/src/components/SceneLayers/Nodes/NodesCanvas.tsx#L127)
  and the name draw (:507/:586); converge [TextBox.tsx:35](../../packages/axoview-lib/src/components/SceneLayers/TextBoxes/TextBox.tsx#L35)
  + [isoMath.ts:452](../../packages/axoview-lib/src/utils/isoMath.ts#L452)/:509 onto it. (Decision #1.)
- [ ] **A2 · Export-image preview drops icon nodes on first open** — S2, effort **M**. *(P3-06; regression: ADR 0019/0025)*
  The export snapshots the Canvas2D layer before async icon bitmaps decode (it waits only on model-ready,
  one rAF); connectors are DOM/SVG so they survive. → Publish an `allIconsDrawn` dataset signal from
  `NodesCanvas.draw()` (mirror `drawCount`/`labelsDrawn`), and in
  [ExportImageDialog.tsx:463](../../packages/axoview-lib/src/components/ExportImageDialog/ExportImageDialog.tsx#L463)
  await it (or `decode()` all icon URLs) before the initial capture + a recapture fallback. Don't revert
  to DOM nodes.

### B. Canvas interaction integrity *(ADR 0022)*

- [ ] **B1 · Click-to-arm icon placement drops the node under the panel** — S2, effort **S**. *(P3-01/P3-11)*
  [`PlaceIcon.mouseup`](../../packages/axoview-lib/src/interaction/modes/PlaceIcon.ts#L31) isn't gated on
  `isRendererInteraction`; the arming click's own pointer-up places a (valid) node at the panel tile, then
  nulls `mode.id`, so the real canvas click does nothing. The "ghost" is the cursor tile-highlight. → Add
  the gate **before** the `setMode` that nulls `id` (Decision #2). Add an e2e driving a real
  arm-then-canvas-click (existing tests dispatch on the interactions box and miss this).
- [ ] **B2 · Esc doesn't cancel an action-bar-started connector (orphan left behind)** — S2, effort **S**. *(P2-04/P4-06; regression: T4 `7f01645`)*
  [`handleEscapeKey`](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L207) runs
  `itemControls → selectedIds → connectorEscape`; the action bar leaves the source node selected, so the
  first Esc clears selection and returns before connector-abort. → Run `handleConnectorEscape` first when
  `mode==='CONNECTOR'` & in progress; also `clearSelection()` in
  [`NodeActionBar.handleStartConnector`](../../packages/axoview-lib/src/components/NodeActionBar/NodeActionBar.tsx#L106) (Decision #3).
- [ ] **B3 · Connector first-click on empty canvas commits a stray tile-anchored connector** — S3, effort **S**. *(P2-04/P4-06)*
  [`Connector.handleClickFirst`](../../packages/axoview-lib/src/interaction/modes/Connector.ts#L38) has no
  "must target a node" gate; the stray connector counts in Ctrl+A and saves — the seed B2 then strands.
  → Make the first click a no-op until an ITEM is under the cursor (Decision #4). Land B2+B3 together.
- [ ] **B4 · `NodeActionBar` clips off-screen / hides behind the left panel near edges** — S2, effort **M**. *(P2-03/P4-04/P5-13 — 3 personas)*
  Positioned in scene-tile space with no edge flip/clamp; `zIndex:10` is trapped below `LeftDock`'s 20.
  → Mirror [`ViewModeInfoPopover.tsx:195`](../../packages/axoview-lib/src/components/ViewModeInfoPopover/ViewModeInfoPopover.tsx#L195):
  flip-below at the top edge, clamp screen-x past the dock right edge, driven off the `uiStoreApi`
  scroll/zoom/rendererSize subscription (Decision #5). Start-connector is bar-only, so the bar must stay reachable.
- [ ] **B5 · Connector hit area ~1–2px (near-impossible to click the line)** — S3, effort **S–M**. *(P3-04/P3-15)*
  [`getItemAtTile` hitDetection.ts:75](../../packages/axoview-lib/src/utils/hitDetection.ts#L75) hit-tests a
  connector by exact tile equality, no tolerance band. → Accept a tile within Chebyshev-1 of any path tile
  (or perpendicular distance to each segment under a tolerance).
- [ ] **B6 · Arrow keys never nudge a selected item (pan only)** — S3, effort **M**. *(P2-12; by-design per ADR 0022 §6 but breaks a 3-tool convention)*
  [`handleKeyboardPan` useInteractionManager.ts:530](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L530)
  always pans. → **Confirmed (2026-06-21): make it selection-aware** — selected ITEM/RECT/TEXTBOX → nudge
  one tile per arrow press (single-undo transaction); nothing selected → pan (keep `KEYBOARD_PAN_SPEED`).
  This intentionally amends the ADR 0022 §6 "arrows = pan only" choice (record via `/feature extend 0022` at ship).
- [ ] **B7 · `N` opens the Elements panel but won't toggle it closed** — S4, effort **S**. *(P5-17)*
  The `addItem` hotkey [assigns `ELEMENTS` unconditionally :442](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L442).
  → `=== 'ELEMENTS' ? null : 'ELEMENTS'` to match the dock button.
- [ ] **B8 · Strike the dead "double-click → Add popover" promise** — S3, effort **S**. *(P2-10/P3-02; nothing is created today — the "ghost" is the cursor highlight; the QuickAdd component was already removed in `eeec0a6`)*
  **Decision (#9): remove the double-click-add trigger for good — right-click → "Add item" is canonical**
  (a second add affordance is redundant; right-click add is the better UX). No restore. → (1) strike the
  ADR 0022 §3 "double-click → QuickAdd" line (via `/feature extend 0022` at ship); (2) delete the stale
  [`Cursor.ts:624`](../../packages/axoview-lib/src/interaction/modes/Cursor.ts#L624) comment; (3) remove the
  Help `addNodeGroup` row (D10). Leave `onDoubleClick` as-is: open Details on an item, no-op on empty canvas.
  **Ripple:** with double-click-add gone, "how do I add a node" rests on the Elements panel + right-click —
  which raises the value of the **G** empty-state onboarding hint; flag it in that review.
- [ ] **B9 · Panel-card / text-hotkey placement falls to origin (0,0)** when the cursor never entered the canvas — S3, effort **M**. *(P1-12 sub-bug; Rectangle/icon click-place are correct — they use the live cursor tile)*
  `mouse.position.tile` initialises to `{0,0}`, so `Text` card / text hotkey before the pointer hits the
  canvas drop at origin. → Fall back to the viewport-center tile (`screenToTile` of the renderer center) in
  [`CommonElements.handleTextMouseDown` :143](../../packages/axoview-lib/src/components/LeftDock/CommonElements.tsx#L143)
  and the `text`/`addItem` hotkey paths.

### C. Accessibility *(paired a11y workstream — the only persona that couldn't finish for structural reasons)*

- [ ] **C1 · No visible keyboard focus ring on most buttons/icon-buttons** — S2, effort **S**. *(P5-02)*
  No global suppression exists (the tester's `outline:0` theory is wrong); MUI's `ButtonBase` simply draws
  no outline and `disableRipple` removes the only other cue — a focus-visible ring was never added. → Add a
  `MuiButtonBase` styleOverride in [theme.ts:167](../../packages/axoview-lib/src/styles/theme.ts#L167):
  `&.Mui-focusVisible { outline: 2px solid <primary>; outline-offset: 2px; border-radius: inherit }`. Keep
  the per-row rings; **do not** add `outline:0` (Decision #6).
- [ ] **C2 · Elements icon grid has zero keyboard tab stops** — S2, effort **M**. *(P5-01)*
  The tile is a plain `<Box>` ([Icon.tsx:73](../../packages/axoview-lib/src/components/ItemControls/IconSelectionControls/Icon.tsx#L73))
  — no `tabIndex`/`role`/`onKeyDown`. → Roving tabindex across the grid, `role="button"`,
  `aria-label={icon.name}`; Enter/Space arms `PLACE_ICON` (drop at viewport-center tile, reuse B9's helper)
  (Decision #7).

### D. i18n coverage — hardcoded English, all-locales *(Decision #8)*

Each component below renders English in **every** locale (no `t()`). Order by frequency; `CanvasContextMenu`
first. Add keys to all locale files; reuse existing keys where noted.

- [ ] **D1 · `CanvasContextMenu`** — S2, effort **M**. *(P5-03; regression: ADR 0027)* every item label, count rows, snap/collision toggles hardcoded → add `canvasContextMenu` namespace. [CanvasContextMenu.tsx](../../packages/axoview-lib/src/components/CanvasContextMenu/CanvasContextMenu.tsx)
- [ ] **D2 · `ExportPopover` (app)** — S3, effort **S**. *(P5-04)* "Export JSON/Image/Project (.zip)" + tooltip. [ExportPopover.tsx](../../packages/axoview-app/src/components/ExportPopover.tsx)
- [ ] **D3 · `SettingsDialog`** — S3, effort **S**. *(P5-05)* title, Canvas/Language/About tabs, Close, lang description, Zoom/Labels section titles. [SettingsDialog.tsx](../../packages/axoview-lib/src/components/SettingsDialog/SettingsDialog.tsx)
- [ ] **D4 · `LeftDock`** — S3, effort **S**. *(P5-06)* File explorer / Elements / Layers / Settings tooltips + disabled hint. [LeftDock.tsx](../../packages/axoview-lib/src/components/LeftDock/LeftDock.tsx)
- [ ] **D5 · `ToolMenu`** — S3, effort **S**. *(P5-07; regression)* "Switch to 2D/isometric view" + Click/Drag chip. [ToolMenu.tsx](../../packages/axoview-lib/src/components/ToolMenu/ToolMenu.tsx)
- [ ] **D6 · `BottomDock`** — S3, effort **S**. *(P5-08)* "Help (F1)" — wire the already-translated-but-orphaned `zoomControls.help`. [BottomDock.tsx](../../packages/axoview-lib/src/components/BottomDock/BottomDock.tsx)
- [ ] **D7 · `useCopyPaste` toasts** — S3, effort **M**. *(P5-09)* Pasted/Copied/Cut N items, Nothing to paste, routing % — pluralise via i18n, not `+ 's'`. [useCopyPaste.ts](../../packages/axoview-lib/src/clipboard/useCopyPaste.ts)
- [ ] **D8 · `LayersPanel`** — S3, effort **S**. *(P5-10)* header, empty-state, Unassigned, add/delete tooltips, default `Layer N`. [LayersPanel.tsx](../../packages/axoview-lib/src/components/LayersPanel/LayersPanel.tsx)
- [ ] **D9 · `CommonElements`** — S3, effort **S**. *(P5-11)* Common / Rectangle / Text / Connector (reuse existing `toolMenu.*`). [CommonElements.tsx](../../packages/axoview-lib/src/components/LeftDock/CommonElements.tsx)
- [ ] **D10 · `HelpDialog` — remove the wrong row + translate the rest** — S2, effort **M**. *(P3-05/P3-08/P5-14)* **remove** the `addNodeGroup` row entirely (its "double-click → Add popover" claim is false and the trigger is being struck — B8/#9); internationalise the hardcoded "Select All" row + mouse-interactions block; add the undocumented F2/N/C/L/S tool keys. [HelpDialog.tsx](../../packages/axoview-lib/src/components/HelpDialog/HelpDialog.tsx) + [en-US.ts:49](../../packages/axoview-lib/src/i18n/en-US.ts#L49)
- [ ] **D11 · `EmptyStateScreen` (app)** — S3, effort **S**. *(P5-12)* "New diagram"/"Import" (label + aria-label). [EmptyStateScreen.tsx](../../packages/axoview-app/src/components/EmptyStateScreen.tsx)
- [ ] **D12 · `FileTreeToolbar`/`FileExplorer`** — S3, effort **S**. *(P5-13)* "Diagrams" (→ DIAGRAMS) + toolbar tooltips. [FileTreeToolbar.tsx](../../packages/axoview-app/src/components/fileExplorer/FileTreeToolbar.tsx)
- [ ] **D13 · Misc** — S4, effort **S**. *(P5-15)* `StatusCluster` Session badge; `config.ts:35`/`useSceneActions.ts:687` "Page 1"/"Page N"; `LabelSettings` "theme units"; **one-char data fix:** `i18n.ts:69` "Italian" → native "Italiano".

### E. Polish & convention *(confirm the two flagged before fixing)*

- [ ] **E1 · Notes truncated in the Present-mode info popover**, no scroll/expand — S3, effort **S**. *(P4-03 — confirm)* add `overflow-y`/expand to the notes area in `ViewModeInfoPopover`.
- [ ] **E2 · Hex colour input discards typed value on Esc** — S3, effort **S**. *(P3-10 — confirm)* commit on change/Enter; don't reset when the picker overlay closes.
- [ ] **E3 · Discoverability nits** — S3/S4 (capture, low): icon thumbnails need persistent labels (P3-07); annotation overlay should say "not saved" (P4-07); F2 silently no-ops while the Elements search box has focus (P4-02 — correct suppression, but add a hint).

### F. Verified NON-issues — **do NOT change behaviour** (regression tests only)

Loud in the report, **refuted against code**. Add the test to lock the contract + absorb the artifact.

- [ ] **F1 · "350px hit-test mismatch / clicks pan"** (P1-01) — ARTIFACT (wrong selector `data-axoviewId`; overlay is `left:0`, one coordinate frame). → e2e asserting `interactionsEl.left === containerEl.left` with the Properties panel open/closed.
- [ ] **F2 · "orphan refs → blank-page crash"** (P2-01) — ARTIFACT (tile anchors valid; load-failure surfaces an error toast per ADR 0011). → *Optional, pre-existing:* extend load-time auto-repair to drop view items absent from `model.items`, and escalate the load-error toast to a repair/discard **dialog** ([ADR 0011 §6.3.1](../adr/0011-error-ux-contract.md)).
- [ ] **F3 · "Ctrl+A in rename selects all nodes"** (P2-05/P3-03) — ARTIFACT (inline editors `stopPropagation` + `isEditableTarget`-matched). → e2e: enter rename, wait for `activeElement`, Ctrl+A, assert selection didn't expand. Optional belt-and-suspenders: add `|| isContentEditable` to the guard.
- [ ] **F4 · Present "Hide labels" blanks the diagram** (P4-05) — ARTIFACT (flag suppresses only labels; icons draw unconditionally; the tester counted labels). → e2e: after toggle, assert `data-draw-count` stays N while `data-labels-drawn` → 0.

### G. Product / UX-policy decisions (not eng tasks — need a call before any work)

Isometric default makes "Rectangle" render as a diamond (P1-04) · no "Save" verb, only "Export" (P1-02) ·
"Session" badge meaning hidden (P1-06/P4-10) · Share tooltip too technical for novices (P1-07) ·
no onboarding hint on an *open* empty diagram (P1-03). These drove the most novice friction — schedule a
short review; don't scaffold code from this doc until decided.

## Wrap-up

When sections A–E are complete and verify (UI walkthrough per workflow.md, both lib+app builds, jest):

1. At ship, fold the durable decisions into their ADRs via `/feature extend` per the Locked-decisions
   table (0019 for A1; 0022 for B1/B2/B3/B6/B8; 0005 or 0022 for B4).
2. Add a single line under the relevant `PLAN.md` phase:
   ```
   - UX re-test fixes shipped — see docs/adr/0028 (method) + 0019/0022/0027 addendums and this file's git history.
   ```
3. Delete this file. The ADRs are the durable record.

## Notes for Claude

- **The e2e suite is blind to real-gesture bugs** — `CanvasPOM` dispatches synthetic events directly on
  `[data-axoview-id="canvas-interactions"]`, so `e.target` is always the box. B1, B2/B3 need tests that
  exercise the *real* pointer path (release over the panel; Esc with a lingering selection).
- **Spans both packages** — A1/B*/C*/D1/D3–D10/D13(lib) + A2/D2/D11/D12/D13(app). Build both libs after
  lib edits; dev-server + browser walkthrough for app/component edits (mandatory per workflow.md).
- **Don't "fix" section F.** Those are verified artifacts; changing behaviour there reintroduces nothing
  and risks regressions. Tests only.
- **i18n is all-locales, not the de/id stub** — the fix is `t()` at the component, plus keys in every
  locale file; several already have the Spanish string under a sibling key (reuse, don't re-translate).
- **B8/D10 are coupled** — whatever you decide for double-click (restore vs strike), the Help text and the
  ADR 0022:33 line must end up consistent with it. Trace the ripple (workflow.md Principle 7).
