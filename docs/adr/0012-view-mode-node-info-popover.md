# ADR 0012 — View-Mode Item Info Popover

**Status:** Proposed
**Date:** 2026-06-11
**Supersedes:** none
**Superseded by:** none

## Context

In view-only mode (`EditorModeEnum.EXPLORABLE_READONLY`) the app surfaces an item's
name and notes by **reusing the right Properties dock**: [`RightSidebar.tsx`](../../packages/axoview-lib/src/components/RightSidebar.tsx)
renders [`ItemControlsManager`](../../packages/axoview-lib/src/components/ItemControls/ItemControlsManager.tsx)
with `readOnly`. That panel is an *editing* surface — tabbed Details / Style / Notes,
form fields — repurposed for reading.

For the primary view-mode use case (exploring / presenting a diagram) this is the wrong
shape:

- It steals 300px of horizontal space from the diagram on every selection.
- It forces a click → look-right → look-back round trip, breaking attention on the canvas.
- Notes links are buried inside an editor surface rather than being directly actionable in
  a reading flow.

The right dock should be an edit-mode surface. View mode needs a lightweight, canvas-anchored
way to read an item's details and follow links without leaving the diagram.

This pairs with the view-mode chrome work in [ADR 0013](0013-preview-mode-layer-switcher.md)
(preview layer control) — together they define what view mode shows instead of the editing docks.

## Decision

In `EXPLORABLE_READONLY`, an item's info surfaces as a **Popover** anchored to the item on the
canvas. (Surface term per [ADR 0008](0008-naming-convention.md) Decision 2 — this is a Popover,
not a Panel.)

Interaction:

- **Hover** an item that has content → a lightweight preview popover (name + a notes excerpt),
  opens after a short hover-intent delay, closes on mouse-out.
- **Click** the item → the popover **pins open** and stays until dismissed via its close (X),
  click-away, or **Esc**.
- Notes render as **read-only HTML with clickable links** (`target="_blank"`,
  `rel="noopener noreferrer"`); the item's `headerLink` is offered as a primary link affordance.
- Only items with content (non-empty `name`, `notes`, or `headerLink`) get a popover. Empty
  items show nothing on hover/click.

Scope changes:

- The right Properties dock **no longer auto-opens** on selection in `EXPLORABLE_READONLY`.
  Edit-mode (`EDITABLE`) behavior is unchanged.
- **Item-type parity** (per [ux-principles §5](../ux-principles.md)): node, connector,
  rectangle, and textbox all use the same popover.

Positioning follows [ux-principles §8.8](../ux-principles.md): an MUI `Popover` renders via
Portal at the document root, so it is already screen-pixel-stable; it anchors to the item's DOM
node (the same anchor [`NodeActionBar`](../../packages/axoview-lib/src/components/NodeActionBar/NodeActionBar.tsx)
uses).

## Consequences

**Positive:**
- Reading flow stays on the canvas; links are directly actionable.
- The right dock reverts to a single role (editing), reducing two-meaning ambiguity.
- Hover-preview + click-to-pin matches how presentation/explore tools behave.

**Negative / risks:**
- Hover popovers on dense diagrams can flicker; needs hover-intent debounce.
- Touch devices have no hover — click-to-pin is the fallback (acceptable; no hover preview there).
- A focusable, keyboard-dismissable popover is required for accessibility (Esc already specified).

## Implementation notes (non-binding)

- Build on MUI `Popover` (pinned) + a hover-intent wrapper; `anchorEl` = the item's canvas DOM node.
- Reuse the read-only render path already used for notes display (the same HTML the `readOnly`
  `RichTextEditor`/notes view produces) so link sanitisation stays in one place.
- Hover-intent: ~150ms open, ~100ms close. Pinned state in a small uiState slice
  (e.g. `uiState.pinnedInfoItem`) or local to a view-mode controller component.
- Gate the whole behavior on `editorMode === EXPLORABLE_READONLY`. The existing `readOnly`
  `ItemControls` path may remain reachable if the dock is explicitly opened, but it stops
  auto-opening.
- Canvas selection still highlights the item (selection model unchanged); only the *info surface*
  moves from dock to popover.

## Acceptance criteria

- **Manual:** In view mode, hovering a node with notes shows a preview popover; moving away
  closes it. Clicking pins it; Esc / click-away / X closes it.
- **Manual:** A link inside notes opens in a new tab.
- **Manual:** The right dock does not auto-open on selection in view mode.
- **Manual:** Connector, rectangle, and textbox show the same popover.
- **Unit/manual:** Items with no `name`, `notes`, or `headerLink` produce no popover.
