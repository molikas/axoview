import { ItemReference } from 'src/types';
import { getConnectorWaypointRefs } from 'src/utils/connectorSelection';

// Minimal scene shape needed to enumerate selectable refs — kept structural so
// both useInteractionManager (Ctrl+A) and the canvas context menu (Select all)
// can pass their `useScene()` result without coupling to its full type.
interface SelectableScene {
  items: { id: string }[];
  rectangles: { id: string }[];
  textBoxes: { id: string }[];
  connectors: Parameters<typeof getConnectorWaypointRefs>[0][];
}

// An item is interactable only if its layer is unlocked AND visible.
// `visibleIds.size === 0` is the "no layers configured" fallback (matches the
// SceneLayers render guards + onContextMenu). UX §4.3.
export const makeInteractableCheck =
  (lockedIds: ReadonlySet<string>, visibleIds: ReadonlySet<string>) =>
  (id: string) =>
    !lockedIds.has(id) && (visibleIds.size === 0 || visibleIds.has(id));

// Every visible + unlocked item in the active view, including connector
// waypoints (which aren't free — see getConnectorWaypointRefs). The single
// source of truth for Ctrl+A and the context menu's "Select all" so the two
// can't drift (ADR 0006 §3 / UX §4.3-§4.4).
export const collectSelectableRefs = (
  scene: SelectableScene,
  lockedIds: ReadonlySet<string>,
  visibleIds: ReadonlySet<string>
): ItemReference[] => {
  const isInteractable = makeInteractableCheck(lockedIds, visibleIds);
  const refs: ItemReference[] = [];
  for (const item of scene.items) {
    if (isInteractable(item.id)) refs.push({ type: 'ITEM', id: item.id });
  }
  for (const r of scene.rectangles) {
    if (isInteractable(r.id)) refs.push({ type: 'RECTANGLE', id: r.id });
  }
  for (const tb of scene.textBoxes) {
    if (isInteractable(tb.id)) refs.push({ type: 'TEXTBOX', id: tb.id });
  }
  for (const c of scene.connectors) {
    if (!isInteractable(c.id)) continue;
    refs.push({ type: 'CONNECTOR', id: c.id });
    refs.push(...getConnectorWaypointRefs(c));
  }
  return refs;
};
