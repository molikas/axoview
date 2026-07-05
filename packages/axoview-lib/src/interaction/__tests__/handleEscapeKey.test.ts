// @ts-nocheck
import { handleEscapeKey, handleConnectorEscape } from '../handleEscapeKey';

const makeEsc = () => ({ key: 'Escape', preventDefault: jest.fn() });

function makeUiState(overrides = {}) {
  return {
    mode: { type: 'CURSOR' },
    connectorInteractionMode: 'click',
    itemControls: null,
    selectedIds: [],
    actions: {
      setMode: jest.fn(),
      setItemControls: jest.fn(),
      clearSelection: jest.fn()
    },
    ...overrides
  };
}

const makeDeps = () => ({
  deleteConnector: jest.fn(),
  commitDragTransaction: jest.fn()
});

describe('handleEscapeKey — connector-abort priority (B2 / Decision #3)', () => {
  it('aborts an in-flight connector BEFORE clearing a lingering selection', () => {
    // The bug: the action-bar "Add connection" path leaves the source node in
    // selectedIds, so the first Esc cleared the selection and stranded the
    // orphan connector. Connector-abort must win.
    const uiState = makeUiState({
      mode: { type: 'CONNECTOR', id: 'c1', isConnecting: true },
      selectedIds: [{ type: 'ITEM', id: 'node-1' }]
    });
    const deps = makeDeps();

    const handled = handleEscapeKey(makeEsc(), uiState, deps);

    expect(handled).toBe(true);
    expect(deps.deleteConnector).toHaveBeenCalledWith('c1');
    expect(deps.commitDragTransaction).toHaveBeenCalledTimes(1);
    expect(uiState.actions.setMode).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CONNECTOR', id: null, isConnecting: false })
    );
    // The lingering selection is NOT cleared by this Esc — connector won first.
    expect(uiState.actions.clearSelection).not.toHaveBeenCalled();
  });

  it('aborts a drag-mode connection in progress', () => {
    const uiState = makeUiState({
      mode: { type: 'CONNECTOR', id: 'c2', isConnecting: false },
      connectorInteractionMode: 'drag'
    });
    const deps = makeDeps();

    expect(handleConnectorEscape(uiState, deps)).toBe(true);
    expect(deps.deleteConnector).toHaveBeenCalledWith('c2');
  });

  it('clears the panel first when no connector is in progress', () => {
    const uiState = makeUiState({ itemControls: { type: 'ITEM', id: 'n1' } });
    const deps = makeDeps();

    handleEscapeKey(makeEsc(), uiState, deps);

    expect(uiState.actions.setItemControls).toHaveBeenCalledWith(null);
    expect(deps.deleteConnector).not.toHaveBeenCalled();
    expect(uiState.actions.clearSelection).not.toHaveBeenCalled();
  });

  it('clears a multi-selection when no connector and no panel', () => {
    const uiState = makeUiState({
      selectedIds: [
        { type: 'ITEM', id: 'a' },
        { type: 'ITEM', id: 'b' }
      ]
    });
    const deps = makeDeps();

    handleEscapeKey(makeEsc(), uiState, deps);

    expect(uiState.actions.clearSelection).toHaveBeenCalledTimes(1);
  });

  it('does NOT abort when CONNECTOR mode is idle (not connecting)', () => {
    const uiState = makeUiState({
      mode: { type: 'CONNECTOR', id: null, isConnecting: false }
    });
    const deps = makeDeps();

    expect(handleConnectorEscape(uiState, deps)).toBe(false);
    expect(deps.deleteConnector).not.toHaveBeenCalled();
  });

  it('returns false (and does nothing) for a non-Escape key', () => {
    const uiState = makeUiState();
    const result = handleEscapeKey(
      { key: 'a', preventDefault: jest.fn() },
      uiState,
      makeDeps()
    );
    expect(result).toBe(false);
    expect(uiState.actions.clearSelection).not.toHaveBeenCalled();
  });
});

describe('handleEscapeKey — returns from a tool mode to Select (F-01)', () => {
  it('exits idle CONNECTOR mode to CURSOR (reported bug: drew a connector, Esc did nothing)', () => {
    const uiState = makeUiState({
      mode: { type: 'CONNECTOR', id: null, isConnecting: false }
    });
    const deps = makeDeps();

    const handled = handleEscapeKey(makeEsc(), uiState, deps);

    expect(handled).toBe(true);
    expect(deps.deleteConnector).not.toHaveBeenCalled(); // nothing in progress to abort
    expect(uiState.actions.setMode).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CURSOR' })
    );
  });

  it.each([
    'PLACE_ICON',
    'RECTANGLE.DRAW',
    'TEXTBOX',
    'LABEL',
    'LASSO',
    'FREEHAND_LASSO',
    'PAN'
  ])('exits %s tool mode to CURSOR', (type) => {
    const uiState = makeUiState({ mode: { type } });

    handleEscapeKey(makeEsc(), uiState, makeDeps());

    expect(uiState.actions.setMode).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CURSOR' })
    );
  });

  it('does NOT force-exit the transient DRAG_ITEMS mode (it owns its own abort)', () => {
    const uiState = makeUiState({
      mode: { type: 'DRAG_ITEMS' },
      selectedIds: [{ type: 'ITEM', id: 'a' }]
    });

    handleEscapeKey(makeEsc(), uiState, makeDeps());

    expect(uiState.actions.setMode).not.toHaveBeenCalled();
    // Falls through to the selection-clear branch instead.
    expect(uiState.actions.clearSelection).toHaveBeenCalledTimes(1);
  });

  it('tool-mode exit wins over clearing a lingering selection (two Esc to fully reset)', () => {
    const uiState = makeUiState({
      mode: { type: 'CONNECTOR', id: null, isConnecting: false },
      selectedIds: [{ type: 'ITEM', id: 'n1' }]
    });

    handleEscapeKey(makeEsc(), uiState, makeDeps());

    expect(uiState.actions.setMode).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CURSOR' })
    );
    expect(uiState.actions.clearSelection).not.toHaveBeenCalled();
  });
});
