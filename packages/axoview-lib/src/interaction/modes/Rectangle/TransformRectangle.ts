import {
  getItemByIdOrThrow,
  getBoundingBox,
  convertBoundsToNamedAnchors,
  hasMovedTile
} from 'src/utils';
import { ModeActions } from 'src/types';

export const TransformRectangle: ModeActions = {
  // The resize begins when a TransformControls anchor sets this mode; entry runs
  // on the first pointer event after that. Open one history entry for the whole
  // resize — the per-frame batch writes skip history while it is open.
  entry: ({ scene }) => {
    scene.beginDragTransaction();
  },
  exit: ({ scene }) => {
    // Commit on any exit path (mouseup already committed → no-op; programmatic
    // mode change / escape commits the resize so far).
    scene.commitDragTransaction();
  },
  mousemove: ({ uiState, scene }) => {
    if (
      uiState.mode.type !== 'RECTANGLE.TRANSFORM' ||
      !hasMovedTile(uiState.mouse)
    )
      return;

    if (uiState.mode.selectedAnchor) {
      // User is dragging an anchor
      const rectangle = getItemByIdOrThrow(
        scene.rectangles,
        uiState.mode.id
      ).value;
      const rectangleBounds = getBoundingBox([rectangle.to, rectangle.from]);
      const namedBounds = convertBoundsToNamedAnchors(rectangleBounds);

      if (
        uiState.mode.selectedAnchor === 'BOTTOM_LEFT' ||
        uiState.mode.selectedAnchor === 'TOP_RIGHT'
      ) {
        const nextBounds = getBoundingBox([
          uiState.mode.selectedAnchor === 'BOTTOM_LEFT'
            ? namedBounds.TOP_RIGHT
            : namedBounds.BOTTOM_LEFT,
          uiState.mouse.position.tile
        ]);
        const nextNamedBounds = convertBoundsToNamedAnchors(nextBounds);

        // Immer-free per-frame resize (no full-state produce) — keeps the
        // resize smooth; lands in the open transaction = one undo entry.
        scene.batchUpdateRectangles([
          {
            id: uiState.mode.id,
            from: nextNamedBounds.TOP_RIGHT,
            to: nextNamedBounds.BOTTOM_LEFT
          }
        ]);
      } else if (
        uiState.mode.selectedAnchor === 'BOTTOM_RIGHT' ||
        uiState.mode.selectedAnchor === 'TOP_LEFT'
      ) {
        const nextBounds = getBoundingBox([
          uiState.mode.selectedAnchor === 'BOTTOM_RIGHT'
            ? namedBounds.TOP_LEFT
            : namedBounds.BOTTOM_RIGHT,
          uiState.mouse.position.tile
        ]);
        const nextNamedBounds = convertBoundsToNamedAnchors(nextBounds);

        scene.batchUpdateRectangles([
          {
            id: uiState.mode.id,
            from: nextNamedBounds.TOP_LEFT,
            to: nextNamedBounds.BOTTOM_RIGHT
          }
        ]);
      } else if (
        uiState.mode.selectedAnchor === 'TOP' ||
        uiState.mode.selectedAnchor === 'BOTTOM' ||
        uiState.mode.selectedAnchor === 'LEFT' ||
        uiState.mode.selectedAnchor === 'RIGHT'
      ) {
        // Edge-midpoint drag (ADR 0026): resize ONE axis, opposite edge
        // fixed. The two defining corners are the fixed corner plus a new
        // corner that takes the moving coordinate from the mouse and keeps
        // the perpendicular range from the current bounds.
        const mouseTile = uiState.mouse.position.tile;
        let pair: [typeof namedBounds.TOP_LEFT, typeof namedBounds.TOP_LEFT];

        if (uiState.mode.selectedAnchor === 'TOP') {
          // Move the high-Y edge (TOP); keep the BOTTOM (low-Y) edge fixed.
          pair = [
            namedBounds.BOTTOM_LEFT,
            { x: namedBounds.TOP_RIGHT.x, y: mouseTile.y }
          ];
        } else if (uiState.mode.selectedAnchor === 'BOTTOM') {
          // Move the low-Y edge (BOTTOM); keep the TOP (high-Y) edge fixed.
          pair = [
            namedBounds.TOP_LEFT,
            { x: namedBounds.BOTTOM_RIGHT.x, y: mouseTile.y }
          ];
        } else if (uiState.mode.selectedAnchor === 'LEFT') {
          // Move the low-X edge (LEFT); keep the RIGHT (high-X) edge fixed.
          pair = [
            namedBounds.TOP_RIGHT,
            { x: mouseTile.x, y: namedBounds.BOTTOM_LEFT.y }
          ];
        } else {
          // RIGHT — move the high-X edge; keep the LEFT (low-X) edge fixed.
          pair = [
            namedBounds.TOP_LEFT,
            { x: mouseTile.x, y: namedBounds.BOTTOM_RIGHT.y }
          ];
        }

        const nextBounds = getBoundingBox(pair);
        const nextNamedBounds = convertBoundsToNamedAnchors(nextBounds);

        scene.batchUpdateRectangles([
          {
            id: uiState.mode.id,
            from: nextNamedBounds.TOP_LEFT,
            to: nextNamedBounds.BOTTOM_RIGHT
          }
        ]);
      }
    }
  },
  mousedown: () => {
    // MOUSE_DOWN is triggered by the anchor iteself (see `TransformAnchor.tsx`)
  },
  mouseup: ({ uiState, scene }) => {
    if (uiState.mode.type !== 'RECTANGLE.TRANSFORM') return;

    // Commit before the mode switch so the resize closes as one history entry
    // (matches DragItems/Connector order: writes → commit → mode change).
    scene.commitDragTransaction();
    uiState.actions.setMode({
      type: 'CURSOR',
      mousedownItem: null,
      showCursor: true
    });
  }
};
