# ADR 0014 — Ephemeral Annotation Overlay

**Status:** Proposed
**Date:** 2026-06-11
**Supersedes:** none
**Superseded by:** none

## Context

Users want to "paint on top" of a diagram — pencil/highlighter markup, simple shapes and arrows —
while presenting or while editing, the way Windows screen-annotation tools (Epic Pen and similar)
work. [ADR 0005](0005-toolbar-and-dock-layout-contract.md) Decision 1 already **reserved a
top-toolbar slot** for exactly this: Group 1 "View modes" lists `◐ View` owning *focus mode,
**annotation overlay***, with the position locked and the control deferred until "its feature ADR
ships." This is that ADR.

Critical constraint: annotations are **scratch**, not diagram content. They must never enter any
persistence path — not session save, not server save, not export JSON, not the project zip
([ADR 0001](0001-project-zip-format.md) / lean-save [ADR 0003](0003-session-storage-lean-icon-save.md)).
They are a transient overlay for talking over a diagram.

## Decision

An **ephemeral free-draw overlay** rendered above the canvas, available in both `EDITABLE` and
`EXPLORABLE_READONLY`.

### Entry & placement

- A **pen entry in the top toolbar's View-modes group** ([ADR 0005](0005-toolbar-and-dock-layout-contract.md)
  Group 1).
- Clicking it opens a **draggable floating vertical palette** (the user's chosen design,
  2026-06-11), repositionable anywhere on screen. Same control in edit and preview modes.

### Tools

Pencil, highlighter, line/arrow, simple shapes (rectangle / ellipse), a fixed preset palette of
popular colors, a thickness selector, an eraser (remove a single stroke), undo, and a
**Clear / Trash** button.

### Lifecycle (locked with user 2026-06-11)

- Drawing accumulates in memory.
- **Collapsing the palette hides the overlay; expanding shows the same drawing again.** Collapse
  is a *visibility toggle*, not a discard.
- The **Clear / Trash** button wipes all strokes. This is the only "discard everything" action.
- Annotations **persist until Clear or page reload** (session-scoped, in-memory).
- Annotations are **never written to the project file** — excluded from session save, server save,
  export JSON, and project zip.

### Anchoring (recommended — confirm at review)

Strokes are stored in **scene/canvas coordinates** so they track pan, zoom, and projection — i.e.
an arrow drawn pointing at a node keeps pointing at it when the user pans or zooms. (Screen-space
strokes would drift off their target the moment the canvas moves, which is wrong for "annotate
*this thing*.")

> TODO (resolve at review): scene-space anchoring interacts with the iso↔2D projection switch.
> Confirm whether annotations should re-project with the canvas or freeze on projection change.

### Export (recommended — confirm at review)

Included in **image / PNG export** when the overlay is visible (so a presenter can capture an
annotated frame); never in JSON / zip.

> TODO (resolve at review): confirm image-export inclusion.

## Consequences

**Positive:**
- Lightweight markup with zero model pollution; reuses the reserved [ADR 0005](0005-toolbar-and-dock-layout-contract.md)
  toolbar slot.
- One discard action (Clear) — collapse is non-destructive, matching the user's mental model.

**Negative / risks:**
- A new render + pointer-interaction layer that must not interfere with canvas selection:
  annotation mode captures pointer events while a draw tool is active; exiting returns control to
  the normal interaction manager.
- Scene-space anchoring adds projection-transform work on every pan/zoom and on the iso↔2D switch.

## Implementation notes (non-binding)

- Overlay as a `<canvas>` or `<svg>` sibling of [`SceneLayer`](../../packages/axoview-lib/src/components/SceneLayer/SceneLayer.tsx);
  strokes as polylines/shape primitives in scene coordinates, projected with the same transform
  the scene uses.
- New uiState slice: `annotation { tool, color, thickness, strokes[], visible, palettePos }`. An
  undo stack local to the overlay (independent of the model history in
  [`useHistory`](../../packages/axoview-lib/src/hooks/useHistory.ts)).
- Pointer events captured **only** while a draw tool is active, so selection/pan still work when
  the palette is open but idle.
- **Persistence exclusion must be asserted in tests** — extend the [`leanSave`](../../packages/axoview-lib/src/utils/leanSave.ts)
  and [`projectZip`](../../packages/axoview-app/src/services/project/projectZip.ts) test suites to
  prove no annotation data appears in any output.
- The palette is a draggable [`UiElement`](../../packages/axoview-lib/src/components/UiElement/UiElement.tsx);
  mirror the floating-chrome conventions used by [`ToolMenu`](../../packages/axoview-lib/src/components/ToolMenu/ToolMenu.tsx).

## Acceptance criteria

- **Manual:** The pen toolbar entry opens a draggable floating palette in both edit and preview.
- **Manual:** Draw with pencil, highlighter, shape, and arrow; switch color and thickness; eraser
  removes one stroke; undo reverts the last stroke.
- **Manual:** Collapsing the palette hides the drawing; expanding restores the *same* drawing.
  Clear wipes everything.
- **Unit:** Save, export-JSON, and project-zip outputs contain zero annotation data (asserted in
  `leanSave` / `projectZip` tests).
- **Manual:** With a draw tool inactive, normal canvas selection/pan still work.
