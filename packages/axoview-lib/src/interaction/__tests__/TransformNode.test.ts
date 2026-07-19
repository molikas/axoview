// @ts-nocheck
import { TransformNode } from '../modes/Node/TransformNode';
import { PROJECTED_TILE_SIZE } from 'src/config';

// The reducer is pure logic over uiState.mouse + the mode's startScale — no utils
// to mock. It previews via setIconScaleDrag (no per-frame model write) and
// commits once via scene.updateViewItem on release. ADR 0044.

const mockSetIconScaleDrag = jest.fn();
const mockClearIconScaleDrag = jest.fn();
const mockSetMode = jest.fn();
const mockUpdateViewItem = jest.fn();

// Must match the constant in TransformNode.ts.
const REF = PROJECTED_TILE_SIZE.width / 2;

function makeUiState(overrides: Record<string, unknown> = {}) {
  return {
    mode: {
      type: 'NODE.TRANSFORM',
      id: 'node-1',
      selectedAnchor: 'BOTTOM_RIGHT',
      startScale: 1,
      showCursor: true
    },
    zoom: 1,
    iconScaleDrag: null,
    mouse: {
      position: { screen: { x: 0, y: 0 }, tile: { x: 0, y: 0 } },
      mousedown: { screen: { x: 0, y: 0 }, tile: { x: 0, y: 0 } }
    },
    actions: {
      setIconScaleDrag: mockSetIconScaleDrag,
      clearIconScaleDrag: mockClearIconScaleDrag,
      setMode: mockSetMode
    },
    ...overrides
  };
}

function makeScene(overrides: Record<string, unknown> = {}) {
  return { updateViewItem: mockUpdateViewItem, ...overrides };
}

const dragTo = (screen: { x: number; y: number }, ui = {}) =>
  makeUiState({
    mouse: {
      position: { screen, tile: { x: 0, y: 0 } },
      mousedown: { screen: { x: 0, y: 0 }, tile: { x: 0, y: 0 } }
    },
    ...ui
  });

beforeEach(() => jest.clearAllMocks());

describe('TransformNode.mousemove — drag → scale (ADR 0044)', () => {
  it('enlarges when a corner is dragged away from the centre', () => {
    TransformNode.mousemove?.({ uiState: dragTo({ x: 20, y: 20 }) as any, scene: makeScene() as any });
    expect(mockSetIconScaleDrag).toHaveBeenCalledTimes(1);
    const [id, scale] = mockSetIconScaleDrag.mock.calls[0];
    expect(id).toBe('node-1');
    const outward = (20 + 20) / Math.SQRT2;
    expect(scale).toBeCloseTo(1 + outward / REF, 5);
    expect(scale).toBeGreaterThan(1);
  });

  it('shrinks when a corner is dragged toward the centre', () => {
    const ui = dragTo(
      { x: -30, y: -30 },
      { mode: { type: 'NODE.TRANSFORM', id: 'node-1', selectedAnchor: 'BOTTOM_RIGHT', startScale: 2, showCursor: true } }
    );
    TransformNode.mousemove?.({ uiState: ui as any, scene: makeScene() as any });
    expect(mockSetIconScaleDrag.mock.calls[0][1]).toBeLessThan(2);
  });

  it('TOP_LEFT enlarges when dragged up-and-left (per-corner outward sign)', () => {
    const ui = dragTo(
      { x: -20, y: -20 },
      { mode: { type: 'NODE.TRANSFORM', id: 'node-1', selectedAnchor: 'TOP_LEFT', startScale: 1, showCursor: true } }
    );
    TransformNode.mousemove?.({ uiState: ui as any, scene: makeScene() as any });
    expect(mockSetIconScaleDrag.mock.calls[0][1]).toBeGreaterThan(1);
  });

  it('clamps to the max (2.5) on a large outward drag', () => {
    TransformNode.mousemove?.({ uiState: dragTo({ x: 1000, y: 1000 }) as any, scene: makeScene() as any });
    expect(mockSetIconScaleDrag.mock.calls[0][1]).toBe(2.5);
  });

  it('clamps to the min (0.3) on a large inward drag', () => {
    TransformNode.mousemove?.({ uiState: dragTo({ x: -1000, y: -1000 }) as any, scene: makeScene() as any });
    expect(mockSetIconScaleDrag.mock.calls[0][1]).toBe(0.3);
  });

  it('is projection-safe via 1/zoom — half the zoom doubles the scale delta', () => {
    TransformNode.mousemove?.({ uiState: dragTo({ x: 20, y: 20 }) as any, scene: makeScene() as any });
    const deltaAt1 = mockSetIconScaleDrag.mock.calls[0][1] - 1;
    jest.clearAllMocks();
    TransformNode.mousemove?.({ uiState: dragTo({ x: 20, y: 20 }, { zoom: 0.5 }) as any, scene: makeScene() as any });
    const deltaAtHalf = mockSetIconScaleDrag.mock.calls[0][1] - 1;
    expect(deltaAtHalf).toBeCloseTo(deltaAt1 * 2, 5);
  });

  it('does NOT write the model during the drag (preview only)', () => {
    TransformNode.mousemove?.({ uiState: dragTo({ x: 20, y: 20 }) as any, scene: makeScene() as any });
    expect(mockUpdateViewItem).not.toHaveBeenCalled();
  });

  it('no-ops when mode is not NODE.TRANSFORM', () => {
    TransformNode.mousemove?.({
      uiState: makeUiState({ mode: { type: 'CURSOR', showCursor: true, mousedownItem: null } }) as any,
      scene: makeScene() as any
    });
    expect(mockSetIconScaleDrag).not.toHaveBeenCalled();
  });

  it('no-ops when no anchor is selected', () => {
    TransformNode.mousemove?.({
      uiState: makeUiState({ mode: { type: 'NODE.TRANSFORM', id: 'node-1', selectedAnchor: null, startScale: 1, showCursor: true } }) as any,
      scene: makeScene() as any
    });
    expect(mockSetIconScaleDrag).not.toHaveBeenCalled();
  });

  it('no-ops when there is no mousedown', () => {
    TransformNode.mousemove?.({
      uiState: makeUiState({ mouse: { position: { screen: { x: 20, y: 20 }, tile: { x: 0, y: 0 } }, mousedown: null } }) as any,
      scene: makeScene() as any
    });
    expect(mockSetIconScaleDrag).not.toHaveBeenCalled();
  });
});

describe('TransformNode.mouseup — commit once (ADR 0044)', () => {
  it('commits the previewed scale as ONE updateViewItem, clears the preview, returns to CURSOR', () => {
    const uiState = makeUiState({ iconScaleDrag: { id: 'node-1', scale: 1.8 } });
    TransformNode.mouseup?.({ uiState: uiState as any, scene: makeScene() as any });
    expect(mockUpdateViewItem).toHaveBeenCalledTimes(1);
    expect(mockUpdateViewItem).toHaveBeenCalledWith('node-1', { iconScale: 1.8 });
    expect(mockClearIconScaleDrag).toHaveBeenCalledTimes(1);
    expect(mockSetMode).toHaveBeenCalledWith({ type: 'CURSOR', mousedownItem: null, showCursor: true });
  });

  it('a click without a drag (no preview) writes nothing but still returns to CURSOR', () => {
    TransformNode.mouseup?.({ uiState: makeUiState({ iconScaleDrag: null }) as any, scene: makeScene() as any });
    expect(mockUpdateViewItem).not.toHaveBeenCalled();
    expect(mockSetMode).toHaveBeenCalledWith({ type: 'CURSOR', mousedownItem: null, showCursor: true });
  });

  it('does nothing when mode is not NODE.TRANSFORM', () => {
    const uiState = makeUiState({
      mode: { type: 'CURSOR', showCursor: true, mousedownItem: null },
      iconScaleDrag: { id: 'node-1', scale: 1.5 }
    });
    TransformNode.mouseup?.({ uiState: uiState as any, scene: makeScene() as any });
    expect(mockUpdateViewItem).not.toHaveBeenCalled();
    expect(mockSetMode).not.toHaveBeenCalled();
  });
});

describe('TransformNode.exit / mousedown', () => {
  it('exit commits a still-pending preview (safety net) and clears it', () => {
    const uiState = makeUiState({ iconScaleDrag: { id: 'node-1', scale: 1.6 } });
    TransformNode.exit?.({ uiState: uiState as any, scene: makeScene() as any });
    expect(mockUpdateViewItem).toHaveBeenCalledWith('node-1', { iconScale: 1.6 });
    expect(mockClearIconScaleDrag).toHaveBeenCalledTimes(1);
  });

  it('exit after a normal mouseup is a no-op (preview already cleared)', () => {
    TransformNode.exit?.({ uiState: makeUiState({ iconScaleDrag: null }) as any, scene: makeScene() as any });
    expect(mockUpdateViewItem).not.toHaveBeenCalled();
  });

  it('mousedown is a no-op (the handle press already set the mode)', () => {
    expect(() =>
      TransformNode.mousedown?.({ uiState: makeUiState() as any, scene: makeScene() as any })
    ).not.toThrow();
    expect(mockSetMode).not.toHaveBeenCalled();
  });
});
