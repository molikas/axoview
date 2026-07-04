import { getItemByIdOrThrow } from 'src/utils';
import { ModeActions, ProjectionOrientationEnum, TextBox } from 'src/types';

// Text-box resize (ADR 0034 addenda 2026-07-03/04, Lucid parity): the full
// rectangle-style anchor set. Anchors on the text-RUN axis set a manual
// `textBox.width` (content soft-wraps, min 1 tile); anchors on the row axis
// set a manual `textBox.height` (a MINIMUM — content still grows past it, so
// text never clips); corners set both. Near-edge drags move the tile so the
// far edge stays put. Mirrors TransformRectangle's transaction choreography
// (one history entry per resize; exit commits as the abandon safety net).
//
// Axis mapping per orientation (see getTextBoxEndTile):
//   X: run along +x (LEFT/RIGHT = width), rows along −y (TOP/BOTTOM = height;
//      TOP is the high-Y near edge at tile.y — dragging it moves the tile).
//   Y: run along −y (TOP/BOTTOM = width; TOP is the near edge), rows along +x
//      (LEFT/RIGHT = height; LEFT is the near edge).
export const TransformTextBox: ModeActions = {
  entry: ({ scene }) => {
    scene.beginDragTransaction();
  },
  exit: ({ scene }) => {
    scene.commitDragTransaction();
  },
  mousemove: ({ uiState, scene }) => {
    if (uiState.mode.type !== 'TEXTBOX.TRANSFORM') return;
    const { selectedAnchor } = uiState.mode;
    if (!selectedAnchor) return;

    const textBox = getItemByIdOrThrow(
      scene.textBoxes,
      uiState.mode.id
    ).value;
    const mouse = uiState.mouse.position.tile;
    const currentWidth = Math.max(1, Math.round(textBox.size.width));
    const currentHeight = Math.max(1, Math.round(textBox.size.height));
    const isX =
      (textBox.orientation ?? ProjectionOrientationEnum.X) ===
      ProjectionOrientationEnum.X;

    const vertical = selectedAnchor.includes('TOP')
      ? 'TOP'
      : selectedAnchor.includes('BOTTOM')
      ? 'BOTTOM'
      : null;
    const horizontal = selectedAnchor.includes('LEFT')
      ? 'LEFT'
      : selectedAnchor.includes('RIGHT')
      ? 'RIGHT'
      : null;

    const updates: Partial<TextBox> = {};
    let nextTile = textBox.tile;

    if (isX) {
      if (horizontal) {
        const farX = textBox.tile.x + currentWidth;
        if (horizontal === 'RIGHT') {
          updates.width = Math.max(1, mouse.x - textBox.tile.x);
        } else {
          updates.width = Math.max(1, farX - mouse.x);
          nextTile = { ...nextTile, x: farX - updates.width };
        }
      }
      if (vertical) {
        const lowY = textBox.tile.y - (currentHeight - 1);
        if (vertical === 'BOTTOM') {
          updates.height = Math.max(1, textBox.tile.y - mouse.y + 1);
        } else {
          updates.height = Math.max(1, mouse.y - lowY + 1);
          nextTile = { ...nextTile, y: lowY + updates.height - 1 };
        }
      }
    } else {
      if (vertical) {
        const farY = textBox.tile.y - currentWidth;
        if (vertical === 'BOTTOM') {
          updates.width = Math.max(1, textBox.tile.y - mouse.y);
        } else {
          updates.width = Math.max(1, mouse.y - farY);
          nextTile = { ...nextTile, y: farY + updates.width };
        }
      }
      if (horizontal) {
        const farX = textBox.tile.x + (currentHeight - 1);
        if (horizontal === 'RIGHT') {
          updates.height = Math.max(1, mouse.x - textBox.tile.x + 1);
        } else {
          updates.height = Math.max(1, farX - mouse.x + 1);
          nextTile = { ...nextTile, x: farX - (updates.height - 1) };
        }
      }
    }

    const noop =
      (updates.width === undefined || updates.width === textBox.width) &&
      (updates.height === undefined || updates.height === textBox.height) &&
      nextTile.x === textBox.tile.x &&
      nextTile.y === textBox.tile.y;
    if (noop || (updates.width === undefined && updates.height === undefined)) {
      return;
    }
    // Lands inside the open transaction — the whole resize is one undo entry.
    scene.updateTextBox(uiState.mode.id, { ...updates, tile: nextTile });
  },
  mousedown: () => {
    // MOUSE_DOWN is triggered by the anchor itself (see TransformAnchor.tsx).
  },
  mouseup: ({ uiState, scene }) => {
    if (uiState.mode.type !== 'TEXTBOX.TRANSFORM') return;
    // Commit before the mode switch so the resize closes as one history entry
    // (matches TransformRectangle order: writes → commit → mode change).
    scene.commitDragTransaction();
    uiState.actions.setMode({
      type: 'CURSOR',
      mousedownItem: null,
      showCursor: true
    });
  }
};
