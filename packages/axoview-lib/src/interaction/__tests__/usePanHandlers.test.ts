/**
 * REGRESSION — usePanHandlers
 *
 * Right-click pan is now TRANSIENT (not sticky):
 *  - Right mousedown: consume event, defer pan entry until drag threshold.
 *  - Right mousemove (>4px): enter PAN mode.
 *  - Right mouseup after drag: exit PAN, restore previous mode.
 *  - Right mouseup without drag (ADR 0027): in CURSOR mode opens the canvas
 *    context menu (item menu + select if over an interactable item, else the
 *    empty-canvas menu); in a tool mode it aborts the tool (restore + clear).
 *
 * Pan is now a FIXED model (ADR 0022 §6 — the panSettings customization surface
 * was removed). Mouse-down triggers:
 *  1. Left-click while in PAN mode → endPan(), return true
 *  2. Middle-click → startPan('middle'), return true (always)
 *  3. Right-click → consume event (return true), NO immediate PAN (deferred)
 *  4. Regular left-click (not in PAN) → return false (no ctrl/alt/empty pans)
 */

import { renderHook, act } from '@testing-library/react';
import { usePanHandlers } from '../usePanHandlers';

// ---------------------------------------------------------------------------
// Mutable mock state — updated per test
// ---------------------------------------------------------------------------
const mockSetMode = jest.fn();
const mockSetItemControls = jest.fn();
const mockSetMouse = jest.fn();
const mockSetSelectedIds = jest.fn();
const mockOpenContextMenu = jest.fn();
const mockUiState = {
  mode: { type: 'CURSOR' as string, selection: null },
  actions: {
    setMode: mockSetMode,
    setItemControls: mockSetItemControls,
    setMouse: mockSetMouse,
    setSelectedIds: mockSetSelectedIds,
    openContextMenu: mockOpenContextMenu
  },
  rendererEl: null as EventTarget | null,
  mouse: { position: { tile: { x: 5, y: 5 } } }
};

jest.mock('src/stores/uiStateStore', () => ({
  useUiStateStore: jest.fn((selector: (s: typeof mockUiState) => unknown) =>
    selector(mockUiState)
  ),
  useUiStateStoreApi: jest.fn(() => ({ getState: () => mockUiState }))
}));

const mockGetItemAtTile = jest.fn<null, [unknown]>(() => null);
const mockSetWindowCursor = jest.fn<void, [unknown]>();

jest.mock('src/utils', () => ({
  getItemAtTile: (a: unknown) => mockGetItemAtTile(a),
  setWindowCursor: (a: unknown) => mockSetWindowCursor(a),
  CoordsUtils: { zero: () => ({ x: 0, y: 0 }) }
}));

jest.mock('src/hooks/useScene', () => ({
  useScene: jest.fn(() => ({
    items: [],
    connectors: [],
    rectangles: [],
    textBoxes: [],
    // D-4 abort-symmetry: usePanHandlers aborts an in-flight connector on
    // right-click restore (delete + close the drag bracket).
    deleteConnector: jest.fn(),
    commitDragTransaction: jest.fn()
  }))
}));

// usePanHandlers consults the layer context to treat locked/hidden items as
// background for the right-tap menu (UX §4.3). Default: no locked/hidden ids.
jest.mock('src/hooks/useLayerContext', () => ({
  useLayerContext: jest.fn(() => ({
    lockedIds: new Set<string>(),
    visibleIds: new Set<string>()
  }))
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeEvent(
  overrides: Partial<{
    button: number;
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    metaKey: boolean;
    type: string;
    target: EventTarget | null;
    clientX: number;
    clientY: number;
    preventDefault: jest.Mock;
  }> = {}
) {
  return {
    button: 0,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    type: 'mousedown',
    target: null,
    clientX: 100,
    clientY: 100,
    preventDefault: jest.fn(),
    ...overrides
  };
}

function setup() {
  return renderHook(() => usePanHandlers());
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  jest.clearAllMocks();
  mockUiState.mode = { type: 'CURSOR', selection: null };
  mockUiState.actions = {
    setMode: mockSetMode,
    setItemControls: mockSetItemControls,
    setMouse: mockSetMouse,
    setSelectedIds: mockSetSelectedIds,
    openContextMenu: mockOpenContextMenu
  } as any;
  mockUiState.rendererEl = null;
  mockGetItemAtTile.mockReturnValue(null);
});

describe('usePanHandlers.handleMouseDown — pan bypass conditions', () => {
  test('1. left-click while in PAN mode → returns true (bypasses canvas interaction)', () => {
    mockUiState.mode.type = 'PAN';
    const { result } = setup();
    let returned: boolean = false;
    act(() => {
      returned = result.current.handleMouseDown(makeEvent({ button: 0 }));
    });
    expect(returned).toBe(true);
  });

  test('1b. full cycle: middle-click starts pan, left-click ends pan → setMode CURSOR', () => {
    mockUiState.mode.type = 'CURSOR';
    const { result } = setup();
    act(() => {
      result.current.handleMouseDown(makeEvent({ button: 1 }));
    });
    expect(mockSetMode).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PAN' })
    );
    mockSetMode.mockClear();
    act(() => {
      result.current.handleMouseUp(makeEvent({ button: 0 }));
    });
    expect(mockSetMode).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CURSOR' })
    );
  });

  test('2. middle-click + middleClickPan=true → startPan and returns true', () => {
    const { result } = setup();
    let returned: boolean = false;
    act(() => {
      returned = result.current.handleMouseDown(makeEvent({ button: 1 }));
    });
    expect(returned).toBe(true);
    expect(mockSetMode).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PAN' })
    );
  });

  test('4. right-click → consumes event (returns true) but does NOT immediately enter PAN', () => {
    const { result } = setup();
    let returned: boolean = false;
    act(() => {
      returned = result.current.handleMouseDown(makeEvent({ button: 2 }));
    });
    expect(returned).toBe(true);
    // Pan entry is deferred — mode must not be set on mousedown alone
    expect(mockSetMode).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PAN' })
    );
  });

  test('5. regular left-click (not in PAN) → returns false; no ctrl/alt/empty-area pans', () => {
    const { result } = setup();
    let returned = false;
    act(() => {
      returned = result.current.handleMouseDown(makeEvent({ button: 0 }));
    });
    expect(returned).toBe(false);
    expect(mockSetMode).not.toHaveBeenCalled();
    // Modifier-held left-clicks no longer pan either (the surface was removed).
    act(() => {
      result.current.handleMouseDown(makeEvent({ button: 0, ctrlKey: true }));
      result.current.handleMouseDown(makeEvent({ button: 0, altKey: true }));
    });
    expect(mockSetMode).not.toHaveBeenCalled();
  });
});

describe('usePanHandlers.handleMouseMove — deferred right-drag pan', () => {
  test('right-drag beyond threshold → enters PAN mode, returns false (processMouseUpdate runs)', () => {
    const { result } = setup();
    act(() => {
      result.current.handleMouseDown(
        makeEvent({ button: 2, clientX: 100, clientY: 100 })
      );
    });
    mockSetMode.mockClear();
    let consumed = false;
    // Move beyond threshold
    act(() => {
      consumed = result.current.handleMouseMove(
        makeEvent({ clientX: 106, clientY: 100 })
      );
    });
    expect(mockSetMode).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PAN' })
    );
    expect(consumed).toBe(false); // Pan.mousemove must run
  });

  test('right-drag below threshold → does NOT enter PAN, returns true (suppresses processMouseUpdate)', () => {
    const { result } = setup();
    act(() => {
      result.current.handleMouseDown(
        makeEvent({ button: 2, clientX: 100, clientY: 100 })
      );
    });
    mockSetMode.mockClear();
    let consumed = false;
    // Move below threshold
    act(() => {
      consumed = result.current.handleMouseMove(
        makeEvent({ clientX: 102, clientY: 101 })
      );
    });
    expect(mockSetMode).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PAN' })
    );
    // Must suppress processMouseUpdate to prevent Cursor.mousemove triggering lasso
    expect(consumed).toBe(true);
  });

  test('mousemove without prior right-down → returns false (no suppression)', () => {
    const { result } = setup();
    let consumed = false;
    act(() => {
      consumed = result.current.handleMouseMove(
        makeEvent({ clientX: 200, clientY: 200 })
      );
    });
    expect(mockSetMode).not.toHaveBeenCalled();
    expect(consumed).toBe(false);
  });

  test('mousemove after pan has started → returns false (Pan.mousemove must run)', () => {
    const { result } = setup();
    act(() => {
      result.current.handleMouseDown(
        makeEvent({ button: 2, clientX: 100, clientY: 100 })
      );
    });
    act(() => {
      result.current.handleMouseMove(makeEvent({ clientX: 110, clientY: 100 }));
    }); // starts pan
    mockSetMode.mockClear();
    let consumed = false;
    act(() => {
      consumed = result.current.handleMouseMove(
        makeEvent({ clientX: 115, clientY: 100 })
      );
    });
    expect(consumed).toBe(false);
  });
});

describe('usePanHandlers.handleMouseUp', () => {
  test('returns false if not panning and no prior right-down', () => {
    const { result } = setup();
    let returned: boolean = false;
    act(() => {
      returned = result.current.handleMouseUp(makeEvent({ button: 0 }));
    });
    expect(returned).toBe(false);
  });

  test('right-tap on empty canvas (CURSOR) → opens the empty-canvas context menu', () => {
    mockGetItemAtTile.mockReturnValue(null);
    const { result } = setup();
    act(() => {
      result.current.handleMouseDown(makeEvent({ button: 2 }));
    });
    mockSetMode.mockClear();
    mockOpenContextMenu.mockClear();
    mockSetMouse.mockClear();
    let returned: boolean = false;
    act(() => {
      returned = result.current.handleMouseUp(
        makeEvent({ button: 2, clientX: 100, clientY: 100 })
      );
    });
    expect(returned).toBe(true);
    expect(mockOpenContextMenu).toHaveBeenCalledWith({
      anchor: { x: 100, y: 100 },
      target: null
    });
    // Stale mousedown state must be cleared so Cursor.mousemove can't trigger lasso
    expect(mockSetMouse).toHaveBeenCalledWith(
      expect.objectContaining({ mousedown: null })
    );
    expect(mockSetMode).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PAN' })
    );
  });

  test('right-tap on an interactable item (CURSOR) → selects it + opens the item menu', () => {
    mockGetItemAtTile.mockReturnValue({ type: 'ITEM', id: 'n1' } as any);
    const { result } = setup();
    act(() => {
      result.current.handleMouseDown(makeEvent({ button: 2 }));
    });
    mockSetSelectedIds.mockClear();
    mockOpenContextMenu.mockClear();
    let returned: boolean = false;
    act(() => {
      returned = result.current.handleMouseUp(
        makeEvent({ button: 2, clientX: 42, clientY: 24 })
      );
    });
    expect(returned).toBe(true);
    expect(mockSetSelectedIds).toHaveBeenCalledWith([{ type: 'ITEM', id: 'n1' }]);
    expect(mockOpenContextMenu).toHaveBeenCalledWith({
      anchor: { x: 42, y: 24 },
      target: { type: 'ITEM', id: 'n1' }
    });
  });

  test('right-drag then release → exits PAN and restores previous mode (CURSOR)', () => {
    const { result } = setup();
    // Start and cross threshold
    act(() => {
      result.current.handleMouseDown(
        makeEvent({ button: 2, clientX: 100, clientY: 100 })
      );
    });
    act(() => {
      result.current.handleMouseMove(makeEvent({ clientX: 110, clientY: 100 }));
    });
    mockSetMode.mockClear();
    let returned: boolean = false;
    act(() => {
      returned = result.current.handleMouseUp(makeEvent({ button: 2 }));
    });
    expect(returned).toBe(true);
    // Should restore to CURSOR (was in CURSOR before right-click)
    expect(mockSetMode).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CURSOR' })
    );
  });

  test('right-drag from CONNECTOR mode → restores CONNECTOR mode on release', () => {
    mockUiState.mode = { type: 'CONNECTOR', selection: null };
    const { result } = setup();
    act(() => {
      result.current.handleMouseDown(
        makeEvent({ button: 2, clientX: 100, clientY: 100 })
      );
    });
    act(() => {
      result.current.handleMouseMove(makeEvent({ clientX: 110, clientY: 100 }));
    });
    mockSetMode.mockClear();
    act(() => {
      result.current.handleMouseUp(makeEvent({ button: 2 }));
    });
    expect(mockSetMode).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CONNECTOR' })
    );
  });

  test('middle-click pan ends on mouseup', () => {
    const { result } = setup();
    act(() => {
      result.current.handleMouseDown(makeEvent({ button: 1 }));
    });
    mockSetMode.mockClear();
    let returned: boolean = false;
    act(() => {
      returned = result.current.handleMouseUp(makeEvent({ button: 1 }));
    });
    expect(returned).toBe(true);
    expect(mockSetMode).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CURSOR' })
    );
  });

  test('right-click without drag on LASSO mode → clears lasso selection', () => {
    mockUiState.mode = {
      type: 'LASSO',
      selection: {
        startTile: { x: 0, y: 0 },
        endTile: { x: 5, y: 5 },
        items: []
      }
    } as any;
    const { result } = setup();
    act(() => {
      result.current.handleMouseDown(makeEvent({ button: 2 }));
    });
    mockSetMode.mockClear();
    act(() => {
      result.current.handleMouseUp(makeEvent({ button: 2 }));
    });
    expect(mockSetMode).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'LASSO', selection: null })
    );
  });
});
