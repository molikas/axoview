import { produce } from 'immer';
import {
  ConnectorAnchor,
  SceneConnector,
  ModeActions,
  ModeActionsAction,
  Coords,
  View,
  ItemReference
} from 'src/types';
import {
  getItemAtTile,
  hasMovedTile,
  getAnchorAtTile,
  getItemByIdOrThrow,
  generateId,
  CoordsUtils,
  getAnchorTile,
  connectorPathTileToGlobal,
  setWindowCursor
} from 'src/utils';
import { getConnectorWaypointRefs } from 'src/utils/connectorSelection';

// Set true by mousedown when Alt+click splices a waypoint, consumed by the
// subsequent mouseup so it bypasses its selection-clearing branches (the
// click was already handled; the selection should be preserved). Module-level
// instead of mode-state to avoid widening CursorMode for a transient flag.
let altSpliceConsumed = false;
import { useScene } from 'src/hooks/useScene';

// Returns the effective tile for an anchor for hit-detection purposes.
// For node-attached endpoints (first/last anchor with ref.item), uses the path junction tile
// so the handle is detectable at the same position it's visually rendered (not under the node).
const getAnchorHitTile = (
  anchor: ConnectorAnchor,
  index: number,
  totalAnchors: number,
  connector: SceneConnector,
  view: View
): Coords => {
  const isEndpoint = index === 0 || index === totalAnchors - 1;
  if (isEndpoint && anchor.ref.item && connector.path?.tiles?.length) {
    const pathTile =
      index === 0
        ? connector.path.tiles[0]
        : connector.path.tiles[connector.path.tiles.length - 1];
    return connectorPathTileToGlobal(pathTile, connector.path.rectangle.from);
  }
  return getAnchorTile(anchor, view);
};

const getAnchorOrdering = (
  anchor: ConnectorAnchor,
  connector: SceneConnector,
  view: View
) => {
  const anchorTile = getAnchorTile(anchor, view);
  const index = connector.path.tiles.findIndex((pathTile) => {
    const globalTile = connectorPathTileToGlobal(
      pathTile,
      connector.path.rectangle.from
    );
    return CoordsUtils.isEqual(globalTile, anchorTile);
  });

  if (index === -1) {
    throw new Error(
      `Could not calculate ordering index of anchor [anchorId: ${anchor.id}]`
    );
  }

  return index;
};

const getAnchor = (
  connectorId: string,
  tile: Coords,
  scene: ReturnType<typeof useScene>
) => {
  // hitConnectors includes merged scene path data needed for getAnchorOrdering.
  const connector = getItemByIdOrThrow(scene.hitConnectors, connectorId).value;
  const anchor = getAnchorAtTile(tile, connector.anchors);

  if (!anchor) {
    const newAnchor: ConnectorAnchor = {
      id: generateId(),
      ref: { tile }
    };

    const orderedAnchors = [...connector.anchors, newAnchor]
      .map((anch) => {
        return {
          ...anch,
          ordering: getAnchorOrdering(anch, connector, scene.currentView)
        };
      })
      .sort((a, b) => {
        return a.ordering - b.ordering;
      });

    scene.updateConnector(connector.id, { anchors: orderedAnchors });
    return newAnchor;
  }

  return anchor;
};

const mousedown: ModeActionsAction = ({
  uiState,
  scene,
  isRendererInteraction,
  isItemInteractable
}) => {
  if (uiState.mode.type !== 'CURSOR' || !isRendererInteraction) return;

  // P2: When a connector is selected, its endpoint anchors (attached to nodes) sit on
  // the same tile as the node. Normally getItemAtTile would return the node first, making
  // the endpoint unreachable. Check for selected connector anchors before the generic lookup.
  const itemControls = uiState.itemControls;
  if (itemControls && itemControls.type === 'CONNECTOR') {
    const selectedConnector = scene.hitConnectors.find(
      (c) => c.id === itemControls.id
    );
    if (selectedConnector) {
      const totalAnchors = selectedConnector.anchors.length;
      let clickedIndex = -1;
      // Prefer DOM-driven anchor identification (set by useInteractionManager
      // from data-anchor-id on the hit element) — the visible waypoint + its
      // hit ring extends beyond one tile, so a tile-equality check rejects
      // valid clicks near tile boundaries or at low zoom. Fall back to the
      // tile match for non-DOM hits (e.g. clicking on the connector path
      // body to add a waypoint, or in tests that bypass the overlay).
      const targetAnchorId = uiState.mouse.targetAnchorId;
      const clickedAnchor = selectedConnector.anchors.find((anchor, index) => {
        if (targetAnchorId) {
          if (anchor.id === targetAnchorId) {
            clickedIndex = index;
            return true;
          }
          return false;
        }
        const hitTile = getAnchorHitTile(
          anchor,
          index,
          totalAnchors,
          selectedConnector,
          scene.currentView
        );
        if (CoordsUtils.isEqual(hitTile, uiState.mouse.position.tile)) {
          clickedIndex = index;
          return true;
        }
        return false;
      });
      if (clickedAnchor) {
        const isEndpoint =
          clickedIndex === 0 || clickedIndex === totalAnchors - 1;
        if (isEndpoint) {
          // Endpoint: enter click-to-reconnect mode. Much more reliable than drag
          // on a discrete tile grid, especially with large block node icons.
          uiState.actions.setMode({
            type: 'RECONNECT_ANCHOR',
            showCursor: true,
            connectorId: selectedConnector.id,
            anchorId: clickedAnchor.id,
            anchorIndex: clickedIndex
          });
        } else {
          // Waypoint: Alt+click removes it; plain click starts a drag.
          // Removal is the direct gesture (no menu) because right-click is
          // already overloaded by rightClickPan + NodeActionBar. The
          // connector's first/last anchors stay intact — only middle
          // (free-floating) waypoints can be removed this way.
          const altHeld = uiState.mouse.modifiers?.alt;
          if (altHeld) {
            const nextAnchors = selectedConnector.anchors.filter(
              (a) => a.id !== clickedAnchor.id
            );
            scene.updateConnector(selectedConnector.id, {
              anchors: nextAnchors
            });
            // Flag this for the subsequent mouseup so it doesn't run the
            // empty-canvas-click branch and clear the selection.
            altSpliceConsumed = true;
            uiState.actions.setMode(
              produce(uiState.mode, (draft) => {
                draft.mousedownItem = null;
                draft.mousedownHandled = true;
              })
            );
          } else {
            uiState.actions.setMode(
              produce(uiState.mode, (draft) => {
                draft.mousedownItem = {
                  type: 'CONNECTOR_ANCHOR',
                  id: clickedAnchor.id
                };
                draft.mousedownHandled = true;
              })
            );
          }
        }
        return;
      }
    }
  }

  const itemAtTile = getItemAtTile({
    tile: uiState.mouse.position.tile,
    scene
  });

  // Items on locked or hidden layers are treated as background — not
  // selectable, not draggable (mqa-results.md #2). isItemInteractable may be
  // undefined in tests that bypass the State type via `as any`. The non-null
  // check on itemAtTile is critical — calling isItemInteractable(null) would
  // throw and silently kill the cursor→lasso transition for empty-canvas drag.
  if (
    itemAtTile &&
    (!isItemInteractable || isItemInteractable(itemAtTile))
  ) {
    uiState.actions.setMode(
      produce(uiState.mode, (draft) => {
        draft.mousedownItem = itemAtTile;
        draft.mousedownHandled = true;
      })
    );
  } else {
    uiState.actions.setMode(
      produce(uiState.mode, (draft) => {
        draft.mousedownItem = null;
        draft.mousedownHandled = true;
      })
    );

    uiState.actions.setItemControls(null);
  }
};

export const Cursor: ModeActions = {
  entry: (state) => {
    const { uiState } = state;

    if (uiState.mode.type !== 'CURSOR') return;

    if (uiState.mode.mousedownItem) {
      mousedown(state);
    }
  },
  mousemove: ({ scene, uiState }) => {
    if (uiState.mode.type !== 'CURSOR') return;

    let item = uiState.mode.mousedownItem;

    // Hover cursor (no mousedown): still use hasMovedTile to avoid redundant work
    if (!item && !uiState.mouse.mousedown) {
      if (hasMovedTile(uiState.mouse)) {
        // If a connector is selected, show grab cursor when hovering over any of its anchors
        const hoverControls = uiState.itemControls;
        if (hoverControls && hoverControls.type === 'CONNECTOR') {
          const hoveredConnector = scene.hitConnectors.find(
            (c) => c.id === hoverControls.id
          );
          if (hoveredConnector) {
            const isOverAnchor = hoveredConnector.anchors.some(
              (anchor, index) => {
                const hitTile = getAnchorHitTile(
                  anchor,
                  index,
                  hoveredConnector.anchors.length,
                  hoveredConnector,
                  scene.currentView
                );
                return CoordsUtils.isEqual(
                  hitTile,
                  uiState.mouse.position.tile
                );
              }
            );
            if (isOverAnchor) {
              setWindowCursor('grab');
              return;
            }
          }
        }
        const hoverItem = getItemAtTile({
          tile: uiState.mouse.position.tile,
          scene
        });
        setWindowCursor(hoverItem ? 'pointer' : 'default');
      }
      return;
    }

    // Drag detection: use position vs mousedown directly instead of stale delta.
    // hasMovedTile relies on delta which is one RAF frame behind, causing a half-tile delay.
    if (!uiState.mouse.mousedown) return;
    const hasDragged = !CoordsUtils.isEqual(
      uiState.mouse.position.tile,
      uiState.mouse.mousedown.tile
    );
    if (!hasDragged) return;

    if (item?.type === 'CONNECTOR' && uiState.mouse.mousedown) {
      const anchor = getAnchor(item.id, uiState.mouse.mousedown.tile, scene);

      item = {
        type: 'CONNECTOR_ANCHOR',
        id: anchor.id
      };
    }

    if (item) {
      // Multi-select drag: if the user starts dragging an item that's part of
      // the persistent multi-selection, drag the whole selection together
      // (ADR-0006). Otherwise drag just this item (and the selection collapses
      // to it via the mouseup path).
      const selectedIds = uiState.selectedIds ?? [];
      const inMultiSelect =
        selectedIds.length > 1 &&
        selectedIds.some(
          (ref) => ref.type === item?.type && ref.id === item?.id
        );
      const dragItems: ItemReference[] = inMultiSelect ? selectedIds : [item];

      const initialTiles: Record<string, Coords> = {};
      const initialRectangles: Record<string, { from: Coords; to: Coords }> =
        {};
      for (const dragItem of dragItems) {
        if (dragItem.type === 'ITEM') {
          try {
            initialTiles[dragItem.id] = getItemByIdOrThrow(
              scene.items,
              dragItem.id
            ).value.tile;
          } catch {}
        } else if (dragItem.type === 'TEXTBOX') {
          try {
            initialTiles[dragItem.id] = getItemByIdOrThrow(
              scene.textBoxes,
              dragItem.id
            ).value.tile;
          } catch {}
        } else if (dragItem.type === 'RECTANGLE') {
          try {
            const r = getItemByIdOrThrow(scene.rectangles, dragItem.id).value;
            initialRectangles[dragItem.id] = { from: r.from, to: r.to };
          } catch {}
        } else if (dragItem.type === 'CONNECTOR_ANCHOR') {
          // Mirror Lasso.mousemove's anchor-seeding (modes/Lasso.ts). Without
          // this entry, DragItems treats the anchor as an "anchor reconnect"
          // (no initialTiles → re-anchor to cursor tile every frame). That's
          // the inversion + pinched-path symptom when Ctrl+A includes
          // free-floating waypoints. ADR-0006.
          for (const connector of scene.connectors) {
            const anchor = connector.anchors.find((a) => a.id === dragItem.id);
            if (anchor?.ref?.tile) {
              initialTiles[dragItem.id] = anchor.ref.tile;
              break;
            }
          }
        }
      }
      uiState.actions.setMode({
        type: 'DRAG_ITEMS',
        showCursor: true,
        items: dragItems,
        initialTiles,
        initialRectangles
      });
    } else {
      // Empty-area drag → start lasso selection (only when mousedown was properly handled)
      if (uiState.mouse.mousedown && uiState.mode.mousedownHandled) {
        uiState.actions.setMode({
          type: 'LASSO',
          showCursor: true,
          selection: null,
          isDragging: false
        });
      }
    }
  },
  mousedown,
  mouseup: ({ uiState, scene, isRendererInteraction }) => {
    if (uiState.mode.type !== 'CURSOR' || !isRendererInteraction) return;

    // Alt+click waypoint splice ran in mousedown — bypass all selection logic.
    // Just reset the mousedown bookkeeping; the connector stays selected.
    if (altSpliceConsumed) {
      altSpliceConsumed = false;
      uiState.actions.setMode(
        produce(uiState.mode, (draft) => {
          draft.mousedownItem = null;
          draft.mousedownHandled = false;
        })
      );
      return;
    }

    // MQA #16: drag started outside the canvas (e.g. text drag-select inside a
    // properties-panel input that ended over the canvas). No canvas-side
    // mousedown was tracked and no item was registered. Ignore the mouseup so
    // the panel doesn't dismiss when the user just selected text past its edge.
    if (!uiState.mouse.mousedown && !uiState.mode.mousedownHandled) {
      uiState.actions.setMode(
        produce(uiState.mode, (draft) => {
          draft.mousedownItem = null;
          draft.mousedownHandled = false;
        })
      );
      return;
    }

    const hasMoved = uiState.mouse.mousedown && hasMovedTile(uiState.mouse);

    if (uiState.mode.mousedownItem && !hasMoved) {
      const clicked = uiState.mode.mousedownItem;
      const ctrlHeld =
        uiState.mouse.modifiers?.ctrl || uiState.mouse.modifiers?.meta;
      // CONNECTOR-on-tile needs the tile for the panel — keep using
      // setItemControls (which mirrors into selectedIds internally).
      // For all other types, route through the multi-select gesture path:
      // Ctrl+click → toggle, plain click → replace.
      // Optional-call the new actions so mode-action unit tests that mock a
      // minimal uiState.actions continue to work (ADR-0006).
      if (clicked.type === 'CONNECTOR') {
        if (ctrlHeld && uiState.actions.setSelectedIds) {
          // Ctrl+click a connector: toggle the connector AND its tile-bound
          // waypoint anchors as one group — waypoints can't be independently
          // selected via click (they're not hit-tested), so they must
          // accompany the connector to remain consistent with Ctrl+A and
          // lasso semantics. ADR-0006.
          const connector = scene.connectors.find(
            (c: { id: string }) => c.id === clicked.id
          );
          const waypointRefs = connector
            ? getConnectorWaypointRefs(connector)
            : [];
          const groupIds = new Set<string>([
            clicked.id,
            ...waypointRefs.map((r) => r.id)
          ]);
          const current = uiState.selectedIds ?? [];
          const isInSelection = current.some(
            (r) => r.type === 'CONNECTOR' && r.id === clicked.id
          );
          const next: ItemReference[] = isInSelection
            ? current.filter((r) => !groupIds.has(r.id))
            : [
                ...current,
                { type: 'CONNECTOR' as const, id: clicked.id },
                ...waypointRefs
              ];
          uiState.actions.setSelectedIds(next);
        } else {
          uiState.actions.setItemControls({
            type: 'CONNECTOR',
            id: clicked.id,
            tile: uiState.mouse.position.tile
          });
        }
      } else {
        const ref: ItemReference = { type: clicked.type, id: clicked.id };
        if (ctrlHeld && uiState.actions.toggleSelected) {
          uiState.actions.toggleSelected(ref);
        } else if (uiState.actions.setSelectedIds) {
          uiState.actions.setSelectedIds([ref]);
        } else {
          // Pre-ADR-0006 test mocks — fall back to the single-item path.
          uiState.actions.setItemControls({ type: clicked.type, id: clicked.id });
        }
      }
    } else if (!hasMoved && uiState.mode.mousedownHandled) {
      // Plain left-click on empty canvas — clear the persistent selection.
      // Adding items is handled by double-click (QuickAddNodePopover).
      (uiState.actions.clearSelection ?? (() => uiState.actions.setItemControls(null)))();
    } else {
      (uiState.actions.clearSelection ?? (() => uiState.actions.setItemControls(null)))();
    }

    uiState.actions.setMode(
      produce(uiState.mode, (draft) => {
        draft.mousedownItem = null;
        draft.mousedownHandled = false;
      })
    );
  }
};
