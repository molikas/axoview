/**
 * REGRESSION — Cursor mode handler contracts (real module)
 *
 * Tests the ACTUAL Cursor.ts module.
 * Specifically covers the mousedownHandled flag logic that prevents spurious
 * context-menu opening after external setMode calls.
 *
 * Classified as VALID: imports the real Cursor module.
 */

import { Cursor } from 'src/interaction/modes/Cursor';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockGetItemAtTile = jest.fn<any, any>(() => null);
const mockHasMovedTile = jest.fn<any, any>(() => false);

jest.mock('src/utils', () => ({
  getItemAtTile: (...args: any[]) => mockGetItemAtTile(...args),
  hasMovedTile: (...args: any[]) => mockHasMovedTile(...args),
  getAnchorAtTile: jest.fn(() => null),
  // Return a realistic result for initialTiles capture; throws are silently caught
  getItemByIdOrThrow: jest.fn((arr: any[], id: string) => {
    const found = (arr as any[]).find((item: any) => item.id === id);
    if (!found) throw new Error(`Not found: ${id}`);
    return { index: 0, value: found };
  }),
  generateId: jest.fn(() => 'new-id'),
  CoordsUtils: {
    zero: () => ({ x: 0, y: 0 }),
    // Real coordinate comparison — drag detection uses this instead of hasMovedTile
    isEqual: (a: any, b: any) => a.x === b.x && a.y === b.y,
    subtract: (a: any, b: any) => ({ x: a.x - b.x, y: a.y - b.y })
  },
  // getAnchorTile returns the anchor's item tile or the tile ref directly
  getAnchorTile: jest.fn((anchor: any) => anchor.ref?.tile ?? { x: 0, y: 0 }),
  // connectorPathTileToGlobal returns the path tile as-is for test simplicity
  connectorPathTileToGlobal: jest.fn((tile: any) => tile),
  setWindowCursor: jest.fn()
}));

// Cursor.ts imports useScene for type only — mock to prevent module resolution errors
jest.mock('src/hooks/useScene', () => ({ useScene: jest.fn() }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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
      mousedown: null,
      delta: null
    },
    itemControls: overrides.itemControls ?? null,
    actions: overrides.actions ?? {
      setMode: jest.fn(),
      setItemControls: jest.fn()
    }
  };
}

function makeScene(items: any[] = [], hitConnectors: any[] = []) {
  return {
    connectors: [],
    items,
    rectangles: [],
    textBoxes: [],
    hitConnectors,
    currentView: { items, connectors: [] }
  };
}

function callMousedown(uiState: any, isRendererInteraction: boolean) {
  Cursor.mousedown!({
    uiState,
    scene: makeScene(),
    isRendererInteraction
  } as any);
}

function callMouseup(uiState: any, isRendererInteraction = true) {
  Cursor.mouseup!({
    uiState,
    scene: makeScene(),
    isRendererInteraction
  } as any);
}

function callMousemove(uiState: any, scene: any = makeScene()) {
  Cursor.mousemove!({ uiState, scene, isRendererInteraction: true } as any);
}

// ---------------------------------------------------------------------------
// mousedown
// ---------------------------------------------------------------------------
describe('Cursor.mousedown (real module)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItemAtTile.mockReturnValue(null);
  });

  it('does nothing when isRendererInteraction is false', () => {
    const uiState = makeUiState();
    callMousedown(uiState, false);
    expect(uiState.actions.setMode).not.toHaveBeenCalled();
  });

  it('does nothing when mode type is not CURSOR', () => {
    const uiState = makeUiState({
      mode: { type: 'LASSO', selection: null, isDragging: false }
    });
    callMousedown(uiState, true);
    expect(uiState.actions.setMode).not.toHaveBeenCalled();
  });

  it('sets mousedownHandled=true and mousedownItem when item is at tile', () => {
    mockGetItemAtTile.mockReturnValue({ type: 'ITEM', id: 'node1' });
    const uiState = makeUiState();
    callMousedown(uiState, true);
    expect(uiState.actions.setMode).toHaveBeenCalledWith(
      expect.objectContaining({
        mousedownItem: { type: 'ITEM', id: 'node1' },
        mousedownHandled: true
      })
    );
  });

  it('sets mousedownHandled=true and mousedownItem=null on empty tile, clears itemControls', () => {
    mockGetItemAtTile.mockReturnValue(null);
    const uiState = makeUiState();
    callMousedown(uiState, true);
    expect(uiState.actions.setMode).toHaveBeenCalledWith(
      expect.objectContaining({
        mousedownItem: null,
        mousedownHandled: true
      })
    );
    expect(uiState.actions.setItemControls).toHaveBeenCalledWith(null);
  });
});

// ---------------------------------------------------------------------------
// mouseup
// ---------------------------------------------------------------------------
describe('Cursor.mouseup (real module)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasMovedTile.mockReturnValue(false);
  });

  it('does nothing when isRendererInteraction is false', () => {
    const uiState = makeUiState();
    callMouseup(uiState, false);
    expect(uiState.actions.setMode).not.toHaveBeenCalled();
  });

  it('does nothing when mode type is not CURSOR', () => {
    const uiState = makeUiState({
      mode: { type: 'LASSO', selection: null, isDragging: false }
    });
    callMouseup(uiState);
    expect(uiState.actions.setMode).not.toHaveBeenCalled();
  });

  it('sets itemControls for ITEM when mousedownItem is an ITEM and no movement', () => {
    const uiState = makeUiState({
      mode: {
        type: 'CURSOR',
        showCursor: true,
        mousedownItem: { type: 'ITEM', id: 'node1' },
        mousedownHandled: true
      },
      mouse: {
        position: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
        mousedown: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
        delta: null
      }
    });
    callMouseup(uiState);
    expect(uiState.actions.setItemControls).toHaveBeenCalledWith({
      type: 'ITEM',
      id: 'node1'
    });
  });

  it('sets itemControls for RECTANGLE when mousedownItem is a RECTANGLE and no movement', () => {
    const uiState = makeUiState({
      mode: {
        type: 'CURSOR',
        showCursor: true,
        mousedownItem: { type: 'RECTANGLE', id: 'rect1' },
        mousedownHandled: true
      },
      mouse: {
        position: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
        mousedown: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
        delta: null
      }
    });
    callMouseup(uiState);
    expect(uiState.actions.setItemControls).toHaveBeenCalledWith({
      type: 'RECTANGLE',
      id: 'rect1'
    });
  });

  // #10 (UX sweep 2026-06-30): Shift joins Ctrl/Cmd as an additive-select
  // modifier on canvas. A Shift-click toggles the item into the selection
  // (toggleSelected) rather than replacing it.
  it('#10: Shift-click on an item is additive (toggleSelected), like Ctrl', () => {
    const toggleSelected = jest.fn();
    const setSelectedIds = jest.fn();
    const uiState = makeUiState({
      mode: {
        type: 'CURSOR',
        showCursor: true,
        mousedownItem: { type: 'ITEM', id: 'node1' },
        mousedownHandled: true
      },
      mouse: {
        position: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
        mousedown: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
        delta: null,
        modifiers: { ctrl: false, shift: true, meta: false }
      },
      actions: {
        setMode: jest.fn(),
        setItemControls: jest.fn(),
        toggleSelected,
        setSelectedIds
      }
    });
    callMouseup(uiState);
    expect(toggleSelected).toHaveBeenCalledWith({ type: 'ITEM', id: 'node1' });
    expect(setSelectedIds).not.toHaveBeenCalled();
  });

  it('plain click (no modifier) replaces the selection (setSelectedIds)', () => {
    const toggleSelected = jest.fn();
    const setSelectedIds = jest.fn();
    const uiState = makeUiState({
      mode: {
        type: 'CURSOR',
        showCursor: true,
        mousedownItem: { type: 'ITEM', id: 'node1' },
        mousedownHandled: true
      },
      mouse: {
        position: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
        mousedown: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
        delta: null,
        modifiers: { ctrl: false, shift: false, meta: false }
      },
      actions: {
        setMode: jest.fn(),
        setItemControls: jest.fn(),
        toggleSelected,
        setSelectedIds
      }
    });
    callMouseup(uiState);
    expect(setSelectedIds).toHaveBeenCalledWith([{ type: 'ITEM', id: 'node1' }]);
    expect(toggleSelected).not.toHaveBeenCalled();
  });

  it('deselects (setItemControls null) on left-click empty canvas — no context menu, no event', () => {
    const uiState = makeUiState({
      mode: {
        type: 'CURSOR',
        showCursor: true,
        mousedownItem: null,
        mousedownHandled: true
      },
      mouse: {
        position: { tile: { x: 3, y: 4 }, screen: { x: 30, y: 40 } },
        mousedown: { tile: { x: 3, y: 4 }, screen: { x: 30, y: 40 } },
        delta: null
      }
    });
    const dispatchSpy = jest.spyOn(window, 'dispatchEvent');
    callMouseup(uiState);
    expect(uiState.actions.setItemControls).toHaveBeenCalledWith(null);
    expect(dispatchSpy).not.toHaveBeenCalled();
    dispatchSpy.mockRestore();
  });

  // MQA #16 — drag-select inside a properties-panel input that crosses the
  // panel edge into the canvas used to fire Cursor.mouseup with no canvas
  // mousedown registered, which dismissed the panel. The fix is to ignore
  // mouseup when neither uiState.mouse.mousedown nor mousedownHandled is set.
  it('does NOT dismiss panel (no setItemControls call) when drag started outside the canvas', () => {
    const uiState = makeUiState({
      mode: {
        type: 'CURSOR',
        showCursor: true,
        mousedownItem: null,
        mousedownHandled: false // no canvas mousedown was registered
      },
      mouse: {
        position: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
        mousedown: null, // user dragged in from outside the renderer
        delta: null
      },
      // Panel is open — would close if we incorrectly dispatched setItemControls(null)
      itemControls: { type: 'ITEM', id: 'node-being-edited' }
    });
    callMouseup(uiState);
    expect(uiState.actions.setItemControls).not.toHaveBeenCalled();
  });

  it('resets mousedownItem and mousedownHandled to null/false after mouseup', () => {
    const uiState = makeUiState({
      mode: {
        type: 'CURSOR',
        showCursor: true,
        mousedownItem: { type: 'ITEM', id: 'n1' },
        mousedownHandled: true
      },
      mouse: {
        position: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
        mousedown: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
        delta: null
      }
    });
    callMouseup(uiState);
    const lastCall =
      uiState.actions.setMode.mock.calls[
        uiState.actions.setMode.mock.calls.length - 1
      ][0];
    expect(lastCall.mousedownItem).toBeNull();
    expect(lastCall.mousedownHandled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// mousemove
// ---------------------------------------------------------------------------
describe('Cursor.mousemove (real module)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does nothing when mode type is not CURSOR', () => {
    const uiState = makeUiState({
      mode: { type: 'LASSO', selection: null, isDragging: false }
    });
    Cursor.mousemove!({
      uiState,
      scene: makeScene(),
      isRendererInteraction: true
    } as any);
    expect(uiState.actions.setMode).not.toHaveBeenCalled();
  });

  it('does nothing when position tile equals mousedown tile (no drag yet)', () => {
    // position == mousedown → CoordsUtils.isEqual returns true → hasDragged = false
    const uiState = makeUiState({
      mode: {
        type: 'CURSOR',
        showCursor: true,
        mousedownItem: { type: 'ITEM', id: 'n1' },
        mousedownHandled: true
      },
      mouse: {
        position: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
        mousedown: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
        delta: null
      }
    });
    callMousemove(uiState);
    expect(uiState.actions.setMode).not.toHaveBeenCalled();
  });

  it('does nothing when mousedown is null and hasMovedTile is false (no hover update)', () => {
    mockHasMovedTile.mockReturnValue(false);
    const uiState = makeUiState({
      mode: {
        type: 'CURSOR',
        showCursor: true,
        mousedownItem: null,
        mousedownHandled: false
      },
      mouse: {
        position: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
        mousedown: null,
        delta: null
      }
    });
    callMousemove(uiState);
    expect(uiState.actions.setMode).not.toHaveBeenCalled();
  });

  it('transitions to DRAG_ITEMS with showCursor:true when item dragged and position != mousedown', () => {
    // position != mousedown → hasDragged = true → DRAG_ITEMS
    const uiState = makeUiState({
      mode: {
        type: 'CURSOR',
        showCursor: true,
        mousedownItem: { type: 'ITEM', id: 'n1' },
        mousedownHandled: true
      },
      mouse: {
        position: { tile: { x: 8, y: 8 }, screen: { x: 80, y: 80 } },
        mousedown: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
        delta: { tile: { x: 3, y: 3 }, screen: { x: 30, y: 30 } }
      }
    });
    // Scene includes the node so initialTiles gets populated
    const scene = makeScene([{ id: 'n1', tile: { x: 5, y: 5 } }]);
    callMousemove(uiState, scene);
    expect(uiState.actions.setMode).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'DRAG_ITEMS',
        showCursor: true,
        items: [{ type: 'ITEM', id: 'n1' }],
        initialTiles: { n1: { x: 5, y: 5 } },
        initialRectangles: {}
      })
    );
  });

  // ADR 0018 Decision 5 (§5.1 gap 3 — the precision-trackpad fix). The drag-start
  // classifier is now PIXEL-based (exceedsTapSlop on position.screen vs
  // mousedown.screen), not whole-tile. A sub-tile drag (SAME tile, screen delta
  // beyond TAP_SLOP_PX) must still start a node drag — the old whole-tile gate
  // swallowed it.
  it('transitions to DRAG_ITEMS on a sub-tile drag (same tile, screen delta > slop)', () => {
    const uiState = makeUiState({
      mode: {
        type: 'CURSOR',
        showCursor: true,
        mousedownItem: { type: 'ITEM', id: 'n1' },
        mousedownHandled: true
      },
      mouse: {
        // Tile is UNCHANGED (5,5) → the old whole-tile threshold would NOT drag.
        // Screen moved 50→62 (12px > TAP_SLOP_PX=8) → px classifier DOES drag.
        position: { tile: { x: 5, y: 5 }, screen: { x: 62, y: 50 } },
        mousedown: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
        delta: { tile: { x: 0, y: 0 }, screen: { x: 12, y: 0 } }
      }
    });
    const scene = makeScene([{ id: 'n1', tile: { x: 5, y: 5 } }]);
    callMousemove(uiState, scene);
    expect(uiState.actions.setMode).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'DRAG_ITEMS', items: [{ type: 'ITEM', id: 'n1' }] })
    );
  });

  it('does NOT start a drag for a within-slop sub-tile jitter (same tile, screen delta < slop)', () => {
    const uiState = makeUiState({
      mode: {
        type: 'CURSOR',
        showCursor: true,
        mousedownItem: { type: 'ITEM', id: 'n1' },
        mousedownHandled: true
      },
      mouse: {
        // 50→54 = 4px < TAP_SLOP_PX → a tap, not a drag.
        position: { tile: { x: 5, y: 5 }, screen: { x: 54, y: 50 } },
        mousedown: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
        delta: { tile: { x: 0, y: 0 }, screen: { x: 4, y: 0 } }
      }
    });
    const scene = makeScene([{ id: 'n1', tile: { x: 5, y: 5 } }]);
    callMousemove(uiState, scene);
    expect(uiState.actions.setMode).not.toHaveBeenCalled();
  });

  it('transitions to DRAG_ITEMS with showCursor:true when textbox dragged and position != mousedown', () => {
    const uiState = makeUiState({
      mode: {
        type: 'CURSOR',
        showCursor: true,
        mousedownItem: { type: 'TEXTBOX', id: 'tb1' },
        mousedownHandled: true
      },
      mouse: {
        position: { tile: { x: 8, y: 5 }, screen: { x: 80, y: 50 } },
        mousedown: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
        delta: { tile: { x: 3, y: 0 }, screen: { x: 30, y: 0 } }
      }
    });
    const scene = {
      connectors: [],
      items: [],
      rectangles: [],
      textBoxes: [{ id: 'tb1', tile: { x: 5, y: 5 } }],
      hitConnectors: [],
      currentView: { items: [], connectors: [] }
    };
    callMousemove(uiState, scene);
    expect(uiState.actions.setMode).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'DRAG_ITEMS',
        showCursor: true,
        initialTiles: { tb1: { x: 5, y: 5 } }
      })
    );
  });

  it('transitions to LASSO when mousedownItem is null and position != mousedown', () => {
    const uiState = makeUiState({
      mode: {
        type: 'CURSOR',
        showCursor: true,
        mousedownItem: null,
        mousedownHandled: true
      },
      mouse: {
        position: { tile: { x: 8, y: 8 }, screen: { x: 80, y: 80 } },
        mousedown: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
        delta: { tile: { x: 3, y: 3 }, screen: { x: 30, y: 30 } }
      }
    });
    callMousemove(uiState);
    expect(uiState.actions.setMode).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'LASSO' })
    );
  });
});

// ---------------------------------------------------------------------------
// P2: endpoint anchor click → RECONNECT_ANCHOR mode
// ---------------------------------------------------------------------------
describe('Cursor.mousedown — connector endpoint click enters RECONNECT_ANCHOR', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItemAtTile.mockReturnValue(null);
  });

  // Build a minimal hitConnector whose first anchor's hit tile matches the click position.
  // connectorPathTileToGlobal is mocked to return the tile as-is, so path.tiles[0] === hit tile.
  function makeHitConnector(id: string, anchorTile: { x: number; y: number }) {
    return {
      id,
      anchors: [
        { id: 'a-src', ref: { item: 'node-A' } }, // endpoint — ref.item set
        { id: 'a-tgt', ref: { item: 'node-B' } } // endpoint
      ],
      path: {
        tiles: [anchorTile, { x: anchorTile.x + 3, y: anchorTile.y }],
        rectangle: {
          from: anchorTile,
          to: { x: anchorTile.x + 3, y: anchorTile.y }
        }
      }
    };
  }

  it('enters RECONNECT_ANCHOR when clicking the source endpoint of a selected connector', () => {
    const anchorTile = { x: 5, y: 5 };
    const hitConnector = makeHitConnector('conn-X', anchorTile);
    const uiState = makeUiState({
      mouse: {
        position: { tile: anchorTile, screen: { x: 50, y: 50 } },
        mousedown: null,
        delta: null
      },
      itemControls: { type: 'CONNECTOR', id: 'conn-X' }
    });
    const scene = makeScene([], [hitConnector]);

    Cursor.mousedown!({ uiState, scene, isRendererInteraction: true } as any);

    expect(uiState.actions.setMode).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RECONNECT_ANCHOR',
        connectorId: 'conn-X',
        anchorId: 'a-src',
        anchorIndex: 0
      })
    );
  });

  it('enters RECONNECT_ANCHOR when clicking the target endpoint of a selected connector', () => {
    const srcTile = { x: 2, y: 2 };
    const tgtTile = { x: 8, y: 8 };
    const hitConnector = {
      id: 'conn-Y',
      anchors: [
        { id: 'a-src', ref: { item: 'node-A' } },
        { id: 'a-tgt', ref: { item: 'node-B' } }
      ],
      path: {
        tiles: [srcTile, tgtTile],
        rectangle: { from: srcTile, to: tgtTile }
      }
    };
    const uiState = makeUiState({
      mouse: {
        position: { tile: tgtTile, screen: { x: 80, y: 80 } },
        mousedown: null,
        delta: null
      },
      itemControls: { type: 'CONNECTOR', id: 'conn-Y' }
    });
    const scene = makeScene([], [hitConnector]);

    Cursor.mousedown!({ uiState, scene, isRendererInteraction: true } as any);

    expect(uiState.actions.setMode).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RECONNECT_ANCHOR',
        connectorId: 'conn-Y',
        anchorId: 'a-tgt'
      })
    );
  });

  it('falls through to normal item hit-detection when no connector is selected', () => {
    mockGetItemAtTile.mockReturnValue({ type: 'ITEM', id: 'some-node' });
    const uiState = makeUiState({
      mouse: {
        position: { tile: { x: 5, y: 5 }, screen: { x: 50, y: 50 } },
        mousedown: null,
        delta: null
      }
      // itemControls: null — no connector selected
    });

    Cursor.mousedown!({
      uiState,
      scene: makeScene(),
      isRendererInteraction: true
    } as any);

    expect(uiState.actions.setMode).toHaveBeenCalledWith(
      expect.objectContaining({
        mousedownItem: { type: 'ITEM', id: 'some-node' }
      })
    );
  });

  it('falls through to normal hit-detection when click is not on any anchor tile', () => {
    mockGetItemAtTile.mockReturnValue(null);
    const anchorTile = { x: 5, y: 5 };
    const hitConnector = makeHitConnector('conn-Z', anchorTile);
    const uiState = makeUiState({
      mouse: {
        position: { tile: { x: 9, y: 9 }, screen: { x: 90, y: 90 } },
        mousedown: null,
        delta: null
      },
      itemControls: { type: 'CONNECTOR', id: 'conn-Z' }
    });
    const scene = makeScene([], [hitConnector]);

    Cursor.mousedown!({ uiState, scene, isRendererInteraction: true } as any);

    expect(uiState.actions.setMode).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'RECONNECT_ANCHOR' })
    );
  });
});
