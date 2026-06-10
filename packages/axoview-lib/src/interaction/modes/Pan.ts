import { produce } from 'immer';
import { CoordsUtils, setWindowCursor, getItemAtTile } from 'src/utils';
import { ModeActions, ModelItem } from 'src/types';

// MQA #22 / #25 (3rd pass): in EXPLORABLE_READONLY the default cursor is the
// normal arrow (not grab). Right-click drag is the pan affordance — left-click
// opens the read-only details panel for the clicked node. EDITABLE mode keeps
// the historic grab/grabbing cursor.
const cursorForState = (editorMode: string | undefined): string =>
  editorMode === 'EXPLORABLE_READONLY' ? 'default' : 'grab';

// A node opens the read-only details panel only when it carries something to
// show: a link, a header link, or non-empty (HTML-stripped) description/notes.
const hasNonEmptyHtml = (value: string | undefined): boolean =>
  !!value && value.replace(/<[^>]*>/g, '').trim() !== '';

const nodeHasReadonlyContent = (modelItem: ModelItem | undefined): boolean =>
  !!modelItem &&
  (!!modelItem.link ||
    !!modelItem.headerLink ||
    hasNonEmptyHtml(modelItem.description) ||
    hasNonEmptyHtml(modelItem.notes));

// EXPLORABLE_READONLY left-click on a node opens the read-only details panel
// (NodePanel readOnly). Click on empty area — or on a node with no content —
// dismisses the panel. Treated as a click only when the up tile equals the
// down tile (no drag). Right-click drag is handled by usePanHandlers.
const handleReadonlyClick: ModeActions['mouseup'] = ({ uiState, scene, model }) => {
  const mousedownTile = uiState.mouse.mousedown?.tile;
  const currentTile = uiState.mouse.position.tile;
  if (!mousedownTile || !CoordsUtils.isEqual(mousedownTile, currentTile)) return;

  const item = getItemAtTile({ tile: currentTile, scene });
  if (item?.type !== 'ITEM') {
    uiState.actions.setItemControls(null);
    return;
  }

  const modelItem = model.items.find((i) => i.id === item.id);
  if (nodeHasReadonlyContent(modelItem)) {
    uiState.actions.setItemControls({ type: 'ITEM', id: item.id });
  } else {
    uiState.actions.setItemControls(null);
  }
};

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
  mouseup: (state) => {
    const { uiState } = state;
    if (uiState.mode.type !== 'PAN') return;
    setWindowCursor(cursorForState(uiState.editorMode));

    // The panel shows the description, notes, and an action header with
    // external-link + open-linked-diagram buttons.
    if (uiState.editorMode === 'EXPLORABLE_READONLY') {
      handleReadonlyClick(state);
    }
  }
};
