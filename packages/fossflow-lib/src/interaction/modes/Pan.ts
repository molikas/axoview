import { produce } from 'immer';
import { CoordsUtils, setWindowCursor, getItemAtTile } from 'src/utils';
import { ModeActions } from 'src/types';

// MQA #22 / #25 (3rd pass): in EXPLORABLE_READONLY the default cursor is the
// normal arrow (not grab). Right-click drag is the pan affordance — left-click
// opens the read-only details panel for the clicked node. EDITABLE mode keeps
// the historic grab/grabbing cursor.
const cursorForState = (editorMode: string | undefined): string =>
  editorMode === 'EXPLORABLE_READONLY' ? 'default' : 'grab';

export const Pan: ModeActions = {
  entry: ({ uiState }) => {
    setWindowCursor(cursorForState(uiState.editorMode));
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
    // Only flip to the grabbing cursor when we're in a mode where panning is
    // the primary left-click action (EDITABLE). In EXPLORABLE_READONLY the
    // left-click is reserved for opening the details panel.
    if (uiState.editorMode !== 'EXPLORABLE_READONLY') {
      setWindowCursor('grabbing');
    }
  },
  mouseup: ({ uiState, scene, model }) => {
    if (uiState.mode.type !== 'PAN') return;
    setWindowCursor(cursorForState(uiState.editorMode));

    // MQA #22 / #25 (3rd pass): EXPLORABLE_READONLY left-click on a node opens
    // the existing read-only details panel (NodePanel readOnly). The panel
    // shows the description, notes, and an action header with external-link
    // + open-linked-diagram buttons. Click on empty area dismisses the panel.
    // Right-click drag is handled by usePanHandlers and never reaches here.
    if (uiState.editorMode === 'EXPLORABLE_READONLY') {
      const mousedownTile = uiState.mouse.mousedown?.tile;
      const currentTile = uiState.mouse.position.tile;
      // Only treat as a click when up tile equals down tile (no drag).
      if (mousedownTile && CoordsUtils.isEqual(mousedownTile, currentTile)) {
        const item = getItemAtTile({ tile: currentTile, scene });
        if (item?.type === 'ITEM') {
          const modelItem = model.items.find((i) => i.id === item.id);
          const hasContent =
            !!modelItem?.link ||
            !!modelItem?.headerLink ||
            (!!modelItem?.description &&
              modelItem.description.replace(/<[^>]*>/g, '').trim() !== '') ||
            (!!modelItem?.notes &&
              modelItem.notes.replace(/<[^>]*>/g, '').trim() !== '');
          if (hasContent) {
            uiState.actions.setItemControls({ type: 'ITEM', id: item.id });
          } else {
            uiState.actions.setItemControls(null);
          }
        } else {
          uiState.actions.setItemControls(null);
        }
      }
    }
  }
};
