import { ModeActions } from 'src/types';
import { findNearestUnoccupiedTilesForGroup } from 'src/utils';

// CARRY_ITEM — the touch/pen "carrying" state (ADR 0018 Decision 4). A node was
// grabbed (second tap on the selected node) and is held until the next tap drops
// it. The model is NOT written while carrying — the node stays at its origin
// (the carry affordance is pure CSS), so a pointercancel / second-finger abort
// leaves it exactly where it was (D-2: node carry only, no rollback primitive).
//
// The manager's touch path drives this: it dispatches a synthetic mousedown +
// mouseup at the tapped tile, and PLACE happens here on mouseup. GRAB (entering
// this mode) and abort live in the manager (tactical §C — pointerType branch in
// one place).
export const CarryItem: ModeActions = {
  mousemove: () => {
    // No finger-follow: touch has no hover, so the carried node does not track
    // the pointer between taps (ADR 0018 Decision 4).
  },
  mousedown: () => {
    // Placement is resolved on the tap's mouseup so the gesture reads as a
    // single tap-to-drop. Nothing to do on down.
  },
  mouseup: ({ uiState, scene, isRendererInteraction }) => {
    if (uiState.mode.type !== 'CARRY_ITEM' || !isRendererInteraction) return;

    const { item } = uiState.mode;

    // Only nodes are carried (PLACE relocates a view item to a free tile).
    if (item.type === 'ITEM') {
      // Exclude the carried node from the occupancy set so it can land on (or
      // adjacent to) its own origin without self-colliding. Reuses the
      // PlaceIcon nearest-free rule (group variant for the exclude support).
      const placed = findNearestUnoccupiedTilesForGroup(
        [{ id: item.id, targetTile: uiState.mouse.position.tile }],
        scene,
        [item.id]
      );
      const targetTile = placed?.[0] ?? null;
      if (targetTile) {
        // One history entry for the whole relocate (begin/commit bracket so the
        // single updateViewItem write commits as one undo step).
        scene.beginDragTransaction();
        scene.updateViewItem(item.id, { tile: targetTile });
        scene.commitDragTransaction();
      }
    }

    // Return to SELECT (CURSOR) with the node selected at its new location.
    uiState.actions.setMode({
      type: 'CURSOR',
      showCursor: true,
      mousedownItem: null
    });
    if (uiState.actions.setSelectedIds) {
      uiState.actions.setSelectedIds([{ type: item.type, id: item.id }]);
    } else {
      uiState.actions.setItemControls({ type: item.type, id: item.id });
    }
  }
};
