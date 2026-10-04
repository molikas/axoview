/**
 * Input orientation under view rotation (ADR 0049 §7, finding F4).
 *
 * Two inputs were authored for the unrotated view: arrow-key nudge used fixed
 * tile deltas (every arrow reversed at 180°) and flat-icon resize used fixed
 * screen diagonals (over wide angle ranges, dragging a handle OUTWARD shrank the
 * icon). Both now read the live projection.
 */
import { orientArrowDelta, ARROW_TILE_DELTAS } from '../handleArrowKey';
import { TransformNode } from '../modes/Node/TransformNode';
import {
  getStrategy,
  makeIsometricStrategy
} from 'src/utils/coordinateTransforms';

const UNIT = 1;

// The on-screen direction a key meant at 0° — the contract the remap keeps.
const screenDirAt0 = (key: string) => {
  const d = ARROW_TILE_DELTAS[key];
  const p = getStrategy('ISOMETRIC').toScreen(d.x, d.y, UNIT);
  const len = Math.hypot(p.x, p.y);
  return { x: p.x / len, y: p.y / len };
};

describe('arrow nudge moves on screen in the key’s direction', () => {
  it.each([0, 90, -90, 180, 37])('at %i°', (deg) => {
    const s = makeIsometricStrategy(deg);
    for (const key of Object.keys(ARROW_TILE_DELTAS)) {
      const step = orientArrowDelta(ARROW_TILE_DELTAS[key], s);
      const p = s.toScreen(step.x, step.y, UNIT);
      const len = Math.hypot(p.x, p.y);
      const want = screenDirAt0(key);
      const cos = (p.x * want.x + p.y * want.y) / len;
      // The chosen step is the closest of the four; at a cardinal angle it is
      // exact, and at 37° it is still within 45° of the intended direction.
      expect(cos).toBeGreaterThan(Math.SQRT1_2 - 1e-9);
      if (deg % 90 === 0) expect(cos).toBeCloseTo(1, 9);
    }
  });

  it('is the identity at 0° and in 2D', () => {
    for (const key of Object.keys(ARROW_TILE_DELTAS)) {
      const d = ARROW_TILE_DELTAS[key];
      expect(orientArrowDelta(d, makeIsometricStrategy(0))).toBe(d);
      expect(orientArrowDelta(d, getStrategy('2D', 120))).toBe(d);
    }
  });

  it('reverses the authored deltas at 180° (the bug this fixes)', () => {
    const s = makeIsometricStrategy(180);
    expect(orientArrowDelta(ARROW_TILE_DELTAS.ArrowRight, s)).toEqual({
      x: -1,
      y: 0
    });
    expect(orientArrowDelta(ARROW_TILE_DELTAS.ArrowUp, s)).toEqual({
      x: 0,
      y: -1
    });
  });
});

describe('dragging a flat-icon handle outward grows the icon', () => {
  const setIconScaleDrag = jest.fn();

  const run = (outward: { x: number; y: number }, drag: { x: number; y: number }) => {
    setIconScaleDrag.mockClear();
    const len = Math.hypot(outward.x, outward.y);
    const uiState = {
      mode: {
        type: 'NODE.TRANSFORM',
        selectedAnchor: 'TOP_LEFT',
        targets: [{ id: 'n', startScale: 1 }],
        showCursor: false,
        outward: { x: outward.x / len, y: outward.y / len }
      },
      zoom: 1,
      iconScaleDrag: null,
      mouse: {
        position: { screen: drag, tile: { x: 0, y: 0 } },
        mousedown: { screen: { x: 0, y: 0 }, tile: { x: 0, y: 0 } }
      },
      actions: { setIconScaleDrag }
    };
    TransformNode.mousemove?.({ uiState } as never);
    return setIconScaleDrag.mock.calls[0][0].n as number;
  };

  it.each([0, 90, 180, -135, 37])('at %i°', (deg) => {
    const s = makeIsometricStrategy(deg);
    // The TOP_LEFT anchor of a single-tile flat-icon frame sits on the tile's
    // LEFT corner (outermostCornerPositions) — wherever that has swung to.
    const centre = s.tilePosition({ tile: { x: 0, y: 0 } });
    const corner = s.tileCorner({ tile: { x: 0, y: 0 }, corner: 'LEFT' });
    const outward = { x: corner.x - centre.x, y: corner.y - centre.y };
    const len = Math.hypot(outward.x, outward.y);
    const away = { x: (outward.x / len) * 20, y: (outward.y / len) * 20 };
    const toward = { x: -away.x, y: -away.y };
    expect(run(outward, away)).toBeGreaterThan(1);
    expect(run(outward, toward)).toBeLessThan(1);
  });
});
