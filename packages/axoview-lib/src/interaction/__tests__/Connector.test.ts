// @ts-nocheck
import { Connector } from '../modes/Connector';

const mockGenerateId = jest.fn(() => 'gen-id');
const mockGetItemAtTile = jest.fn(() => null);
const mockHasMovedTile = jest.fn(() => false);
const mockSetWindowCursor = jest.fn();

jest.mock('src/utils', () => ({
  generateId: () => mockGenerateId(),
  getItemAtTile: (args: unknown) => mockGetItemAtTile(args),
  hasMovedTile: (m: unknown) => mockHasMovedTile(m),
  setWindowCursor: (c: unknown) => mockSetWindowCursor(c)
}));

const mockBeginDragTransaction = jest.fn();
const mockCreateConnector = jest.fn();
const mockCommitDragTransaction = jest.fn();
const mockUpdateConnector = jest.fn();
const mockSetMode = jest.fn();

function makeState(overrides: Record<string, unknown> = {}) {
  return {
    uiState: {
      mode: { type: 'CONNECTOR', id: null, showCursor: true },
      mouse: { position: { tile: { x: 1, y: 1 } } },
      connectorInteractionMode: 'click',
      actions: { setMode: mockSetMode },
      ...(overrides.uiState as object)
    },
    scene: {
      colors: [{ id: 'color-1' }],
      currentView: { connectors: [] },
      beginDragTransaction: mockBeginDragTransaction,
      createConnector: mockCreateConnector,
      commitDragTransaction: mockCommitDragTransaction,
      updateConnector: mockUpdateConnector
    },
    isRendererInteraction: true
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Connector.mousedown — click-mode first press (ADR 0022 addendum)', () => {
  it('arms a free-floating (tile-anchored) connector on empty canvas', () => {
    mockGetItemAtTile.mockReturnValue(null);

    Connector.mousedown?.(makeState() as any);

    // Empty start is allowed: a drag draws a free line; a lone click is reverted
    // on mouseup (the stray-click guard). The press here ARMS a tile-anchored
    // connector and opens the transaction.
    expect(mockBeginDragTransaction).toHaveBeenCalledTimes(1);
    expect(mockCreateConnector).toHaveBeenCalledTimes(1);
    expect(mockSetMode).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CONNECTOR',
        isConnecting: true,
        startAnchor: { tile: { x: 1, y: 1 } }
      })
    );
  });

  it('arms a connector when the first click lands on an ITEM', () => {
    mockGetItemAtTile.mockReturnValue({ type: 'ITEM', id: 'node-1' });

    Connector.mousedown?.(makeState() as any);

    expect(mockBeginDragTransaction).toHaveBeenCalledTimes(1);
    expect(mockCreateConnector).toHaveBeenCalledTimes(1);
    expect(mockSetMode).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CONNECTOR',
        isConnecting: true,
        startAnchor: { itemId: 'node-1' }
      })
    );
  });

  it('does nothing when not a renderer interaction', () => {
    mockGetItemAtTile.mockReturnValue({ type: 'ITEM', id: 'node-1' });

    Connector.mousedown?.({
      ...makeState(),
      isRendererInteraction: false
    } as any);

    expect(mockCreateConnector).not.toHaveBeenCalled();
    expect(mockSetMode).not.toHaveBeenCalled();
  });
});
