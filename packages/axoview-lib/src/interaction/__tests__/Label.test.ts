// @ts-nocheck
import { Label } from '../modes/Label';

// Contract test for the LABEL placement mode (floating Label, ADR 0031). Same
// arm-then-drop invariant as TextBox/PlaceIcon: the arming tap on the Common
// deck card must NOT create a Label — only a real canvas release (or a
// drag-from-panel past tap-slop) does. Placement selects the Label WITHOUT
// opening the Details deck (owner 2026-07-02, openPanel:false).

const mockGenerateId = jest.fn(() => 'generated-id');
const mockSetWindowCursor = jest.fn();
const mockResolvePlacement = jest.fn(() => ({ tile: { x: 2, y: 3 }, offset: undefined }));
const mockCursorTileResidual = jest.fn();
const mockExceedsTapSlop = jest.fn(() => false);

const mockSetMode = jest.fn();
const mockSetItemControls = jest.fn();
const mockCreateLabel = jest.fn();

jest.mock('src/utils', () => ({
  generateId: () => mockGenerateId(),
  setWindowCursor: (c: unknown) => mockSetWindowCursor(c)
}));

jest.mock('src/utils/resolvePlacement', () => ({
  resolvePlacement: (...args: unknown[]) => mockResolvePlacement(...args),
  cursorTileResidual: (...args: unknown[]) => mockCursorTileResidual(...args)
}));

jest.mock('src/config', () => ({
  LABEL_DEFAULTS: { text: 'Label' }
}));

jest.mock('src/config/tapGesture', () => ({
  exceedsTapSlop: (a: unknown, b: unknown) => mockExceedsTapSlop(a, b)
}));

function makeUiState(overrides: Record<string, unknown> = {}) {
  return {
    mode: { type: 'LABEL', showCursor: true, id: null },
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
  return { createLabel: mockCreateLabel, ...overrides };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockResolvePlacement.mockReturnValue({ tile: { x: 2, y: 3 }, offset: undefined });
  mockExceedsTapSlop.mockReturnValue(false);
});

describe('Label.entry / exit', () => {
  it('entry sets the crosshair cursor; exit restores default', () => {
    Label.entry?.({ uiState: makeUiState() as any, scene: makeScene() as any });
    expect(mockSetWindowCursor).toHaveBeenCalledWith('crosshair');
    Label.exit?.({ uiState: makeUiState() as any, scene: makeScene() as any });
    expect(mockSetWindowCursor).toHaveBeenCalledWith('default');
  });
});

describe('Label.mousemove', () => {
  it('is a no-op (placement commits on mouseup, not per-frame)', () => {
    expect(() =>
      Label.mousemove?.({
        uiState: makeUiState() as any,
        scene: makeScene() as any,
        isRendererInteraction: true
      })
    ).not.toThrow();
    expect(mockCreateLabel).not.toHaveBeenCalled();
    expect(mockSetMode).not.toHaveBeenCalled();
  });
});

describe('Label.mouseup', () => {
  it('a canvas release creates EXACTLY ONE Label, selects it without opening the panel, and returns to CURSOR', () => {
    Label.mouseup?.({
      uiState: makeUiState() as any,
      scene: makeScene() as any,
      isRendererInteraction: true
    });

    expect(mockCreateLabel).toHaveBeenCalledTimes(1);
    expect(mockCreateLabel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'generated-id', tile: { x: 2, y: 3 } })
    );
    // select-only: sets the target but does NOT auto-open the Details deck.
    expect(mockSetItemControls).toHaveBeenCalledWith(
      { type: 'LABEL', id: 'generated-id' },
      { openPanel: false }
    );
    expect(mockSetMode).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CURSOR', mousedownItem: null })
    );
  });

  it('the arming tap (off-canvas release, no move) ARMS ONLY — no Label, no mode change', () => {
    Label.mouseup?.({
      uiState: makeUiState() as any,
      scene: makeScene() as any,
      isRendererInteraction: false
    });

    expect(mockCreateLabel).not.toHaveBeenCalled();
    expect(mockSetMode).not.toHaveBeenCalled();
    expect(mockSetItemControls).not.toHaveBeenCalled();
  });

  it('a drag-from-panel release (off-canvas but past tap-slop) places one Label', () => {
    mockExceedsTapSlop.mockReturnValue(true);
    const uiState = makeUiState({
      mouse: {
        position: { tile: { x: 2, y: 3 }, screen: { x: 500, y: 500 } },
        mousedown: { screen: { x: 0, y: 0 } }
      }
    });

    Label.mouseup?.({
      uiState: uiState as any,
      scene: makeScene() as any,
      isRendererInteraction: false
    });

    expect(mockCreateLabel).toHaveBeenCalledTimes(1);
    expect(mockSetMode).toHaveBeenCalledWith(expect.objectContaining({ type: 'CURSOR' }));
  });

  it('does nothing when the mode is not LABEL', () => {
    const uiState = makeUiState({ mode: { type: 'CURSOR', showCursor: true, mousedownItem: null } });

    Label.mouseup?.({
      uiState: uiState as any,
      scene: makeScene() as any,
      isRendererInteraction: true
    });

    expect(mockCreateLabel).not.toHaveBeenCalled();
    expect(mockSetMode).not.toHaveBeenCalled();
  });
});
