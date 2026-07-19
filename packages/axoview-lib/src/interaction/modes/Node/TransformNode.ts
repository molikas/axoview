import { PROJECTED_TILE_SIZE } from 'src/config';
import { ModeActions, ModeActionsAction, AnchorPosition } from 'src/types';

// On-canvas icon resize (ADR 0044). A corner handle press (NodeTransformControls)
// sets NODE.TRANSFORM with the grabbed anchor + the effective start scale. The
// resize previews through uiState.iconScaleDrag (a transient UI value — NO
// per-frame model write, so the O(N) WebGL node bulk isn't rebuilt each frame,
// canvas-interaction.md §6.1/§6.4) and commits the per-node `iconScale` to the
// model ONCE on release = one undo entry. Mirrors the labelDrag/labelMove
// preview pattern rather than the per-frame rectangle-transform pattern, because
// NodesCanvas is the big layer.

// Established UI bounds (schema hard bound is [0.1, 3]).
const MIN_ICON_SCALE = 0.3;
const MAX_ICON_SCALE = 2.5;

// On-screen reference half-extent (projected px @ scale 1, zoom 1) mapping a
// normalized outward drag to a unit scale change — tuned for a natural "corner
// follows the pointer" feel. Real-browser verified (jsdom can't render).
const NODE_RESIZE_REFERENCE_PX = PROJECTED_TILE_SIZE.width / 2;

// Outward (enlarging) screen direction for each corner, y-down. Dragging a
// corner away from the node centre enlarges; toward it shrinks. Correct in both
// iso and 2D — it is pure screen geometry.
const CORNER_SIGN: Partial<Record<AnchorPosition, { x: number; y: number }>> = {
  TOP_LEFT: { x: -1, y: -1 },
  TOP_RIGHT: { x: 1, y: -1 },
  BOTTOM_LEFT: { x: -1, y: 1 },
  BOTTOM_RIGHT: { x: 1, y: 1 }
};

const clampIconScale = (s: number): number =>
  Math.min(MAX_ICON_SCALE, Math.max(MIN_ICON_SCALE, s));

// Commit the previewed scale to the model ONCE (one history entry) and clear the
// transient preview. Reads uiState.iconScaleDrag (not mode.id) so it is correct
// from mouseup (mode still NODE.TRANSFORM) AND from exit (mode already changed).
const commitPendingScale: ModeActionsAction = ({ uiState, scene }) => {
  const drag = uiState.iconScaleDrag;
  if (!drag) return;
  scene.updateViewItem(drag.id, { iconScale: drag.scale });
  uiState.actions.clearIconScaleDrag();
};

export const TransformNode: ModeActions = {
  exit: (state) => {
    // Safety net: a programmatic mode change, or a release that landed back on
    // the anchor (where mouseup is gated out by isRendererInteraction), still
    // commits the previewed scale. After a normal mouseup this is a no-op — the
    // preview was already cleared.
    commitPendingScale(state);
  },
  mousemove: ({ uiState }) => {
    const mode = uiState.mode;
    if (mode.type !== 'NODE.TRANSFORM' || !mode.selectedAnchor) return;
    const sign = CORNER_SIGN[mode.selectedAnchor];
    if (!sign) return;
    const md = uiState.mouse.mousedown;
    if (!md) return;

    // Screen-space drag from the grab point (zoom-independent CSS px). Project it
    // onto the centre→corner diagonal, then /zoom because the icon's on-screen
    // size scales with zoom. Deliberately NOT gated on hasMovedTile — a node is a
    // single tile, so scaling needs the sub-tile screen delta to stay smooth.
    const cur = uiState.mouse.position.screen;
    const dx = cur.x - md.screen.x;
    const dy = cur.y - md.screen.y;
    const outward = (dx * sign.x + dy * sign.y) / Math.SQRT2;
    const zoom = uiState.zoom || 1;
    const next = clampIconScale(
      mode.startScale + outward / (NODE_RESIZE_REFERENCE_PX * zoom)
    );

    uiState.actions.setIconScaleDrag(mode.id, next);
  },
  mousedown: () => {
    // The handle press already set NODE.TRANSFORM (see NodeTransformControls).
  },
  mouseup: (state) => {
    const { uiState } = state;
    if (uiState.mode.type !== 'NODE.TRANSFORM') return;
    // Commit before the mode switch so the resize closes as one history entry
    // (matches the DragItems/Rectangle order: write → mode change).
    commitPendingScale(state);
    uiState.actions.setMode({
      type: 'CURSOR',
      mousedownItem: null,
      showCursor: true
    });
  }
};
