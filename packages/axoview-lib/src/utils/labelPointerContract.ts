// The pointer contract shared by the two label hit-proxies (ADR 0031 §4).
//
// `LabelHitLayer` (floating labels) and `NodeLabelHitLayer` (node name chips)
// are siblings: both are invisible DOM rects sitting over a canvas-painted chip,
// both own the press that the canvas cannot receive. They drifted — the node
// layer let a right-click fall through to the canvas, which then resolved the
// bare tile and opened the CANVAS menu instead of the node's, while floating
// labels opened their item menu correctly (bug #7 of the ADR 0023 cluster).
//
// The mechanics live here so the two cannot drift again; the per-layer
// difference (what a press selects, what the menu targets) stays with the
// layer. `labelPointerContract.test.tsx` runs both layers through the same
// expectations.

import { ItemReference } from 'src/types';

/** Pixels a press must travel before it counts as a label move, not a click. */
export const LABEL_DRAG_SLOP_PX = 4;

// Structural event shapes — the proxies pass React synthetic events, but this
// module has no reason to depend on React (mirrors `SlimMouseEvent`).
interface PressEvent {
  button: number;
  stopPropagation(): void;
}

interface ContextMenuEvent {
  clientX: number;
  clientY: number;
  preventDefault(): void;
  stopPropagation(): void;
}

interface ContextMenuActions {
  openContextMenu(args: {
    anchor: { x: number; y: number };
    variant: 'item';
    target: ItemReference;
  }): void;
}

/**
 * The press contract. The proxy ALWAYS swallows the press — letting it reach the
 * canvas-interactions box would clear the selection or start a pan under a chip
 * the user is aiming at. Only the primary button starts a move gesture; right
 * and middle belong to {@link openLabelContextMenu}, which the proxy must
 * therefore also wire up (that pairing is the invariant — a layer that swallows
 * the press without owning the menu makes its chip un-right-clickable, which is
 * exactly how the node label lost its context menu).
 *
 * @returns true when the caller should begin its label move gesture.
 */
export const shouldBeginLabelDrag = (e: PressEvent): boolean => {
  e.stopPropagation();
  return e.button === 0;
};

/**
 * The right-click contract: open the target's ITEM menu at the cursor. The
 * proxy sits above the canvas box and labels are deliberately outside the tile
 * hit-test, so the window-level right-tap handler (`usePanHandlers`) can never
 * resolve a chip — if the proxy doesn't open the menu, nothing does.
 *
 * `select` is the caller's own selection idiom (a floating Label selects itself
 * through `setItemControls`; a node label selects its node), run before the menu
 * opens so the menu's commands act on the right thing.
 */
export const openLabelContextMenu = (
  e: ContextMenuEvent,
  actions: ContextMenuActions,
  target: ItemReference,
  select: () => void
): void => {
  e.preventDefault();
  e.stopPropagation();
  select();
  actions.openContextMenu({
    anchor: { x: e.clientX, y: e.clientY },
    variant: 'item',
    target
  });
};
