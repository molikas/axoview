import { produce } from 'immer';
import {
  generateId,
  getItemAtTile,
  hasMovedTile,
  setWindowCursor
} from 'src/utils';
import {
  ModeActions,
  Connector as ConnectorI,
  ConnectorAnchor,
  Coords,
  State
} from 'src/types';

type ItemAtTile = ReturnType<typeof getItemAtTile>;

// Build a fresh connector anchor pointing at the hovered item (when one is
// under the cursor) or the raw tile. Mirrors the inline anchor construction
// the connector handlers previously repeated.
const makeAnchor = (itemAtTile: ItemAtTile, tile: Coords): ConnectorAnchor =>
  itemAtTile?.type === 'ITEM'
    ? { id: generateId(), ref: { item: itemAtTile.id } }
    : { id: generateId(), ref: { tile } };

// A brand-new two-ended connector with both anchors pinned to the same target.
const createConnectorAt = (
  colorId: string,
  itemAtTile: ItemAtTile,
  tile: Coords
): ConnectorI => ({
  id: generateId(),
  color: colorId,
  anchors: [makeAnchor(itemAtTile, tile), makeAnchor(itemAtTile, tile)]
});

// Click mode, first click: create the connector and arm the second click.
const handleClickFirst = (
  { uiState, scene }: State,
  itemAtTile: ItemAtTile
) => {
  const tile = uiState.mouse.position.tile;
  const startAnchor =
    itemAtTile?.type === 'ITEM' ? { itemId: itemAtTile.id } : { tile };

  // Create a connector but don't finalize it yet.
  const newConnector = createConnectorAt(scene.colors[0].id, itemAtTile, tile);

  // Open one history entry for the entire create→drag→commit lifecycle.
  // commitDragTransaction is called on the second click (or mouseup in drag mode).
  scene.beginDragTransaction();
  scene.createConnector(newConnector);

  uiState.actions.setMode({
    type: 'CONNECTOR',
    showCursor: true,
    id: newConnector.id,
    startAnchor,
    isConnecting: true,
    returnToCursor:
      uiState.mode.type === 'CONNECTOR'
        ? uiState.mode.returnToCursor
        : undefined
  });
};

// Click mode, second click: complete the connection (or reset if the
// in-progress connector vanished).
const handleClickSecond = (
  { uiState, scene }: State,
  itemAtTile: ItemAtTile
) => {
  const currentMode = uiState.mode;
  if (currentMode.type !== 'CONNECTOR' || !currentMode.id) return;

  // Try to find the connector - it might not exist.
  const connector = (scene.currentView.connectors ?? []).find(
    (c) => c.id === currentMode.id
  );

  // If connector doesn't exist, reset mode and return.
  if (!connector) {
    scene.commitDragTransaction();
    uiState.actions.setMode({
      type: 'CONNECTOR',
      showCursor: true,
      id: null,
      startAnchor: undefined,
      isConnecting: false
    });
    return;
  }

  // Update the second anchor to the click position.
  const newConnector = produce(connector, (draft) => {
    draft.anchors[1] = makeAnchor(itemAtTile, uiState.mouse.position.tile);
  });

  scene.updateConnector(currentMode.id, newConnector);
  scene.commitDragTransaction();

  if (currentMode.returnToCursor) {
    uiState.actions.setMode({
      type: 'CURSOR',
      showCursor: true,
      mousedownItem: null
    });
  } else {
    uiState.actions.setMode({
      type: 'CONNECTOR',
      showCursor: true,
      id: null,
      startAnchor: undefined,
      isConnecting: false
    });
  }
};

// Drag mode: create the connector and let mouseup commit it.
const handleDragStart = (
  { uiState, scene }: State,
  itemAtTile: ItemAtTile
) => {
  const newConnector = createConnectorAt(
    scene.colors[0].id,
    itemAtTile,
    uiState.mouse.position.tile
  );

  // Drag-mode: open one history entry for the whole press→drag→release.
  scene.beginDragTransaction();
  scene.createConnector(newConnector);

  uiState.actions.setMode({
    type: 'CONNECTOR',
    showCursor: true,
    id: newConnector.id
  });
};

export const Connector: ModeActions = {
  entry: () => {
    setWindowCursor('crosshair');
  },
  exit: () => {
    setWindowCursor('default');
  },
  mousemove: ({ uiState, scene }) => {
    if (
      uiState.mode.type !== 'CONNECTOR' ||
      !uiState.mode.id ||
      !hasMovedTile(uiState.mouse)
    )
      return;

    // TypeScript type guard - we know mode is CONNECTOR type here
    const connectorMode = uiState.mode;

    // Only update connector position in drag mode or when connecting in click mode
    if (
      uiState.connectorInteractionMode === 'drag' ||
      connectorMode.isConnecting
    ) {
      // Try to find the connector - it might not exist yet
      const connectorItem = (scene.currentView.connectors ?? []).find(
        (c) => c.id === connectorMode.id
      );

      // If connector doesn't exist yet, return early
      if (!connectorItem) {
        return;
      }

      const itemAtTile = getItemAtTile({
        tile: uiState.mouse.position.tile,
        scene
      });

      if (itemAtTile?.type === 'ITEM') {
        const newConnector = produce(connectorItem, (draft) => {
          draft.anchors[1] = { id: generateId(), ref: { item: itemAtTile.id } };
        });

        scene.updateConnector(connectorMode.id!, newConnector);
      } else {
        const newConnector = produce(connectorItem, (draft) => {
          draft.anchors[1] = {
            id: generateId(),
            ref: { tile: uiState.mouse.position.tile }
          };
        });

        scene.updateConnector(connectorMode.id!, newConnector);
      }
    }
  },
  mousedown: (state) => {
    const { uiState, scene, isRendererInteraction } = state;
    if (uiState.mode.type !== 'CONNECTOR' || !isRendererInteraction) return;

    const itemAtTile = getItemAtTile({
      tile: uiState.mouse.position.tile,
      scene
    });

    if (uiState.connectorInteractionMode !== 'click') {
      // Drag mode: original behavior.
      handleDragStart(state, itemAtTile);
      return;
    }

    // Click mode: first click arms the connection, second click completes it.
    if (!uiState.mode.startAnchor) {
      handleClickFirst(state, itemAtTile);
    } else {
      handleClickSecond(state, itemAtTile);
    }
  },
  mouseup: ({ uiState, scene }) => {
    if (uiState.mode.type !== 'CONNECTOR' || !uiState.mode.id) return;

    // Only handle mouseup for drag mode
    if (uiState.connectorInteractionMode === 'drag') {
      scene.commitDragTransaction();
      if (uiState.mode.type === 'CONNECTOR' && uiState.mode.returnToCursor) {
        uiState.actions.setMode({
          type: 'CURSOR',
          showCursor: true,
          mousedownItem: null
        });
      } else {
        uiState.actions.setMode({
          type: 'CONNECTOR',
          showCursor: true,
          id: null
        });
      }
    }
    // Click mode handles completion in mousedown (second click)
  }
};
