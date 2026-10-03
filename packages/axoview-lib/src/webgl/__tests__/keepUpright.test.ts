/**
 * Keep-upright for floor-readable content (ADR 0050 §2).
 *
 * Text boxes and flat icons lie on the floor; turned past 45° their reading
 * direction points leftward and they read upside-down. The fix draws them
 * rotated 180° within their own plane — never mirrored, footprint unchanged —
 * decided by ONE predicate with a hysteresis band at each boundary.
 */
import {
  keepUprightFlip,
  KEEP_UPRIGHT_BAND_DEG
} from 'src/utils/viewRotation';
import { createNodeEmitter } from 'src/webgl/scene/nodeEmitter';
import { makeIsometricStrategy } from 'src/utils/coordinateTransforms';
import type { SpriteBatch, UVRect } from 'src/webgl/glSpriteBatch';
import type { Icon, ModelItem, ViewItem } from 'src/types';

const HALF = KEEP_UPRIGHT_BAND_DEG / 2;

describe('the keep-upright predicate', () => {
  // [orientation, boundary, side that reads LEFTWARD just past it]
  const BOUNDARIES: Array<['X' | 'Y', number, 1 | -1]> = [
    ['X', 45, 1],
    ['X', -135, -1],
    ['Y', 135, 1],
    ['Y', -45, -1]
  ];

  it.each(BOUNDARIES)(
    '%s around %i° flips only beyond the band, from either side',
    (orientation, boundary, leftSide) => {
      const inside = boundary + leftSide * (HALF + 1); // clearly leftward
      const outside = boundary - leftSide * (HALF + 1); // clearly rightward
      const inBandLeft = boundary + leftSide * (HALF - 1);
      const inBandRight = boundary - leftSide * (HALF - 1);
      // Clear of the band, the previous state does not matter.
      expect(keepUprightFlip(orientation, inside, false)).toBe(true);
      expect(keepUprightFlip(orientation, inside, true)).toBe(true);
      expect(keepUprightFlip(orientation, outside, false)).toBe(false);
      expect(keepUprightFlip(orientation, outside, true)).toBe(false);
      // Inside the band, the state is kept (hysteresis).
      for (const deg of [inBandLeft, boundary, inBandRight]) {
        expect(keepUprightFlip(orientation, deg, false)).toBe(false);
        expect(keepUprightFlip(orientation, deg, true)).toBe(true);
      }
    }
  );

  it('matches the ADR table away from the boundaries', () => {
    // X reads leftward for θ ∈ (45°, 180°] ∪ (−180°, −135°).
    for (const deg of [0, 30, -30, -120]) expect(keepUprightFlip('X', deg)).toBe(false);
    for (const deg of [60, 120, 180, -160]) expect(keepUprightFlip('X', deg)).toBe(true);
    // Y reads leftward for θ ∈ (135°, 180°] ∪ (−180°, −45°).
    for (const deg of [0, 30, 120, -30]) expect(keepUprightFlip('Y', deg)).toBe(false);
    for (const deg of [150, 180, -60, -120]) expect(keepUprightFlip('Y', deg)).toBe(true);
  });

  it('both orientations read correctly for |θ| < 45° and both flip past 135°', () => {
    for (const deg of [-40, -10, 0, 10, 40]) {
      expect(keepUprightFlip('X', deg)).toBe(false);
      expect(keepUprightFlip('Y', deg)).toBe(false);
    }
    for (const deg of [145, 180, -145]) {
      expect(keepUprightFlip('X', deg)).toBe(true);
      expect(keepUprightFlip('Y', deg)).toBe(true);
    }
  });
});

describe('a flipped flat icon keeps its footprint', () => {
  const UV: UVRect = { u0: 0, v0: 0, uS: 1, vS: 1, page: 0 };
  const quads: number[][] = [];
  const batch = {
    dot: UV,
    white: UV,
    putCanvas: () => UV,
    putImage: () => UV,
    addSprite: (...args: number[]) => {
      quads.push(args);
    }
  } as unknown as SpriteBatch;
  const img = { naturalWidth: 100, naturalHeight: 60 } as HTMLImageElement;
  const icon: Icon = {
    id: 'flat',
    name: 'flat',
    url: 'flat.svg',
    isIsometric: false
  } as Icon;
  const item = { id: 'n', name: '', icon: 'flat' } as ModelItem;
  const node = { id: 'n', tile: { x: 2, y: -1 }, showLabel: false } as ViewItem;

  const quadCorners = (deg: number, uprightFlip: boolean) => {
    quads.length = 0;
    const emitter = createNodeEmitter({
      batch,
      itemsById: new Map([[item.id, item]]),
      iconsById: new Map([[icon.id, icon]]),
      strategy: makeIsometricStrategy(deg),
      uprightFlip,
      isIso: true,
      inPreview: false,
      previewHideLabels: false,
      exportHideLabels: false,
      drawLabels: false,
      zoom: 1,
      readableLabels: false,
      chip: { radius: 0, padX: 0, padY: 0, bg: '', border: '', text: '' },
      measureCtx: null,
      ss: 1,
      layoutCache: new Map(),
      getImage: () => img,
      iconPending: () => false,
      putIcon: () => UV
    });
    emitter.emit(node);
    expect(quads).toHaveLength(1);
    const [ax, ay, lx, ly, ux, uy, vx, vy] = quads[0];
    const o = { x: ax + lx, y: ay + ly };
    return [
      o,
      { x: o.x + ux, y: o.y + uy },
      { x: o.x + ux + vx, y: o.y + uy + vy },
      { x: o.x + vx, y: o.y + vy }
    ];
  };

  it.each([60, 120, 180, -160])('at %i° the corners are the same set', (deg) => {
    const plain = quadCorners(deg, false);
    const flipped = quadCorners(deg, true);
    const key = (p: { x: number; y: number }) =>
      `${p.x.toFixed(6)},${p.y.toFixed(6)}`;
    expect(new Set(flipped.map(key))).toEqual(new Set(plain.map(key)));
    // ...and it is a turn, not a mirror: the basis keeps its handedness.
    const det = (q: number[]) => q[4] * q[7] - q[5] * q[6];
    quadCorners(deg, false);
    const detPlain = det(quads[0]);
    quadCorners(deg, true);
    const detFlipped = det(quads[0]);
    expect(Math.sign(detFlipped)).toBe(Math.sign(detPlain));
  });
});
