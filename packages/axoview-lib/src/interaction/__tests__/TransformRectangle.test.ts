// @ts-nocheck
import { TransformRectangle } from '../modes/Rectangle/TransformRectangle';

const mockGetItemByIdOrThrow = jest.fn();
const mockGetBoundingBox = jest.fn();
const mockConvertBoundsToNamedAnchors = jest.fn();
const mockHasMovedTile = jest.fn(() => false);
const mockUpdateRectangle = jest.fn();
const mockBatchUpdateRectangles = jest.fn();
const mockBeginDragTransaction = jest.fn();
const mockCommitDragTransaction = jest.fn();
const mockSetMode = jest.fn();

jest.mock('src/utils', () => ({
  getItemByIdOrThrow: (items: unknown[], id: string) =>
    mockGetItemByIdOrThrow(items, id),
  getBoundingBox: (coords: unknown[]) => mockGetBoundingBox(coords),
  convertBoundsToNamedAnchors: (bounds: unknown) =>
    mockConvertBoundsToNamedAnchors(bounds),
  hasMovedTile: (mouse: unknown) => mockHasMovedTile(mouse)
}));

const MOCK_RECTANGLE = {
  id: 'rect-1',
  from: { x: 2, y: 2 },
  to: { x: 8, y: 6 }
};

const MOCK_NAMED_BOUNDS = {
  TOP_LEFT: { x: 2, y: 2 },
  TOP_RIGHT: { x: 8, y: 2 },
  BOTTOM_LEFT: { x: 2, y: 6 },
  BOTTOM_RIGHT: { x: 8, y: 6 }
};

function makeUiState(overrides: Record<string, unknown> = {}) {
  return {
    mode: {
      type: 'RECTANGLE.TRANSFORM',
      id: 'rect-1',
      selectedAnchor: null,
      showCursor: true
    },
    mouse: {
      position: { tile: { x: 10, y: 10 } },
      mousedown: null
    },
    actions: { setMode: mockSetMode },
    ...overrides
  };
}

function makeScene(overrides: Record<string, unknown> = {}) {
  return {
    rectangles: [MOCK_RECTANGLE],
    updateRectangle: mockUpdateRectangle,
    batchUpdateRectangles: mockBatchUpdateRectangles,
    beginDragTransaction: mockBeginDragTransaction,
    commitDragTransaction: mockCommitDragTransaction,
    ...overrides
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHasMovedTile.mockReturnValue(false);
  mockGetItemByIdOrThrow.mockReturnValue({ value: MOCK_RECTANGLE, index: 0 });
  mockGetBoundingBox.mockReturnValue([
    MOCK_NAMED_BOUNDS.TOP_LEFT,
    MOCK_NAMED_BOUNDS.BOTTOM_RIGHT
  ]);
  mockConvertBoundsToNamedAnchors.mockReturnValue(MOCK_NAMED_BOUNDS);
});

describe('TransformRectangle.entry / exit', () => {
  it('entry opens a drag transaction (one undo entry for the whole resize)', () => {
    TransformRectangle.entry?.({
      uiState: makeUiState() as any,
      scene: makeScene() as any,
      isRendererInteraction: false
    });
    expect(mockBeginDragTransaction).toHaveBeenCalledTimes(1);
  });

  it('exit commits any open resize transaction (safety net)', () => {
    TransformRectangle.exit?.({
      uiState: makeUiState() as any,
      scene: makeScene() as any,
      isRendererInteraction: false
    });
    expect(mockCommitDragTransaction).toHaveBeenCalledTimes(1);
  });
});

describe('TransformRectangle.mousemove', () => {
  it('does nothing when tile has not moved', () => {
    mockHasMovedTile.mockReturnValue(false);
    const uiState = makeUiState({
      mode: { type: 'RECTANGLE.TRANSFORM', id: 'rect-1', selectedAnchor: 'BOTTOM_RIGHT', showCursor: true }
    });

    TransformRectangle.mousemove?.({ uiState: uiState as any, scene: makeScene() as any, isRendererInteraction: true });

    expect(mockUpdateRectangle).not.toHaveBeenCalled();
  });

  it('does nothing when no anchor is selected', () => {
    mockHasMovedTile.mockReturnValue(true);
    const uiState = makeUiState({
      mode: { type: 'RECTANGLE.TRANSFORM', id: 'rect-1', selectedAnchor: null, showCursor: true }
    });

    TransformRectangle.mousemove?.({ uiState: uiState as any, scene: makeScene() as any, isRendererInteraction: true });

    expect(mockUpdateRectangle).not.toHaveBeenCalled();
  });

  it('does nothing when mode type is not RECTANGLE.TRANSFORM', () => {
    mockHasMovedTile.mockReturnValue(true);
    const uiState = makeUiState({ mode: { type: 'CURSOR', showCursor: true, mousedownItem: null } });

    TransformRectangle.mousemove?.({ uiState: uiState as any, scene: makeScene() as any, isRendererInteraction: true });

    expect(mockUpdateRectangle).not.toHaveBeenCalled();
  });

  it('updates rectangle bounds when BOTTOM_RIGHT anchor is dragged', () => {
    mockHasMovedTile.mockReturnValue(true);
    const nextNamedBounds = {
      TOP_LEFT: { x: 2, y: 2 },
      TOP_RIGHT: { x: 10, y: 2 },
      BOTTOM_LEFT: { x: 2, y: 10 },
      BOTTOM_RIGHT: { x: 10, y: 10 }
    };
    mockConvertBoundsToNamedAnchors
      .mockReturnValueOnce(MOCK_NAMED_BOUNDS) // first call: rectangle current bounds
      .mockReturnValueOnce(nextNamedBounds);  // second call: new bounds after drag

    const uiState = makeUiState({
      mode: { type: 'RECTANGLE.TRANSFORM', id: 'rect-1', selectedAnchor: 'BOTTOM_RIGHT', showCursor: true },
      mouse: { position: { tile: { x: 10, y: 10 } }, mousedown: null }
    });

    TransformRectangle.mousemove?.({ uiState: uiState as any, scene: makeScene() as any, isRendererInteraction: true });

    expect(mockBatchUpdateRectangles).toHaveBeenCalledWith([
      { id: 'rect-1', from: nextNamedBounds.TOP_LEFT, to: nextNamedBounds.BOTTOM_RIGHT }
    ]);
    expect(mockUpdateRectangle).not.toHaveBeenCalled();
  });

  it('updates rectangle bounds when BOTTOM_LEFT anchor is dragged', () => {
    mockHasMovedTile.mockReturnValue(true);
    const nextNamedBounds = {
      TOP_LEFT: { x: 1, y: 2 },
      TOP_RIGHT: { x: 8, y: 2 },
      BOTTOM_LEFT: { x: 1, y: 10 },
      BOTTOM_RIGHT: { x: 8, y: 10 }
    };
    mockConvertBoundsToNamedAnchors
      .mockReturnValueOnce(MOCK_NAMED_BOUNDS)
      .mockReturnValueOnce(nextNamedBounds);

    const uiState = makeUiState({
      mode: { type: 'RECTANGLE.TRANSFORM', id: 'rect-1', selectedAnchor: 'BOTTOM_LEFT', showCursor: true },
      mouse: { position: { tile: { x: 1, y: 10 } }, mousedown: null }
    });

    TransformRectangle.mousemove?.({ uiState: uiState as any, scene: makeScene() as any, isRendererInteraction: true });

    expect(mockBatchUpdateRectangles).toHaveBeenCalledWith([
      { id: 'rect-1', from: nextNamedBounds.TOP_RIGHT, to: nextNamedBounds.BOTTOM_LEFT }
    ]);
    expect(mockUpdateRectangle).not.toHaveBeenCalled();
  });
});

describe('TransformRectangle.mousedown', () => {
  it('is a no-op (handled by TransformAnchor component)', () => {
    expect(() => TransformRectangle.mousedown?.({
      uiState: makeUiState() as any,
      scene: makeScene() as any,
      isRendererInteraction: true
    })).not.toThrow();
    expect(mockSetMode).not.toHaveBeenCalled();
  });
});

describe('TransformRectangle.mouseup', () => {
  it('transitions to CURSOR mode', () => {
    const uiState = makeUiState();

    TransformRectangle.mouseup?.({ uiState: uiState as any, scene: makeScene() as any, isRendererInteraction: false });

    expect(mockCommitDragTransaction).toHaveBeenCalledTimes(1);
    expect(mockSetMode).toHaveBeenCalledWith({
      type: 'CURSOR',
      mousedownItem: null,
      showCursor: true
    });
  });

  it('does nothing when mode type is not RECTANGLE.TRANSFORM', () => {
    const uiState = makeUiState({ mode: { type: 'CURSOR', showCursor: true, mousedownItem: null } });

    TransformRectangle.mouseup?.({ uiState: uiState as any, scene: makeScene() as any, isRendererInteraction: false });

    expect(mockSetMode).not.toHaveBeenCalled();
  });
});
