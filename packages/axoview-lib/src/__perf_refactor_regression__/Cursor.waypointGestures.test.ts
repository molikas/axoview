/**
 * REGRESSION — Cursor mode handler: waypoint Alt+click + Ctrl+click connector
 *
 * Covers the user-facing gestures added in MQA #8/#9 (ADR-0006):
 *
 *  - Alt+click on a waypoint splices it from the parent connector AND must
 *    preserve the connector selection on the following mouseup. The bug we
 *    fixed: a naive splice in mousedown caused mouseup's empty-canvas-click
 *    branch to clearSelection because mousedownItem was null and
 *    mousedownHandled was true.
 *
 *  - Ctrl+click on a connector toggles the connector AND its tile-bound
 *    waypoint anchors as one group — waypoints aren't independently clickable
 *    via the canvas, so they must accompany their connector for the selection
 *    to be coherent with Ctrl+A and lasso behavior.
 *
 * These tests pin the contract at the mode-action level. The integration
 * (mouse-event-loop + store + UI) is exercised manually; this file is the
 * safety net against silent regressions in Cursor.ts.
 */

import { Cursor } from 'src/interaction/modes/Cursor';

jest.mock('src/utils', () => ({
  getItemAtTile: jest.fn(() => null),
  hasMovedTile: jest.fn(() => false),
  getAnchorAtTile: jest.fn(() => null),
  getItemByIdOrThrow: jest.fn((arr: any[], id: string) => {
    const found = (arr as any[]).find((item: any) => item.id === id);
    if (!found) throw new Error(`Not found: ${id}`);
    return { index: 0, value: found };
  }),
  generateId: jest.fn(() => 'new-id'),
  CoordsUtils: {
    zero: () => ({ x: 0, y: 0 }),
    isEqual: (a: any, b: any) => a.x === b.x && a.y === b.y,
    subtract: (a: any, b: any) => ({ x: a.x - b.x, y: a.y - b.y })
  },
  getAnchorTile: jest.fn((anchor: any) => anchor.ref?.tile ?? { x: 0, y: 0 }),
  connectorPathTileToGlobal: jest.fn((tile: any) => tile),
  setWindowCursor: jest.fn()
}));

jest.mock('src/hooks/useScene', () => ({ useScene: jest.fn() }));

const conn = {
  id: 'c1',
  anchors: [
    { id: 'e0', ref: { item: 'n1' } },
    { id: 'w1', ref: { tile: { x: 5, y: 5 } } },
    { id: 'w2', ref: { tile: { x: 6, y: 5 } } },
    { id: 'e1', ref: { item: 'n2' } }
  ],
  path: { tiles: [{ x: 0, y: 0 }], rectangle: { from: { x: 0, y: 0 } } }
};

function makeUiState(overrides: any = {}) {
  return {
    mode: overrides.mode ?? {
      type: 'CURSOR',
      showCursor: true,
      mousedownItem: null,
      mousedownHandled: false
    },
    mouse: overrides.mouse ?? {
      position: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
      mousedown: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
      delta: null,
      modifiers: { ctrl: false, shift: false, meta: false, alt: false },
      targetAnchorId: null
    },
    itemControls: overrides.itemControls ?? null,
    selectedIds: overrides.selectedIds ?? [],
    actions: overrides.actions ?? {
      setMode: jest.fn(),
      setItemControls: jest.fn(),
      setSelectedIds: jest.fn(),
      toggleSelected: jest.fn(),
      clearSelection: jest.fn()
    }
  };
}

function makeScene(connectors: any[] = [conn]) {
  return {
    connectors,
    items: [],
    rectangles: [],
    textBoxes: [],
    hitConnectors: connectors,
    currentView: { items: [], connectors },
    updateConnector: jest.fn()
  };
}

describe('Cursor — Alt+click waypoint removes anchor (ADR-0006)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('splices the clicked waypoint from the connector', () => {
    const scene = makeScene();
    const uiState = makeUiState({
      itemControls: { type: 'CONNECTOR', id: 'c1' },
      mouse: {
        position: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
        mousedown: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
        delta: null,
        modifiers: { ctrl: false, shift: false, meta: false, alt: true },
        targetAnchorId: 'w1'
      }
    });

    Cursor.mousedown!({ uiState, scene, isRendererInteraction: true } as any);

    expect(scene.updateConnector).toHaveBeenCalledWith('c1', {
      anchors: [
        { id: 'e0', ref: { item: 'n1' } },
        { id: 'w2', ref: { tile: { x: 6, y: 5 } } },
        { id: 'e1', ref: { item: 'n2' } }
      ]
    });
  });

  it('subsequent mouseup keeps the connector selected (no spurious clearSelection)', () => {
    const scene = makeScene();
    const uiState = makeUiState({
      itemControls: { type: 'CONNECTOR', id: 'c1' },
      mouse: {
        position: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
        mousedown: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
        delta: null,
        modifiers: { ctrl: false, shift: false, meta: false, alt: true },
        targetAnchorId: 'w1'
      }
    });

    // mousedown sets the altSpliceConsumed flag (module-local) and clears
    // mousedown bookkeeping with mousedownHandled=true.
    Cursor.mousedown!({ uiState, scene, isRendererInteraction: true } as any);

    // Reset action mocks so we can assert on what mouseup does *after* the splice.
    (uiState.actions.clearSelection as jest.Mock).mockClear();
    (uiState.actions.setItemControls as jest.Mock).mockClear();
    (uiState.actions.setSelectedIds as jest.Mock).mockClear();

    // Compose post-mousedown state: setMode was called with mousedownItem=null,
    // mousedownHandled=true. Mirror that into uiState.mode so mouseup runs
    // against a realistic snapshot.
    const lastSetMode = (uiState.actions.setMode as jest.Mock).mock.calls.pop();
    if (lastSetMode) uiState.mode = lastSetMode[0];

    Cursor.mouseup!({ uiState, scene, isRendererInteraction: true } as any);

    // The flag-bypass path means NO selection-changing action was issued.
    expect(uiState.actions.clearSelection).not.toHaveBeenCalled();
    expect(uiState.actions.setItemControls).not.toHaveBeenCalledWith(null);
    expect(uiState.actions.setSelectedIds).not.toHaveBeenCalled();
  });

  it('plain click on a waypoint (no Alt) does NOT splice — it sets up drag', () => {
    const scene = makeScene();
    const uiState = makeUiState({
      itemControls: { type: 'CONNECTOR', id: 'c1' },
      mouse: {
        position: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
        mousedown: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
        delta: null,
        modifiers: { ctrl: false, shift: false, meta: false, alt: false },
        targetAnchorId: 'w1'
      }
    });

    Cursor.mousedown!({ uiState, scene, isRendererInteraction: true } as any);

    expect(scene.updateConnector).not.toHaveBeenCalled();
    // mousedownItem should be set to the CONNECTOR_ANCHOR ref so the drag
    // path can pick it up.
    const lastSetMode = (uiState.actions.setMode as jest.Mock).mock.calls.pop();
    expect(lastSetMode[0]).toMatchObject({
      mousedownItem: { type: 'CONNECTOR_ANCHOR', id: 'w1' },
      mousedownHandled: true
    });
  });

  it('uses DOM-driven targetAnchorId instead of tile-equality', () => {
    // The cursor is on tile (4, 4) — does NOT match any anchor tile — but
    // targetAnchorId says w1. Without the DOM-driven path, this click would
    // be rejected by the tile equality check.
    const scene = makeScene();
    const uiState = makeUiState({
      itemControls: { type: 'CONNECTOR', id: 'c1' },
      mouse: {
        position: { tile: { x: 4, y: 4 }, screen: { x: 50, y: 50 } },
        mousedown: { tile: { x: 4, y: 4 }, screen: { x: 50, y: 50 } },
        delta: null,
        modifiers: { ctrl: false, shift: false, meta: false, alt: true },
        targetAnchorId: 'w1'
      }
    });

    Cursor.mousedown!({ uiState, scene, isRendererInteraction: true } as any);

    expect(scene.updateConnector).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({
        anchors: expect.arrayContaining([
          expect.objectContaining({ id: 'w2' })
        ])
      })
    );
  });

  it('splices a waypoint even when the connector is NOT pre-selected (#1)', () => {
    // itemControls is null — nothing selected. The selected-connector path bails,
    // and the new no-pre-select Alt+click path tile-matches the waypoint under the
    // cursor (no overlay handle exists when unselected, so targetAnchorId is null).
    const scene = makeScene();
    const uiState = makeUiState({
      itemControls: null,
      mouse: {
        position: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
        mousedown: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
        delta: null,
        modifiers: { ctrl: false, shift: false, meta: false, alt: true },
        targetAnchorId: null
      }
    });

    Cursor.mousedown!({ uiState, scene, isRendererInteraction: true } as any);

    expect(scene.updateConnector).toHaveBeenCalledWith('c1', {
      anchors: [
        { id: 'e0', ref: { item: 'n1' } },
        { id: 'w2', ref: { tile: { x: 6, y: 5 } } },
        { id: 'e1', ref: { item: 'n2' } }
      ]
    });
    // Removal must not select the connector — it stays as it was (unselected).
    expect(uiState.actions.setItemControls).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CONNECTOR' })
    );

    // Drain the module-local altSpliceConsumed flag so it doesn't leak to the
    // next test (mirrors the 'subsequent mouseup' test's bookkeeping).
    const lastSetMode = (uiState.actions.setMode as jest.Mock).mock.calls.pop();
    if (lastSetMode) uiState.mode = lastSetMode[0];
    Cursor.mouseup!({ uiState, scene, isRendererInteraction: true } as any);
  });
});

describe('Cursor — Ctrl+click on connector toggles connector + waypoints (ADR-0006)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Drain any leftover altSpliceConsumed module flag from prior Alt+click
    // tests so this suite's mouseup paths run their normal logic. A no-op
    // mouseup against an empty-mode uiState consumes the flag without
    // affecting selection (mode.mousedownItem null, mousedownHandled false).
    const drainUi = makeUiState({
      mode: {
        type: 'CURSOR',
        showCursor: true,
        mousedownItem: null,
        mousedownHandled: false
      }
    });
    Cursor.mouseup!({
      uiState: drainUi,
      scene: makeScene([]),
      isRendererInteraction: true
    } as any);
    jest.clearAllMocks();
  });

  it('adds connector and all its waypoint anchors when not currently selected', () => {
    const scene = makeScene();
    const uiState = makeUiState({
      mode: {
        type: 'CURSOR',
        showCursor: true,
        mousedownItem: { type: 'CONNECTOR', id: 'c1' },
        mousedownHandled: true
      },
      mouse: {
        position: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
        mousedown: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
        delta: null,
        modifiers: { ctrl: true, shift: false, meta: false, alt: false },
        targetAnchorId: null
      },
      selectedIds: []
    });

    Cursor.mouseup!({ uiState, scene, isRendererInteraction: true } as any);

    expect(uiState.actions.setSelectedIds).toHaveBeenCalledWith([
      { type: 'CONNECTOR', id: 'c1' },
      { type: 'CONNECTOR_ANCHOR', id: 'w1' },
      { type: 'CONNECTOR_ANCHOR', id: 'w2' }
    ]);
  });

  it('removes the connector AND its waypoints when already selected', () => {
    const scene = makeScene();
    const uiState = makeUiState({
      mode: {
        type: 'CURSOR',
        showCursor: true,
        mousedownItem: { type: 'CONNECTOR', id: 'c1' },
        mousedownHandled: true
      },
      mouse: {
        position: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
        mousedown: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
        delta: null,
        modifiers: { ctrl: true, shift: false, meta: false, alt: false },
        targetAnchorId: null
      },
      selectedIds: [
        { type: 'ITEM', id: 'other-node' },
        { type: 'CONNECTOR', id: 'c1' },
        { type: 'CONNECTOR_ANCHOR', id: 'w1' },
        { type: 'CONNECTOR_ANCHOR', id: 'w2' }
      ]
    });

    Cursor.mouseup!({ uiState, scene, isRendererInteraction: true } as any);

    expect(uiState.actions.setSelectedIds).toHaveBeenCalledWith([
      { type: 'ITEM', id: 'other-node' }
    ]);
  });
});
