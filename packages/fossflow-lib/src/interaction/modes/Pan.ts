import { produce } from 'immer';
import { CoordsUtils, setWindowCursor } from 'src/utils';
import { ModeActions } from 'src/types';

export const Pan: ModeActions = {
  entry: () => {
    setWindowCursor('grab');
  },
  exit: () => {
    setWindowCursor('default');
  },
  mousemove: ({ uiState }) => {
    if (uiState.mode.type !== 'PAN') return;

    if (uiState.mouse.mousedown !== null) {
      const newScroll = produce(uiState.scroll, (draft) => {
        draft.position = uiState.mouse.delta?.screen
          ? CoordsUtils.add(draft.position, uiState.mouse.delta.screen)
          : draft.position;
      });

      uiState.actions.setScroll(newScroll);
    }
  },
  mousedown: ({ uiState, isRendererInteraction }) => {
    if (uiState.mode.type !== 'PAN' || !isRendererInteraction) return;

    setWindowCursor('grabbing');
  },
  mouseup: ({ uiState }) => {
    if (uiState.mode.type !== 'PAN') return;
    setWindowCursor('grab');
    // Note: Mode switching is now handled by usePanHandlers

    // MQA #22 / #25 (Bundle B follow-up): EXPLORABLE_READONLY no longer
    // navigates or opens a panel on node body click. The node's hover-revealed
    // action chip ([NodeHoverChip] in Node.tsx) is now the canonical surface
    // for opening the linked diagram, opening notes, or following the name's
    // external link. The body click is intentionally inert so users selecting
    // a node visually no longer trigger an unwanted navigation. We still clear
    // any open itemControls on body click to dismiss leftover UI.
    if (uiState.editorMode === 'EXPLORABLE_READONLY') {
      const mousedownTile = uiState.mouse.mousedown?.tile;
      const currentTile = uiState.mouse.position.tile;
      if (mousedownTile && CoordsUtils.isEqual(mousedownTile, currentTile)) {
        uiState.actions.setItemControls(null);
      }
    }
  }
};
