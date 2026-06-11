# Tactical — View-Mode UX, Annotation & Canvas Polish

> **Read first:**
> - [docs/workflow.md](../workflow.md) — session cadence baseline
> - [docs/ux-principles.md](../ux-principles.md) — design language (esp. §1.5 typography, §2 affordances, §5 item-type parity, §8 overlays/counter-scale)
> - [ADR 0012 — View-Mode Item Info Popover](../adr/0012-view-mode-node-info-popover.md)
> - [ADR 0013 — Preview-Mode Layer Switcher](../adr/0013-preview-mode-layer-switcher.md)
> - [ADR 0014 — Ephemeral Annotation Overlay](../adr/0014-ephemeral-annotation-overlay.md)
> - [ADR 0015 — Node Label Legibility Scaling](../adr/0015-node-label-legibility-scaling.md)
> - [ADR 0005 — Toolbar and Dock Layout Contract](../adr/0005-toolbar-and-dock-layout-contract.md) (Group 1 reserves the annotation slot)
>
> **Status:** Not started · **Owner:** molikas · **Last updated:** 2026-06-11
>
> This is a **short-lived working doc.** Delete it after the work merges; the ADRs are the durable
> record. PLAN.md gets a one-line entry referencing the ADRs once shipped — see "Wrap-up" below.

## Session startup checklist

1. Read this file fully.
2. Read each linked ADR.
3. Skim `PLAN.md` Phase Status Dashboard **for context only** — do not modify it during this work.
4. Use `TodoWrite` to track the sub-tasks below.
5. Mark `[x]` as work completes.
6. On completion, follow the "Wrap-up" section to update PLAN.md with a single line.

## Goal

Make view-only mode a first-class **presentation** surface and add lightweight markup, plus two
canvas-feel fixes. Five threads:

1. **View-mode item info popover** — read details/notes via a canvas-anchored popover (hover →
   preview, click → pinned, links clickable) instead of reusing the right editing dock.
2. **Preview-mode layer switcher** — a compact corner control to toggle/solo layers without the
   left dock; toggles are ephemeral (never dirty the saved diagram).
3. **Ephemeral annotation overlay** — "paint on top" (pencil/highlighter/shapes/arrows/colors/
   thickness/eraser/clear) from a draggable floating palette opened via a top-toolbar pen entry;
   never saved to the project file.
4. **Preserve zoom across iso↔2D** — stop the force-fit that makes zoom "pop"; keep zoom + center.
5. **Label legibility toggle** — optional "keep labels readable" counter-scale in the zoom control.
6. **Clickable empty-state cards** — the whole "New diagram" / "Import" square is clickable, not
   just the inner button (users expect the big card to be the target).

Every thread ships to a **quality bar** (see the dedicated section below): unit tests **and** E2E
tests, a tech-debt sweep of the code it touches, and a docs/notes/architecture refresh. No debt
left behind.

**Not goals:** durable/saved annotations; bulk layer editing in preview; any node-label
*performance* work (the "slow" report was a typo for "small" — legibility only); changing
edit-mode dock behavior.

## Scope

### In scope
- View-mode (`EXPLORABLE_READONLY`) popover info surface + suppressing right-dock auto-open there.
- Preview-only layer overlay with ephemeral UI-override visibility merged into `LayerContext`.
- Annotation overlay layer, floating palette, tools, and persistence-exclusion test assertions.
- Removing the `fitToView()` force-fit on canvas-mode switch; preserving zoom + viewport center.
- "Keep labels readable" toggle in `ZoomControls` with counter-scaled labels.
- Making the full `EmptyStateScreen` cards clickable (whole-card target, no nested-button a11y trap).
- **Quality bar on every thread:** unit + E2E tests, tech-debt cleanup of touched code, docs sync.

### Out of scope
- Saving annotations into the project/zip (explicitly forbidden — see ADR 0014).
- Step-through / cumulative-reveal layer presentation (user chose visibility-toggles + solo).
- Node-label LOD / performance refactor.
- Touch-gesture redesign.

## Locked decisions (from design discussion 2026-06-11)

| # | Decision |
|---|---|
| 1 | View-mode item info uses a **canvas-anchored Popover**: hover → preview, click → pinned (X / click-away / Esc to close), notes links clickable. Right dock no longer auto-opens in view mode. Parity across node/connector/rectangle/textbox. (ADR 0012) |
| 2 | Preview layer control = compact **semi-transparent bottom-left** overlay; **per-layer visibility toggles + solo**; **ephemeral UI override** — never mutates `layer.visible`, never dirties/saves. Shown only in `EXPLORABLE_READONLY` with ≥2 layers. (ADR 0013) |
| 3 | Annotation entry = **pen in the top toolbar's View-modes group** (ADR 0005 Group 1) → opens a **draggable floating vertical palette**. Same in edit + preview. (ADR 0014) |
| 4 | Annotation lifecycle: **collapse hides the drawing, expand shows it again** (collapse ≠ discard); a **Clear/Trash** button is the only wipe; drawings persist until Clear or reload; **never written to the project file**. (ADR 0014) |
| 5 | Annotation strokes stored in **scene coordinates** (recommended) so they track pan/zoom — *open TODO* on iso↔2D re-projection + image-export inclusion (see ADR 0014). |
| 6 | **Iso↔2D switch preserves the user's zoom and viewport center** — the `fitToView()` force-fit in `ToolMenu` is the cause of the 65%→80%→97% "popping" and is removed. Preserve `zoom`; recompute `scroll` so the tile under the viewport center stays centered after the projection swap. |
| 7 | Node-label issue at low zoom is **legibility, not performance**. Fix = **opt-in "keep labels readable"** toggle in `ZoomControls` that counter-scales labels to a legible floor; **off by default**. (ADR 0015) |
| 8 | Empty-state "New diagram" / "Import" cards are **fully clickable** (whole `Paper`/card is the target). Avoid the nested-button a11y trap — make the card the single interactive element (e.g. `CardActionArea`) and demote the inner blue button to a visual label, **preserving the `screen-empty-create` / `screen-empty-import` `data-axoview-id` hooks** the E2E POM depends on. No ADR — single-surface UX tweak. |
| 9 | **Quality bar is non-negotiable per thread:** unit tests + E2E tests, a tech-debt review/cleanup of the code each thread touches, and a docs refresh (`ux-principles.md`, `architecture.md`, `known_issues.md`, locale files) where the change warrants it. A thread is not "done" until this is met. |

## Sub-tasks

### A. View-mode item info popover (ADR 0012)
- [ ] Build the canvas-anchored Popover (hover-intent preview + click-to-pin, Esc/click-away/X).
- [ ] Read-only notes render with sanitised clickable links; surface `headerLink`.
- [ ] Suppress right-dock auto-open in `EXPLORABLE_READONLY` (edit mode untouched).
- [ ] Parity: node, connector, rectangle, textbox.
- [ ] Suppress popover when item has no `name`/`notes`/`headerLink`.

### B. Preview-mode layer switcher (ADR 0013)
- [ ] uiState `previewLayerOverrides` slice (hiddenLayerIds + soloLayerId).
- [ ] Extend `useLayerContext` so `EXPLORABLE_READONLY` derives `visibleIds` from the override (solo wins; else `layer.visible` minus hidden). Edit mode unchanged.
- [ ] Bottom-left semi-transparent overlay; per-layer toggle + solo; render only with ≥2 layers in view mode.
- [ ] Confirm toggling never marks the diagram dirty.

### C. Annotation overlay (ADR 0014)
- [ ] uiState `annotation` slice + local undo stack.
- [ ] Overlay render layer (canvas/svg) in scene coordinates, sibling of `SceneLayer`.
- [ ] Pen entry in top-toolbar View-modes group → draggable floating palette.
- [ ] Tools: pencil, highlighter, line/arrow, rect/ellipse, color presets, thickness, eraser, undo, Clear.
- [ ] Collapse = hide (retain); expand = show; Clear = wipe.
- [ ] Pointer capture only while a draw tool is active (selection/pan otherwise intact).
- [ ] **Persistence-exclusion tests** in `leanSave` + `projectZip` (zero annotation data in any output).
- [ ] Resolve TODOs: iso↔2D re-projection behavior; image-export inclusion.

### D. Iso↔2D zoom preservation (locked decision #6) — ✅ shipped
- [x] Remove the `fitToView()` call in [`ToolMenu.tsx`](../../packages/axoview-lib/src/components/ToolMenu/ToolMenu.tsx) `useEffect` (lines ~42-48).
- [x] On `canvasMode` change, preserve `zoom` and recompute `scroll` so the viewport-center tile stays centered under the new projection. (New pure helper `getCanvasModeSwitchScroll` + per-strategy `fromCanvasPoint` in `coordinateTransforms.ts`.)
- [x] Verify against the reported case (65% stays ~65%, no 80%/97% jump, diagram stays roughly centered) — covered by `canvas-mode-zoom-preserve.spec.ts`.

### E. Label legibility toggle (ADR 0015) — ✅ shipped
- [x] Add `readableLabels` flag (top-level uiState, persisted like `expandLabels`) + `LABEL_MIN_READABLE_PX` / `LABEL_MAX_COUNTER_SCALE` / `LABEL_BASE_FONT_PX` in `labelSettings.ts`.
- [x] "Aa" toggle in [`ZoomControls`](../../packages/axoview-lib/src/components/ZoomControls/ZoomControls.tsx) (`aria-pressed`, `canvas-readable-labels` hook, `keepLabelsReadable` locale string × 13).
- [x] Counter-scale labels below threshold (NodeActionBar §8.8 direct-DOM zoom subscription in `ExpandableLabel` → `--axoview-label-scale` CSS var composed by `Label`), label-only — node geometry untouched. Pure math in `utils/labelScale.ts`.
- [x] Persist toggle across reload (wired through `persistedSettings.ts` + `Axoview.tsx`).

### F. Clickable empty-state cards (locked decision #8 — no ADR) — ✅ shipped
- [x] In [`EmptyStateScreen.tsx`](../../packages/axoview-app/src/components/EmptyStateScreen.tsx), make the whole card the click target — content wrapped in `CardActionArea` (keyboard Enter/Space + ripple/hover for free).
- [x] Demote the inner blue `Button` to a non-interactive visual label (`component="span"`, `tabIndex={-1}`, `aria-hidden`, `pointerEvents:'none'`) so there is **no button-inside-button**. Visual look preserved.
- [x] **Preserve** the `data-axoview-id="screen-empty-create"` / `screen-empty-import` hooks — moved onto the `CardActionArea`; POM + `smoke.spec.ts` J20 still green.
- [x] Confirm hover/focus affordance reads as "this whole square is clickable" — CardActionArea ripple/hover overlay covers the full card (clipped to the rounded corners), and `aria-label` gives the card its accessible name.
- [x] Tests: `EmptyStateScreen.test.tsx` (6 cases — hooks, single interactive element, accessible name, click create/import, icon-region click) + `empty-state-clickable-card.spec.ts` E2E (icon-region click opens diagram; no nested button).

### X. Quality bar — applies to EVERY thread above (locked decision #9)
Do this **per thread**, not as a deferred clean-up pass:
- [ ] **Unit tests** for each new store slice / pure helper (popover content gate, layer-override merge, annotation persistence-exclusion, zoom-center preservation math, label counter-scale math).
- [ ] **E2E tests** (`packages/axoview-e2e/`) for each user-visible flow, with a POM per surface:
  - [ ] View-mode popover: hover preview, click-pin, Esc/click-away close, link present.
  - [ ] Preview layer switcher: toggle + solo change canvas; diagram stays non-dirty.
  - [ ] Annotation: open palette, draw, collapse-hides / expand-shows, Clear wipes; **save/export contain no annotation data**.
  - [x] Iso↔2D: zoom % is preserved across a round-trip switch (no 65→80→97 pop). (`canvas-mode-zoom-preserve.spec.ts`)
  - [x] Label toggle: on → labels readable at low zoom; persists across reload. (`readable-labels.spec.ts` + `labelScale.test.ts`)
  - [x] Empty-state: clicking anywhere on each card fires create/import (`EmptyStateScreenPOM.clickCreateCardTop` + `empty-state-clickable-card.spec.ts`).
- [ ] **Tech-debt sweep** of the files each thread touches — apply [[feedback_triage_rule]] (Bug=fix; minor improvement=fix; new functionality=Deferred register). Run `/audit` scope or `knip` if the surface is large; leave no dead code, no stale selectors, no orphaned props.
- [ ] **Docs/notes refresh** where warranted: `docs/ux-principles.md` (new popover/overlay/label patterns), `docs/architecture.md` (new render layers / uiState slices), `known_issues.md`, and **all locale files** for any new UI strings (per ux-principles §7 — no English fallbacks).
- [ ] CI green (unit + E2E + `knip` hard-fail) before any thread is marked done.

## Wrap-up

When all sub-tasks are complete and the smoke checklist passes:

1. Add a single line under the relevant `PLAN.md` phase section:
   ```
   - View-mode UX + annotation + canvas polish shipped — see docs/adr/0012..0015 and (this file's git history).
   ```
   > TODO: these features are not in the current Phase Status Dashboard (open phases are 3A/3B/4A
   > infra). Confirm with the user whether to add a new "Phase 6 — Presentation & Annotation" row
   > or fold the one-liner under an existing phase. Do this **only** at wrap, per the convention.
2. Delete this file. The ADRs are the durable record.
3. Update memory pointer `project_docs_convention.md` (remove the active-tactical bullet; the four
   ADRs are already listed there).

## Notes for Claude

- **Two packages.** Annotation + popover likely touch `axoview-lib` (canvas, overlays) and may
  touch `axoview-app` (toolbar portal). Per [[project_dev_lib_rebuild]]: restart `npm run dev`
  after `npm run build:lib`, or the app reads a stale `dist/`.
- **Persistence is the trap for annotations.** The single most important invariant (ADR 0014) is
  that *nothing* annotation-related reaches save/export/zip. Write the exclusion test first.
- **Two visibility source-of-truths** for layers (model `layer.visible` vs preview override). Keep
  the merge in one place (`useLayerContext`) with the documented precedence, or they desync.
- **Counter-scale pattern is already proven** — copy `NodeActionBar`'s direct-DOM zoom
  subscription for both the popover anchoring sanity and the label legibility toggle; don't
  re-render React on zoom.
- **Don't force-fit.** Decision #6 deletes a `fitToView()`; the iso↔2D selection/tile math lives in
  [`useIsoProjection`](../../packages/axoview-lib/src/hooks/useIsoProjection.ts) /
  [`coordinateTransforms`](../../packages/axoview-lib/src/utils/coordinateTransforms.ts) — use the
  mode-aware `getTilePosition` to map the viewport-center tile under both projections.
