import {
  isometricStrategy,
  makeTileCornerFn,
  makeTilePositionFn
} from 'src/utils/coordinateTransforms';
import {
  setViewRotationRad,
  degToRad,
  normaliseDeg,
  getRotatedIsoMatrix,
  viewDepth
} from 'src/utils/viewRotation';
import { screenToIso, getTilePosition } from 'src/utils/isoMath';
import { UNPROJECTED_TILE_SIZE, PROJECTED_TILE_SIZE } from 'src/config';
import {
  getRenderedAreaCorners,
  getRenderedTileFootprint,
  footprintContainsPoint
} from 'src/utils/renderedGeometry';

const S = UNPROJECTED_TILE_SIZE;
const ANGLES = [0, 15, 45, 90, 137, 180, -60];

afterEach(() => setViewRotationRad(0));

describe('horizontal view rotation (POC)', () => {
  it('is the identity at 0° (matrix + projection bit-identical to the originals)', () => {
    setViewRotationRad(0);
    expect(getRotatedIsoMatrix('X')).toEqual([0.707, -0.409, 0.707, 0.409, 0, -0.816]);
    expect(getRotatedIsoMatrix('Y')).toEqual([0.707, 0.409, -0.707, 0.409, 0, -0.816]);
    const p = isometricStrategy.toScreen(3, -2, S);
    expect(p.x).toBeCloseTo(70.69 * 5, 0);
    expect(viewDepth({ x: 3, y: -2 })).toBe(-1);
  });

  it('toScreen ∘ fromCanvasPoint round-trips at every angle', () => {
    for (const deg of ANGLES) {
      setViewRotationRad(degToRad(deg));
      const p = isometricStrategy.toScreen(4.25, -7.5, S);
      const t = isometricStrategy.fromCanvasPoint(p.x, p.y, S);
      expect(t.x).toBeCloseTo(4.25, 6);
      expect(t.y).toBeCloseTo(-7.5, 6);
    }
  });

  it('fromScreen picks the tile whose centre was clicked, at every angle', () => {
    const rendererSize = { width: 800, height: 600 };
    const scroll = { position: { x: 37, y: -21 }, offset: { x: 0, y: 0 } };
    const zoom = 0.8;
    for (const deg of ANGLES) {
      setViewRotationRad(degToRad(deg));
      for (const tile of [
        { x: 0, y: 0 },
        { x: 3, y: -2 },
        { x: -4, y: 5 }
      ]) {
        const c = isometricStrategy.toScreen(tile.x, tile.y, S);
        const mouse = {
          x: rendererSize.width / 2 + scroll.position.x + c.x * zoom,
          y: rendererSize.height / 2 + scroll.position.y + c.y * zoom
        };
        expect(
          isometricStrategy.fromScreen(mouse.x, mouse.y, S, zoom, scroll, rendererSize)
        ).toEqual(tile);
        // isoMath's standalone copy must agree with the strategy (`+ 0` folds the
        // original unrotated branch's pre-existing -0 into 0).
        const iso = screenToIso({ mouse, zoom, scroll, rendererSize });
        expect({ x: iso.x + 0, y: iso.y + 0 }).toEqual(tile);
      }
    }
  });

  it('isoMath.getTilePosition agrees with the strategy under rotation', () => {
    setViewRotationRad(degToRad(33));
    const a = getTilePosition({ tile: { x: 2, y: 5 } });
    const b = makeTilePositionFn(isometricStrategy)({ tile: { x: 2, y: 5 } });
    expect(a.x).toBeCloseTo(b.x, 9);
    expect(a.y).toBeCloseTo(b.y, 9);
  });

  // The CSS matrix must map an element's local px axes exactly like projecting the
  // matching tile-space displacement — else rectangles/text drift off their tiles.
  it('CSS matrix == projection of the rotated tile axes (X and Y orientation)', () => {
    for (const deg of ANGLES) {
      setViewRotationRad(degToRad(deg));
      const o = isometricStrategy.toScreen(0, 0, S);
      const ux = isometricStrategy.toScreen(1, 0, S); // +1 tile along tile x
      const uy = isometricStrategy.toScreen(0, 1, S); // +1 tile along tile y
      // local px (100 px = 1 tile) → expected screen delta
      const delta = (p: { x: number; y: number }) => ({ x: p.x - o.x, y: p.y - o.y });
      const dx = delta(ux);
      const dy = delta(uy);

      const [a, b, c, d] = getRotatedIsoMatrix('X');
      // X: u → +tile x, v → −tile y   (matrix is per-px; ×100 = per tile)
      expect(a * S).toBeCloseTo(dx.x, 0);
      expect(b * S).toBeCloseTo(dx.y, 0);
      expect(c * S).toBeCloseTo(-dy.x, 0);
      expect(d * S).toBeCloseTo(-dy.y, 0);

      const [ya, yb, yc, yd] = getRotatedIsoMatrix('Y');
      // Y: u → −tile y, v → −tile x
      expect(ya * S).toBeCloseTo(-dy.x, 0);
      expect(yb * S).toBeCloseTo(-dy.y, 0);
      expect(yc * S).toBeCloseTo(-dx.x, 0);
      expect(yd * S).toBeCloseTo(-dx.y, 0);
    }
  });

  it('tile corners: unrotated == origin offsets; rotated stay on the tile', () => {
    const corner = makeTileCornerFn(isometricStrategy);
    const pos = makeTilePositionFn(isometricStrategy);
    setViewRotationRad(0);
    expect(corner({ tile: { x: 2, y: 3 }, corner: 'LEFT' })).toEqual(
      pos({ tile: { x: 2, y: 3 }, origin: 'LEFT' })
    );
    setViewRotationRad(degToRad(40));
    // The LEFT corner is the (−½, +½) tile corner at ANY angle.
    const rotated = corner({ tile: { x: 2, y: 3 }, corner: 'LEFT' });
    const direct = pos({ tile: { x: 1.5, y: 3.5 } });
    expect(rotated.x).toBeCloseTo(direct.x, 9);
    expect(rotated.y).toBeCloseTo(direct.y, 9);
  });

  // master's pixel-accurate hit-testing + the WebGL rectangle quad both go through
  // renderedGeometry, so rotation has to be right THERE, not just in the strategy.
  it('rectangle quad corners are the projected TILE-space corners at any angle', () => {
    const pos = makeTilePositionFn(isometricStrategy);
    for (const deg of ANGLES) {
      setViewRotationRad(degToRad(deg));
      // tiles x in [-1, 2], y in [-2, 1]  (from/to in either order)
      const [c0, c1, c2, c3] = getRenderedAreaCorners(
        { x: 2, y: -2 },
        { x: -1, y: 1 },
        undefined,
        pos,
        'ISOMETRIC'
      );
      const want = [
        pos({ tile: { x: -1.5, y: 1.5 } }), // origin: low-x / high-y corner
        pos({ tile: { x: 2.5, y: 1.5 } }),
        pos({ tile: { x: 2.5, y: -2.5 } }),
        pos({ tile: { x: -1.5, y: -2.5 } })
      ];
      [c0, c1, c2, c3].forEach((c, i) => {
        expect(c.x).toBeCloseTo(want[i].x, 6);
        expect(c.y).toBeCloseTo(want[i].y, 6);
      });
    }
  });

  it('tile footprint contains its own centre but no neighbouring tile centre, at any angle', () => {
    const pos = makeTilePositionFn(isometricStrategy);
    for (const deg of ANGLES) {
      setViewRotationRad(degToRad(deg));
      const here = { tile: { x: 3, y: -1 } };
      const fp = getRenderedTileFootprint(here, pos, 'ISOMETRIC');
      expect(footprintContainsPoint(fp, pos({ tile: here.tile }))).toBe(true);
      for (const n of [
        { x: 4, y: -1 },
        { x: 2, y: -1 },
        { x: 3, y: 0 },
        { x: 3, y: -2 }
      ]) {
        expect(footprintContainsPoint(fp, pos({ tile: n }))).toBe(false);
      }
      // corners are the four tile-space corners, projected
      const centre = pos({ tile: here.tile });
      const sum = fp.corners.reduce((a, c) => ({ x: a.x + c.x, y: a.y + c.y }), { x: 0, y: 0 });
      expect(sum.x / 4).toBeCloseTo(centre.x, 6);
      expect(sum.y / 4).toBeCloseTo(centre.y, 6);
    }
  });

  it('unrotated footprint is the original iso diamond (TOP, RIGHT, BOTTOM, LEFT)', () => {
    setViewRotationRad(0);
    const pos = makeTilePositionFn(isometricStrategy);
    const fp = getRenderedTileFootprint({ tile: { x: 0, y: 0 } }, pos, 'ISOMETRIC');
    const hw = PROJECTED_TILE_SIZE.width / 2;
    expect(fp.corners[0].x).toBeCloseTo(0, 9); // TOP
    expect(fp.corners[0].y).toBeLessThan(0);
    expect(fp.corners[1].y).toBeCloseTo(0, 9); // RIGHT
    expect(fp.corners[1].x).toBeCloseTo(hw, 3);
    expect(fp.corners[2].y).toBeGreaterThan(0); // BOTTOM
    expect(fp.corners[3].x).toBeCloseTo(-hw, 3); // LEFT
  });

  it('normaliseDeg wraps into (-180, 180]', () => {
    expect(normaliseDeg(190)).toBe(-170);
    expect(normaliseDeg(-190)).toBe(170);
    expect(normaliseDeg(180)).toBe(180);
    expect(normaliseDeg(-180)).toBe(180);
    expect(normaliseDeg(720)).toBe(0);
  });
});
