// @ts-nocheck
import { TextBox } from '../modes/TextBox';

// Contract test for the TEXTBOX placement mode (arm-then-drop, mirrors
// PlaceIcon). The load-bearing invariant: the arming tap on the Elements deck
// card must NOT create a box — only a real canvas release (or a drag-from-panel
// past tap-slop) does — so pressing `t` then clicking yields EXACTLY ONE box.

const mockGenerateId = jest.fn(() => 'generated-id');
const mockSetWindowCursor = jest.fn();
const mockResolvePlacement = jest.fn(() => ({ tile: { x: 2, y: 3 }, offset: undefined }));
const mockCursorTileResidual = jest.fn();
const mockExceedsTapSlop = jest.fn(() => false);

const mockSetMode = jest.fn();
const mockSetItemControls = jest.fn();
const mockCreateTextBox = jest.fn();

jest.mock('src/utils', () => ({
  generateId: () => mockGenerateId(),
  setWindowCursor: (c: unknown) => mockSetWindowCursor(c)
}));

jest.mock('src/utils/resolvePlacement', () => ({
  resolvePlacement: (...args: unknown[]) => mockResolvePlacement(...args),
  cursorTileResidual: (...args: unknown[]) => mockCursorTileResidual(...args)
}));

jest.mock('src/config', () => ({
  TEXTBOX_DEFAULTS: { text: 'Text' }
}));

jest.mock('src/config/tapGesture', () => ({
  exceedsTapSlop: (a: unknown, b: unknown) => mockExceedsTapSlop(a, b)
}));

function makeUiState(overrides: Record<string, unknown> = {}) {
  return {
    mode: { type: 'TEXTBOX', showCursor: true, id: null },
    mouse: {
      position: { tile: { x: 2, y: 3 }, screen: { x: 100, y: 100 } },
      mousedown: undefined
    },
    snapToGrid: true,
    actions: { setMode: mockSetMode, setItemControls: mockSetItemControls },
    ...overrides
  };
}

function makeScene(overrides: Record<string, unknown> = {}) {
  return { createTextBox: mockCreateTextBox, ...overrides };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockResolvePlacement.mockReturnValue({ tile: { x: 2, y: 3 }, offset: undefined });
  mockExceedsTapSlop.mockReturnValue(false);
});

describe('TextBox.entry / exit', () => {
  it('entry sets the crosshair cursor; exit restores default', () => {
    TextBox.entry?.({ uiState: makeUiState() as any, scene: makeScene() as any });
    expect(mockSetWindowCursor).toHaveBeenCalledWith('crosshair');
    TextBox.exit?.({ uiState: makeUiState() as any, scene: makeScene() as any });
    expect(mockSetWindowCursor).toHaveBeenCalledWith('default');
  });
});

describe('TextBox.mousemove', () => {
  it('is a no-op (placement commits on mouseup, not per-frame)', () => {
    expect(() =>
      TextBox.mousemove?.({
        uiState: makeUiState() as any,
        scene: makeScene() as any,
        isRendererInteraction: true
      })
    ).not.toThrow();
    expect(mockCreateTextBox).not.toHaveBeenCalled();
    expect(mockSetMode).not.toHaveBeenCalled();
  });
});

describe('TextBox.mouseup', () => {
  it('a canvas release creates EXACTLY ONE text box, selects it, and returns to CURSOR', () => {
    TextBox.mouseup?.({
      uiState: makeUiState() as any,
      scene: makeScene() as any,
      isRendererInteraction: true
    });

    expect(mockCreateTextBox).toHaveBeenCalledTimes(1);
    expect(mockCreateTextBox).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'generated-id', tile: { x: 2, y: 3 } })
    );
    expect(mockSetItemControls).toHaveBeenCalledWith({ type: 'TEXTBOX', id: 'generated-id' });
    expect(mockSetMode).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CURSOR', mousedownItem: null })
    );
  });

  it('the arming tap (off-canvas release, no move) ARMS ONLY — no box, no mode change', () => {
    // The regression this pins: press `t` arms TEXTBOX; the arming pointer-up
    // lands off the renderer and didn't move, so it must NOT eager-create a box
    // (else the following canvas click makes a SECOND one — the two-box bug).
    TextBox.mouseup?.({
      uiState: makeUiState() as any,
      scene: makeScene() as any,
      isRendererInteraction: false
    });

    expect(mockCreateTextBox).not.toHaveBeenCalled();
    expect(mockSetMode).not.toHaveBeenCalled();
    expect(mockSetItemControls).not.toHaveBeenCalled();
  });

  it('a drag-from-panel release (off-canvas but past tap-slop) places one box', () => {
    mockExceedsTapSlop.mockReturnValue(true);
    const uiState = makeUiState({
      mouse: {
        position: { tile: { x: 2, y: 3 }, screen: { x: 500, y: 500 } },
        mousedown: { screen: { x: 0, y: 0 } }
      }
    });

    TextBox.mouseup?.({
      uiState: uiState as any,
      scene: makeScene() as any,
      isRendererInteraction: false
    });

    expect(mockCreateTextBox).toHaveBeenCalledTimes(1);
    expect(mockSetMode).toHaveBeenCalledWith(expect.objectContaining({ type: 'CURSOR' }));
  });

  it('does nothing when the mode is not TEXTBOX', () => {
    const uiState = makeUiState({ mode: { type: 'CURSOR', showCursor: true, mousedownItem: null } });

    TextBox.mouseup?.({
      uiState: uiState as any,
      scene: makeScene() as any,
      isRendererInteraction: true
    });

    expect(mockCreateTextBox).not.toHaveBeenCalled();
    expect(mockSetMode).not.toHaveBeenCalled();
  });
});
