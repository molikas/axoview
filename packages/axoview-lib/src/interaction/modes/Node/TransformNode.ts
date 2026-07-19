import { PROJECTED_TILE_SIZE } from 'src/config';
import { ModeActions, ModeActionsAction, AnchorPosition } from 'src/types';

// On-canvas icon resize (ADR 0044). A corner handle press (NodeTransformControls
// / NodeGroupTransformControls) sets NODE.TRANSFORM with the grabbed anchor + the
// target node(s) and their start scales. mousemove turns the screen-drag into ONE
// uniform scale FACTOR and applies it to each target's own start scale — so a
// group keeps its relative sizes ("make these all bigger"). It previews through
// uiState.iconScaleDrag (a transient map — NO per-frame model write, so the O(N)
// WebGL node bulk isn't rebuilt each frame; canvas-interaction.md §6.1/§6.4) and
// commits every target's `iconScale` in ONE transaction on release = one undo
// entry. Mirrors the labelDrag/labelMove preview pattern.

// Established UI bounds (schema hard bound is [0.1, 3]).
const MIN_ICON_SCALE = 0.3;
const MAX_ICON_SCALE = 2.5;

// On-screen reference half-extent (projected px @ scale 1, zoom 1) mapping a
// normalized outward drag to a unit change in the factor — tuned for a natural
// "corner follows the pointer" feel. Real-browser verified (jsdom can't render).
const NODE_RESIZE_REFERENCE_PX = PROJECTED_TILE_SIZE.width / 2;

// Outward (enlarging) screen direction for each corner, y-down. Dragging a corner
// away from the centre enlarges; toward it shrinks. Correct in iso AND 2D — pure
// screen geometry.
const CORNER_SIGN: Partial<Record<AnchorPosition, { x: number; y: number }>> = {
  TOP_LEFT: { x: -1, y: -1 },
  TOP_RIGHT: { x: 1, y: -1 },
  BOTTOM_LEFT: { x: -1, y: 1 },
  BOTTOM_RIGHT: { x: 1, y: 1 }
};

const clampIconScale = (s: number): number =>
  Math.min(MAX_ICON_SCALE, Math.max(MIN_ICON_SCALE, s));

// Commit the previewed scales to the model as ONE history entry (a transaction,
// so a group commits together) and clear the transient preview. Reads
// uiState.iconScaleDrag (not the mode) so it is correct from mouseup (mode still
// NODE.TRANSFORM) AND from exit (mode already changed).
const commitPendingScales: ModeActionsAction = ({ uiState, scene }) => {
  const drag = uiState.iconScaleDrag;
  if (!drag) return;
  const entries = Object.entries(drag.scales);
  if (entries.length > 0) {
    scene.transaction(() => {
      for (const [id, scale] of entries) {
        scene.updateViewItem(id, { iconScale: scale });
      }
    });
  }
  uiState.actions.clearIconScaleDrag();
};

export const TransformNode: ModeActions = {
  exit: (state) => {
    // Safety net: a programmatic mode change, or a release that landed back on
    // the anchor (where mouseup is gated out by isRendererInteraction), still
    // commits the preview. After a normal mouseup this is a no-op — already
    // cleared.
    commitPendingScales(state);
  },
  mousemove: ({ uiState }) => {
    const mode = uiState.mode;
    if (mode.type !== 'NODE.TRANSFORM' || !mode.selectedAnchor) return;
    const sign = CORNER_SIGN[mode.selectedAnchor];
    if (!sign) return;
    const md = uiState.mouse.mousedown;
    if (!md || mode.targets.length === 0) return;

    // Screen-space drag from the grab point (zoom-independent CSS px), projected
    // onto the centre→corner diagonal, then /zoom because the icon's on-screen
    // size scales with zoom. Yields ONE factor (1 at the grab point) applied to
    // every target's own start scale. Deliberately NOT gated on hasMovedTile — a
    // node is a single tile, so scaling needs the sub-tile screen delta.
    const cur = uiState.mouse.position.screen;
    const dx = cur.x - md.screen.x;
    const dy = cur.y - md.screen.y;
    const outward = (dx * sign.x + dy * sign.y) / Math.SQRT2;
    const zoom = uiState.zoom || 1;
    const factor = Math.max(
      0.05,
      1 + outward / (NODE_RESIZE_REFERENCE_PX * zoom)
    );

    const scales: Record<string, number> = {};
    for (const t of mode.targets) {
      scales[t.id] = clampIconScale(t.startScale * factor);
    }
    uiState.actions.setIconScaleDrag(scales);
  },
  mousedown: () => {
    // The handle press already set NODE.TRANSFORM (see the *TransformControls).
  },
  mouseup: (state) => {
    const { uiState } = state;
    if (uiState.mode.type !== 'NODE.TRANSFORM') return;
    // Commit before the mode switch so the resize closes as one history entry.
    commitPendingScales(state);
    uiState.actions.setMode({
      type: 'CURSOR',
      mousedownItem: null,
      showCursor: true
    });
  }
};
