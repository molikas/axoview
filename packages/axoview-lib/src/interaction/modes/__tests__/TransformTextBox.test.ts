/**
 * TEXTBOX.TRANSFORM — rectangle-style text-box resize (ADR 0034 addenda
 * 2026-07-03/04). Pins:
 *   - the transaction choreography (entry opens, mouseup/exit commit — one
 *     undo entry per resize, mirroring RECTANGLE.TRANSFORM),
 *   - the anchor→axis mapping per orientation: run-axis anchors write
 *     `width` (wrap width), row-axis anchors write `height` (minimum box
 *     height), corners write both; near-edge drags move the tile so the far
 *     edge stays put,
 *   - the 1-tile floors and the no-op guard,
 *   - that an edge drag never writes the OTHER axis (a height drag must not
 *     freeze an auto width).
 */

import { TransformTextBox } from 'src/interaction/modes/TransformTextBox';

function makeScene(overrides: any = {}) {
  return {
    textBoxes: overrides.textBoxes ?? [],
    beginDragTransaction: jest.fn(),
    commitDragTransaction: jest.fn(),
    updateTextBox: jest.fn(),
    ...overrides
  };
}

function makeUiState(overrides: any = {}) {
  return {
    mode: overrides.mode,
    mouse: overrides.mouse ?? {
      position: { tile: { x: 4, y: 0 } },
      mousedown: { tile: { x: 1, y: 0 } },
      delta: { tile: { x: 1, y: 0 } }
    },
    actions: { setMode: jest.fn(), ...overrides.actions }
  };
}

const tb = (overrides: any = {}) => ({
  id: 'tb1',
  tile: { x: 0, y: 0 },
  orientation: 'X',
  size: { width: 1, height: 1 },
  ...overrides
});

const mode = (selectedAnchor: string) => ({
  type: 'TEXTBOX.TRANSFORM',
  showCursor: true,
  id: 'tb1',
  selectedAnchor
});

const move = (scene: any, anchor: string, mouseTile: { x: number; y: number }) =>
  TransformTextBox.mousemove!({
    uiState: makeUiState({
      mode: mode(anchor),
      mouse: { position: { tile: mouseTile } }
    }),
    scene
  } as any);

describe('TransformTextBox — rectangle-style resize', () => {
  beforeEach(() => jest.clearAllMocks());

  it('entry opens a drag transaction; exit commits it (abandon safety net)', () => {
    const scene = makeScene();
    TransformTextBox.entry!({ scene } as any);
    expect(scene.beginDragTransaction).toHaveBeenCalledTimes(1);
    TransformTextBox.exit!({ scene } as any);
    expect(scene.commitDragTransaction).toHaveBeenCalledTimes(1);
  });

  describe('orientation X (run along +x, rows along −y)', () => {
    it('RIGHT: width follows the mouse tile; height untouched', () => {
      const scene = makeScene({ textBoxes: [tb()] });
      move(scene, 'RIGHT', { x: 4, y: 0 });
      expect(scene.updateTextBox).toHaveBeenCalledWith('tb1', {
        width: 4,
        tile: { x: 0, y: 0 }
      });
    });

    it('LEFT: tile moves so the far edge stays put', () => {
      const scene = makeScene({
        textBoxes: [tb({ tile: { x: 2, y: 3 }, size: { width: 2, height: 1 } })]
      });
      move(scene, 'LEFT', { x: 0, y: 3 });
      // Far edge was at x = 4; near edge to x = 0 → width 4, tile follows.
      expect(scene.updateTextBox).toHaveBeenCalledWith('tb1', {
        width: 4,
        tile: { x: 0, y: 3 }
      });
    });

    it('BOTTOM: height grows along −y; width untouched (auto width survives)', () => {
      const scene = makeScene({ textBoxes: [tb()] });
      move(scene, 'BOTTOM', { x: 0, y: -2 });
      expect(scene.updateTextBox).toHaveBeenCalledWith('tb1', {
        height: 3,
        tile: { x: 0, y: 0 }
      });
      const payload = scene.updateTextBox.mock.calls[0][1];
      expect('width' in payload).toBe(false);
    });

    it('TOP: near row edge — tile follows so the far row stays put', () => {
      const scene = makeScene({ textBoxes: [tb()] });
      move(scene, 'TOP', { x: 0, y: 2 });
      // Low row was y = 0; base row to y = 2 → height 3 spanning [0..2].
      expect(scene.updateTextBox).toHaveBeenCalledWith('tb1', {
        height: 3,
        tile: { x: 0, y: 2 }
      });
    });

    it('corner TOP_RIGHT: width and height in one write', () => {
      const scene = makeScene({ textBoxes: [tb()] });
      move(scene, 'TOP_RIGHT', { x: 4, y: 2 });
      expect(scene.updateTextBox).toHaveBeenCalledWith('tb1', {
        width: 4,
        height: 3,
        tile: { x: 0, y: 2 }
      });
    });

    it('clamps both axes to the 1-tile floor', () => {
      const scene = makeScene({ textBoxes: [tb()] });
      move(scene, 'RIGHT', { x: -5, y: 0 });
      expect(scene.updateTextBox).toHaveBeenCalledWith('tb1', {
        width: 1,
        tile: { x: 0, y: 0 }
      });
      jest.clearAllMocks();
      const scene2 = makeScene({ textBoxes: [tb()] });
      move(scene2, 'BOTTOM', { x: 0, y: 5 });
      expect(scene2.updateTextBox).toHaveBeenCalledWith('tb1', {
        height: 1,
        tile: { x: 0, y: 0 }
      });
    });
  });

  describe('orientation Y (run along −y, rows along +x)', () => {
    it('BOTTOM: width grows along −y, tile stays', () => {
      const scene = makeScene({ textBoxes: [tb({ orientation: 'Y' })] });
      move(scene, 'BOTTOM', { x: 0, y: -3 });
      expect(scene.updateTextBox).toHaveBeenCalledWith('tb1', {
        width: 3,
        tile: { x: 0, y: 0 }
      });
    });

    it('TOP: near run edge — tile follows so the far edge stays put', () => {
      const scene = makeScene({
        textBoxes: [
          tb({
            orientation: 'Y',
            tile: { x: 1, y: 0 },
            size: { width: 2, height: 1 }
          })
        ]
      });
      move(scene, 'TOP', { x: 1, y: 1 });
      // Far edge was y = −2; near edge to y = 1 → width 3.
      expect(scene.updateTextBox).toHaveBeenCalledWith('tb1', {
        width: 3,
        tile: { x: 1, y: 1 }
      });
    });

    it('RIGHT: height grows along +x, tile stays', () => {
      const scene = makeScene({ textBoxes: [tb({ orientation: 'Y' })] });
      move(scene, 'RIGHT', { x: 2, y: 0 });
      expect(scene.updateTextBox).toHaveBeenCalledWith('tb1', {
        height: 3,
        tile: { x: 0, y: 0 }
      });
    });

    it('LEFT: near row edge — tile follows so the far row stays put', () => {
      const scene = makeScene({
        textBoxes: [
          tb({
            orientation: 'Y',
            tile: { x: 2, y: 0 },
            size: { width: 1, height: 2 }
          })
        ]
      });
      move(scene, 'LEFT', { x: 0, y: 0 });
      // Far row was x = 3; near row to x = 0 → height 4, tile follows.
      expect(scene.updateTextBox).toHaveBeenCalledWith('tb1', {
        height: 4,
        tile: { x: 0, y: 0 }
      });
    });
  });

  it('no-op when the computed size and tile already match the stored state', () => {
    const scene = makeScene({
      textBoxes: [tb({ width: 4, size: { width: 4, height: 1 } })]
    });
    move(scene, 'RIGHT', { x: 4, y: 0 });
    expect(scene.updateTextBox).not.toHaveBeenCalled();
  });

  it('mouseup commits the resize before switching to CURSOR', () => {
    const scene = makeScene();
    const uiState = makeUiState({ mode: mode('RIGHT') });
    TransformTextBox.mouseup!({ uiState, scene } as any);

    expect(scene.commitDragTransaction).toHaveBeenCalledTimes(1);
    const commitOrder = scene.commitDragTransaction.mock.invocationCallOrder[0];
    const setModeOrder = (uiState.actions.setMode as jest.Mock).mock
      .invocationCallOrder[0];
    expect(commitOrder).toBeLessThan(setModeOrder);
    expect(uiState.actions.setMode).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CURSOR' })
    );
  });
});
