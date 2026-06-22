/**
 * Unit tests for the connector-selection helpers.
 *
 * Three small utilities encode the multi-select-with-connectors contract from
 * ADR-0006:
 *   - getConnectorWaypointRefs: what extra refs accompany a CONNECTOR
 *   - countUserFacingRefs:      what counts as "an item the user selected"
 *   - filterUserFacingRefs:     which refs can be assigned to a layer
 *
 * These three call sites all share the same risk: when a future contributor
 * adds a new selection path (e.g. "select-all-of-type-X", paste-into-selection),
 * they MUST consult these helpers — otherwise the symptoms creep back in
 * (pinched paths on drag, "N + waypoints" inflated badge counts, broken
 * "Assign layer" on connector selections). The tests pin the contract so the
 * helper signatures can't drift silently.
 */

import {
  getConnectorWaypointRefs,
  getConnectorMovementAnchorRefs,
  countUserFacingRefs,
  filterUserFacingRefs,
  isUserFacingRef
} from '../connectorSelection';
import type { Connector, ItemReference } from 'src/types';

const mkConnector = (
  anchors: Array<{
    id: string;
    ref: { item?: string; tile?: { x: number; y: number } };
  }>
): Connector =>
  ({
    id: 'c1',
    anchors
  }) as unknown as Connector;

describe('getConnectorWaypointRefs', () => {
  it('returns [] when connector has only two endpoints (no waypoints)', () => {
    const c = mkConnector([
      { id: 'e0', ref: { item: 'n1' } },
      { id: 'e1', ref: { item: 'n2' } }
    ]);
    expect(getConnectorWaypointRefs(c)).toEqual([]);
  });

  it('returns CONNECTOR_ANCHOR refs for tile-bound middle anchors only', () => {
    const c = mkConnector([
      { id: 'e0', ref: { item: 'n1' } },
      { id: 'w1', ref: { tile: { x: 3, y: 5 } } },
      { id: 'w2', ref: { tile: { x: 4, y: 5 } } },
      { id: 'e1', ref: { item: 'n2' } }
    ]);
    expect(getConnectorWaypointRefs(c)).toEqual([
      { type: 'CONNECTOR_ANCHOR', id: 'w1' },
      { type: 'CONNECTOR_ANCHOR', id: 'w2' }
    ]);
  });

  it('skips middle anchors that lack ref.tile (e.g. anchor-attached)', () => {
    // Defensive: middle anchors can theoretically ref another anchor (chained
    // attachment) — those move with their parent and don't need their own ref.
    const c = mkConnector([
      { id: 'e0', ref: { item: 'n1' } },
      { id: 'w1', ref: { tile: { x: 3, y: 5 } } },
      { id: 'w2', ref: {} as any },
      { id: 'e1', ref: { item: 'n2' } }
    ]);
    expect(getConnectorWaypointRefs(c)).toEqual([
      { type: 'CONNECTOR_ANCHOR', id: 'w1' }
    ]);
  });

  it('handles empty / undefined anchors safely', () => {
    expect(getConnectorWaypointRefs(mkConnector([]))).toEqual([]);
    expect(
      getConnectorWaypointRefs({ id: 'x', anchors: undefined } as unknown as Connector)
    ).toEqual([]);
  });

  it('never returns endpoint anchors (even when they have ref.tile)', () => {
    // Floating endpoints (no node ref) still ref by tile. The selection
    // contract treats them as endpoints — they should NOT appear as
    // waypoint refs even if their tile-bound representation matches the
    // shape getConnectorWaypointRefs filters by.
    const c = mkConnector([
      { id: 'e0', ref: { tile: { x: 1, y: 1 } } },
      { id: 'w1', ref: { tile: { x: 2, y: 2 } } },
      { id: 'e1', ref: { tile: { x: 3, y: 3 } } }
    ]);
    expect(getConnectorWaypointRefs(c)).toEqual([
      { type: 'CONNECTOR_ANCHOR', id: 'w1' }
    ]);
  });
});

describe('getConnectorMovementAnchorRefs', () => {
  // The movement superset (ADR 0006 addendum #2): unlike the delete-safe
  // waypoint helper, this INCLUDES free-floating (tile-bound) endpoints so a
  // lasso-selected connector drags rigidly. Splice-safety is upheld elsewhere
  // (endpoints only travel with their parent CONNECTOR; delete removes the
  // connector wholesale).

  it('returns [] for a fully node-bound connector (no tile anchors)', () => {
    const c = mkConnector([
      { id: 'e0', ref: { item: 'n1' } },
      { id: 'e1', ref: { item: 'n2' } }
    ]);
    expect(getConnectorMovementAnchorRefs(c)).toEqual([]);
  });

  it('returns middle waypoints only when endpoints are node-bound (matches waypoint helper)', () => {
    const c = mkConnector([
      { id: 'e0', ref: { item: 'n1' } },
      { id: 'w1', ref: { tile: { x: 3, y: 5 } } },
      { id: 'e1', ref: { item: 'n2' } }
    ]);
    expect(getConnectorMovementAnchorRefs(c)).toEqual([
      { type: 'CONNECTOR_ANCHOR', id: 'w1' }
    ]);
  });

  it('INCLUDES tile-bound endpoints — the difference from getConnectorWaypointRefs', () => {
    const c = mkConnector([
      { id: 'e0', ref: { tile: { x: 1, y: 1 } } },
      { id: 'w1', ref: { tile: { x: 2, y: 2 } } },
      { id: 'e1', ref: { tile: { x: 3, y: 3 } } }
    ]);
    // All three tile-bound anchors come along for rigid movement…
    expect(getConnectorMovementAnchorRefs(c)).toEqual([
      { type: 'CONNECTOR_ANCHOR', id: 'e0' },
      { type: 'CONNECTOR_ANCHOR', id: 'w1' },
      { type: 'CONNECTOR_ANCHOR', id: 'e1' }
    ]);
    // …whereas the delete-safe helper still excludes the endpoints.
    expect(getConnectorWaypointRefs(c)).toEqual([
      { type: 'CONNECTOR_ANCHOR', id: 'w1' }
    ]);
  });

  it('handles empty / undefined / single-anchor connectors safely', () => {
    expect(getConnectorMovementAnchorRefs(mkConnector([]))).toEqual([]);
    expect(
      getConnectorMovementAnchorRefs({
        id: 'x',
        anchors: undefined
      } as unknown as Connector)
    ).toEqual([]);
    expect(
      getConnectorMovementAnchorRefs(
        mkConnector([{ id: 'e0', ref: { tile: { x: 1, y: 1 } } }])
      )
    ).toEqual([]);
  });
});

describe('user-facing-ref helpers', () => {
  const node: ItemReference = { type: 'ITEM', id: 'n1' };
  const rect: ItemReference = { type: 'RECTANGLE', id: 'r1' };
  const text: ItemReference = { type: 'TEXTBOX', id: 't1' };
  const conn: ItemReference = { type: 'CONNECTOR', id: 'c1' };
  const wp: ItemReference = { type: 'CONNECTOR_ANCHOR', id: 'w1' };

  it('isUserFacingRef: CONNECTOR_ANCHOR is implementation detail, others count', () => {
    expect(isUserFacingRef(node)).toBe(true);
    expect(isUserFacingRef(rect)).toBe(true);
    expect(isUserFacingRef(text)).toBe(true);
    expect(isUserFacingRef(conn)).toBe(true);
    expect(isUserFacingRef(wp)).toBe(false);
  });

  it('countUserFacingRefs: connector + N waypoints reads as 1 item', () => {
    // The user-visible MQA #8 / #9 ask: a single connector with waypoints
    // should not inflate the "N selected" badge.
    expect(countUserFacingRefs([conn, wp, wp])).toBe(1);
    expect(countUserFacingRefs([node, conn, wp])).toBe(2);
    expect(countUserFacingRefs([])).toBe(0);
    // Waypoints-only (lasso captured the middle of a connector without its
    // endpoints) currently counts as 0 — the simpler contract. The Delete
    // path still removes them; only the badge / LassoLayerBar count is muted.
    // Acceptable trade-off because a parent-aware count would need scene data.
    expect(countUserFacingRefs([wp, wp])).toBe(0);
  });

  it('filterUserFacingRefs: drops waypoint refs (for assignLayerToItems)', () => {
    expect(filterUserFacingRefs([conn, wp, node])).toEqual([conn, node]);
    expect(filterUserFacingRefs([wp])).toEqual([]);
  });
});
