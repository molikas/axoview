// @ts-nocheck
import { handleArrowKey } from '../handleArrowKey';

// Keep the module dependency-light: handleArrowKey only needs CoordsUtils.add.
jest.mock('src/utils', () => ({
  CoordsUtils: {
    add: (a: { x: number; y: number }, b: { x: number; y: number }) => ({
      x: a.x + b.x,
      y: a.y + b.y
    })
  }
}));

const makeKey = (key: string) => ({ key, preventDefault: jest.fn() });

function makeUiState(overrides = {}) {
  return {
    selectedIds: [],
    scroll: { position: { x: 0, y: 0 }, offset: { x: 0, y: 0 } },
    actions: { setScroll: jest.fn() },
    ...overrides
  };
}

function makeDeps(scene = {}) {
  return {
    getScene: () => ({ items: [], rectangles: [], textBoxes: [], ...scene }),
    beginDragTransaction: jest.fn(),
    commitDragTransaction: jest.fn(),
    batchUpdateViewItemTiles: jest.fn(),
    batchUpdateRectangles: jest.fn(),
    batchUpdateTextBoxTiles: jest.fn()
  };
}

describe('handleArrowKey — selection-aware nudge vs pan (B6)', () => {
  it('pans when nothing nudge-able is selected', () => {
    const uiState = makeUiState();
    const deps = makeDeps();
    expect(handleArrowKey(makeKey('ArrowRight'), uiState, deps)).toBe(true);
    expect(uiState.actions.setScroll).toHaveBeenCalledTimes(1);
    expect(deps.beginDragTransaction).not.toHaveBeenCalled();
    expect(deps.batchUpdateViewItemTiles).not.toHaveBeenCalled();
  });

  it('nudges a selected ITEM one tile in a single transaction (no pan)', () => {
    const uiState = makeUiState({ selectedIds: [{ type: 'ITEM', id: 'n1' }] });
    const deps = makeDeps({ items: [{ id: 'n1', tile: { x: 5, y: 5 } }] });

    expect(handleArrowKey(makeKey('ArrowRight'), uiState, deps)).toBe(true);

    expect(deps.beginDragTransaction).toHaveBeenCalledTimes(1);
    // ArrowRight → dx +1
    expect(deps.batchUpdateViewItemTiles).toHaveBeenCalledWith([
      { id: 'n1', tile: { x: 6, y: 5 } }
    ]);
    expect(deps.commitDragTransaction).toHaveBeenCalledTimes(1);
    expect(uiState.actions.setScroll).not.toHaveBeenCalled();
  });

  it('nudges rectangles and text boxes too', () => {
    const uiState = makeUiState({
      selectedIds: [
        { type: 'RECTANGLE', id: 'r1' },
        { type: 'TEXTBOX', id: 't1' }
      ]
    });
    const deps = makeDeps({
      rectangles: [{ id: 'r1', from: { x: 0, y: 0 }, to: { x: 2, y: 2 } }],
      textBoxes: [{ id: 't1', tile: { x: 3, y: 3 } }]
    });

    // ArrowDown → dy -1
    handleArrowKey(makeKey('ArrowDown'), uiState, deps);

    expect(deps.batchUpdateRectangles).toHaveBeenCalledWith([
      { id: 'r1', from: { x: 0, y: -1 }, to: { x: 2, y: 1 } }
    ]);
    expect(deps.batchUpdateTextBoxTiles).toHaveBeenCalledWith([
      { id: 't1', tile: { x: 3, y: 2 } }
    ]);
    expect(uiState.actions.setScroll).not.toHaveBeenCalled();
  });

  it('pans when only connectors/anchors are selected (not tile-nudge-able)', () => {
    const uiState = makeUiState({
      selectedIds: [{ type: 'CONNECTOR', id: 'c1' }]
    });
    const deps = makeDeps();

    handleArrowKey(makeKey('ArrowUp'), uiState, deps);

    expect(uiState.actions.setScroll).toHaveBeenCalledTimes(1);
    expect(deps.beginDragTransaction).not.toHaveBeenCalled();
  });

  it('returns false for a non-arrow key (not consumed)', () => {
    const uiState = makeUiState();
    expect(handleArrowKey(makeKey('a'), uiState, makeDeps())).toBe(false);
    expect(uiState.actions.setScroll).not.toHaveBeenCalled();
  });
});
