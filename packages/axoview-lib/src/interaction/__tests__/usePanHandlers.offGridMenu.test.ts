/**
 * INVARIANT — right-click resolves its target where the item is DRAWN.
 *
 * Why this exists: bug #6 of the ADR 0023 off-grid cluster. Right-clicking an
 * item that had been nudged off its grid cell opened the CANVAS menu, because
 * the target was resolved from the rounded mouse tile instead of the cursor's
 * SceneLayer point. This test drives the REAL `getItemAtTile` (the sibling
 * `usePanHandlers.test.ts` stubs it, so it cannot see this class of bug) with a
 * real off-grid scene and real viewport state.
 *
 * The pairing is the point: the same node, the same rounded tile — cursor on
 * the drawn body → ITEM menu; cursor a tile away on bare grid → CANVAS menu.
 */

import { renderHook, act } from '@testing-library/react';
import { UNPROJECTED_TILE_SIZE } from 'src/config';
import { getStrategy } from 'src/utils/coordinateTransforms';
import type { Coords } from 'src/types';
import { usePanHandlers } from '../usePanHandlers';

// The off-grid node: tile (4,4), nudged nearly a whole tile to the left. This is
// the shape of the reported case — a residual big enough that the drawn body and
// the bare cell no longer overlap.
const NODE_TILE: Coords = { x: 4, y: 4 };
const NODE_OFFSET: Coords = { x: -120, y: -30 };

const RENDERER_SIZE = { width: 1000, height: 800 };
const SCROLL = { position: { x: 0, y: 0 }, offset: { x: 0, y: 0 } };

/** Screen coords for a SceneLayer point, at zoom 1 with no scroll. */
const screenFor = (point: Coords): Coords => ({
  x: point.x + RENDERER_SIZE.width * 0.5,
  y: point.y + RENDERER_SIZE.height * 0.5
});

const mockOpenContextMenu = jest.fn();
const mockUiState = {
  canvasMode: 'ISOMETRIC' as const,
  zoom: 1,
  scroll: SCROLL,
  rendererSize: RENDERER_SIZE,
  mode: { type: 'CURSOR' as string, selection: null as unknown },
  selectedIds: [] as Array<{ type: string; id: string }>,
  rendererEl: null as EventTarget | null,
  mouse: {
    position: {
      tile: { x: 0, y: 0 } as Coords,
      screen: { x: 0, y: 0 } as Coords
    }
  },
  actions: {
    setMode: jest.fn(),
    setItemControls: jest.fn(),
    setMouse: jest.fn(),
    setSelectedIds: jest.fn(),
    openContextMenu: mockOpenContextMenu
  }
};

jest.mock('src/stores/uiStateStore', () => ({
  useUiStateStore: (selector: (s: typeof mockUiState) => unknown) =>
    selector(mockUiState),
  useUiStateStoreApi: () => ({ getState: () => mockUiState })
}));

// The REAL hit test — that is the whole point of this file.
jest.mock('src/utils', () => ({
  getItemAtTile: jest.requireActual('src/utils/hitDetection').getItemAtTile,
  setWindowCursor: () => {},
  CoordsUtils: { zero: () => ({ x: 0, y: 0 }) }
}));

jest.mock('src/hooks/useScene', () => ({
  useScene: () => ({
    items: [{ id: 'offgrid', tile: NODE_TILE, offset: NODE_OFFSET }],
    connectors: [],
    rectangles: [],
    textBoxes: [],
    hitConnectors: [],
    deleteConnector: jest.fn(),
    commitDragTransaction: jest.fn()
  })
}));

jest.mock('src/hooks/useLayerContext', () => ({
  useLayerContext: () => ({
    lockedIds: new Set<string>(),
    visibleIds: new Set<string>(),
    // No layers configured → the interactable check's escape hatch keys off
    // `layers.length === 0` (added by #81), so the item stays interactable.
    layers: []
  })
}));

const rendererNode = document.createElement('div');
const rendererChild = document.createElement('div');
rendererNode.appendChild(rendererChild);

const rightEvent = (screen: Coords, type: string) => ({
  button: 2,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  type,
  target: rendererChild as EventTarget,
  clientX: screen.x,
  clientY: screen.y,
  preventDefault: jest.fn()
});

/** Right-tap (down then up, no drag) at a SceneLayer point sitting on `tile`. */
const rightTapAt = (point: Coords, roundedTile: Coords) => {
  const screen = screenFor(point);
  mockUiState.mouse.position.tile = roundedTile;
  mockUiState.mouse.position.screen = screen;
  const { result } = renderHook(() => usePanHandlers());
  act(() => {
    result.current.handleMouseDown(rightEvent(screen, 'mousedown') as never);
  });
  act(() => {
    result.current.handleMouseUp(rightEvent(screen, 'mouseup') as never);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUiState.mode = { type: 'CURSOR', selection: null };
  mockUiState.selectedIds = [];
  mockUiState.rendererEl = rendererNode as EventTarget;
});

describe('usePanHandlers right-tap target — off-grid items (ADR 0023 bug #6)', () => {
  const strategy = getStrategy('ISOMETRIC');
  const bareCentre = strategy.toScreen(
    NODE_TILE.x,
    NODE_TILE.y,
    UNPROJECTED_TILE_SIZE
  );
  const drawnCentre = {
    x: bareCentre.x + NODE_OFFSET.x,
    y: bareCentre.y + NODE_OFFSET.y
  };

  it('opens the ITEM menu when the cursor is on the DRAWN body', () => {
    // The rounded mouse tile under the drawn body is NOT the node's tile — that
    // mismatch is exactly what broke this before the px hit test.
    const roundedTile = strategy.fromScreen(
      screenFor(drawnCentre).x,
      screenFor(drawnCentre).y,
      UNPROJECTED_TILE_SIZE,
      1,
      SCROLL,
      RENDERER_SIZE
    );
    expect(roundedTile).not.toEqual(NODE_TILE);

    rightTapAt(drawnCentre, roundedTile);

    expect(mockOpenContextMenu).toHaveBeenCalledTimes(1);
    expect(mockOpenContextMenu.mock.calls[0][0]).toMatchObject({
      variant: 'item',
      target: { type: 'ITEM', id: 'offgrid' }
    });
  });

  it('opens the CANVAS menu on the bare grid cell the node has left', () => {
    rightTapAt(bareCentre, NODE_TILE);

    expect(mockOpenContextMenu).toHaveBeenCalledTimes(1);
    expect(mockOpenContextMenu.mock.calls[0][0]).toMatchObject({
      variant: 'canvas',
      target: null
    });
  });
});
