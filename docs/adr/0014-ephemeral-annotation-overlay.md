# ADR 0014 — Ephemeral Annotation Overlay

**Status:** Accepted
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
  Group 1). *(As-built, v3.7.0: the pen actually ships as a **floating overlay button** mounted in
  `UiOverlay` — top-right, dodging the dock — **not** the reserved ADR 0005 toolbar slot, which
  remains reserved/empty. See `AnnotationPalette`.)*
- Clicking it opens a **fixed** vertical palette directly beneath the pen. *(The original
  "draggable floating palette, repositionable anywhere" design was superseded by the revision below —
  the palette is fixed, not draggable.)* Same control in edit and preview modes.

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

Strokes are stored in **scene-canvas coordinates** so they track pan and zoom — i.e. an arrow
drawn pointing at a node keeps pointing at it when the user pans or zooms. (Screen-space strokes
would drift off their target the moment the canvas moves, which is wrong for "annotate *this
thing*.") The overlay renders inside a `<g>` whose transform mirrors `SceneLayer`
(`translate(rendererCenter + scroll) scale(zoom)`), updated by a direct store subscription so
pan/zoom never re-renders React.

**Resolved — iso↔2D projection switch (2026-06-11):** annotations **freeze in canvas space** on a
projection switch; they do **not** re-project. The scene-canvas coordinate space is the same for
both projections, but diagram *tiles* re-project (node positions move) while strokes stay put — so
a stroke aligned to a node in ISO will not track that node after switching to 2D. This is an
accepted trade-off for transient scratch markup: re-projecting throwaway strokes adds real
complexity (per-stroke tile re-derivation) for a layer the user can Clear and redraw in seconds.

### Export

**Resolved — image-export inclusion (2026-06-11): deferred.** Annotations are **not** included in
image / PNG export in this version; export produces a clean diagram image. Image export renders a
dedicated capture path (`ExportImageDialog`), and weaving the transient overlay into it is its own
piece of work with no current forcing function. Annotations remain a *live presentation* overlay;
a presenter screen-captures the frame if they need to keep it. (Never in JSON / zip — that is the
load-bearing invariant, asserted in tests.)

### Revision (2026-06-12 — shake-out polish)

UX refinements after first use, keeping the ephemeral-scratch invariant intact:

- **Pen = the single toggle.** The top-right pen button stays visible and *is* the open/close
  control (highlighted when active). This **removes the separate X, collapse, and drag controls**;
  closing the pen hides the palette + drawing but retains strokes (close ≠ discard, as before).
- **Fixed palette under the pen** (no longer draggable) — it opens directly beneath the pen, where
  the user expects it. Supersedes the "draggable floating palette" detail above.
- **Excalidraw-style tool strip with a Select tool.** A `select` tool (default on open) makes the
  overlay pass-through so the canvas stays interactive; draw/eraser tools capture input. This is the
  discoverable "stop drawing to interact" affordance; **Esc / `V`** also returns to Select. Right-drag
  pan and wheel zoom remain available while drawing (the overlay only acts on left-button draws).
- **Redo** added alongside undo (linear history; a new stroke clears the redo stack).
- **Tool-reflecting cursors** (pen / crosshair / eraser) instead of a blanket crosshair, and a proper
  eraser glyph in the palette.

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

- **Manual:** The pen (a floating overlay button, not a toolbar entry) opens a **fixed** palette directly beneath it, in both edit and preview. *(Corrected from the original "toolbar entry opens a draggable floating palette" — superseded by the revision above.)*
- **Manual:** Draw with pencil, highlighter, shape, and arrow; switch color and thickness; eraser
  removes one stroke; undo reverts the last stroke.
- **Manual:** Collapsing the palette hides the drawing; expanding restores the *same* drawing.
  Clear wipes everything.
- **Unit:** Save, export-JSON, and project-zip outputs contain zero annotation data (asserted in
  `leanSave` / `projectZip` tests).
- **Manual:** With a draw tool inactive, normal canvas selection/pan still work.
