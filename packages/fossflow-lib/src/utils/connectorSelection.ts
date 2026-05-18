import type { Connector, ItemReference } from 'src/types';

/**
 * Refs the user thinks of as "things they selected". CONNECTOR_ANCHOR refs
 * (free-floating connector waypoints) come along for the ride with their
 * parent connector — they're an implementation detail of how drag/delete keep
 * the path coherent (see getConnectorWaypointRefs). They should not inflate
 * the "N selected" badge or the LassoLayerBar count, and they cannot be
 * independently assigned to a layer.
 */
export const isUserFacingRef = (ref: ItemReference): boolean =>
  ref.type !== 'CONNECTOR_ANCHOR';

export const countUserFacingRefs = (refs: ItemReference[]): number =>
  refs.reduce((n, r) => (isUserFacingRef(r) ? n + 1 : n), 0);

export const filterUserFacingRefs = (refs: ItemReference[]): ItemReference[] =>
  refs.filter(isUserFacingRef);

/**
 * Returns the CONNECTOR_ANCHOR refs that must accompany a CONNECTOR in any
 * selection. These are the **free-floating waypoint anchors** — anchors in
 * the middle of the path whose `ref.tile` is an absolute tile (not bound to
 * a node). Endpoint anchors are skipped because they ref a node and move
 * automatically with it; tile-bound waypoints don't.
 *
 * Selection builders that include connectors MUST call this and add the
 * returned refs to their selection, otherwise:
 *  - Bulk-drag pinches the path (endpoints move with their nodes, waypoints
 *    stay put)
 *  - Bulk-delete leaves orphaned anchors when the connector itself goes
 *
 * Used by Lasso.getItemsInBounds, FreehandLasso.getItemsInFreehandBounds,
 * and useInteractionManager's Ctrl+A handler. ADR-0006.
 */
export const getConnectorWaypointRefs = (
  connector: Connector
): ItemReference[] => {
  if (!connector.anchors || connector.anchors.length <= 2) return [];
  const refs: ItemReference[] = [];
  for (let i = 1; i < connector.anchors.length - 1; i += 1) {
    const a = connector.anchors[i];
    if (a.ref?.tile) {
      refs.push({ type: 'CONNECTOR_ANCHOR', id: a.id });
    }
  }
  return refs;
};
