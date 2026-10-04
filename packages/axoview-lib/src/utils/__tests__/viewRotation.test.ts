/**
 * View rotation — the camera & projection model (ADR 0049).
 *
 * θ is a value baked into a strategy (`makeIsometricStrategy(θ)`), never module
 * state. These pin the decision's acceptance criteria that are pure math: 0° is
 * bit-identical, the projection round-trips, the offset map is `P·R·P⁻¹`, an
 * offset written and rendered at the same angle lands where it was put, the
 * painter and the picker agree on tied nodes, and θ is inert in 2D.
 */
import {
  isometricStrategy,
  cartesian2DStrategy,
  getStrategy,
  makeIsometricStrategy,
  isoKappa,
  getCanvasModeSwitchScroll,
  reprojectOffset
} from 'src/utils/coordinateTransforms';
import {
  normaliseDeg,
  formatViewAngle,
  rotationTrig,
  offsetMatrix,
  isoPlaneMatrix,
  nextLatticeAngle,
  shortestArc
} from 'src/utils/viewRotation';
import { UNPROJECTED_TILE_SIZE, PROJECTED_TILE_SIZE } from 'src/config';
import {
  getRenderedAreaCorners,
  getRenderedTileFootprint,
  getRenderedTilePosition,
  footprintContainsPoint
} from 'src/utils/renderedGeometry';
import { getItemAtTile } from 'src/utils/hitDetection';
import { inkFrame } from 'src/utils/annotationGeometry';
import {
  compareSceneDrawOrder,
  sortTilesInPaintOrder,
  SceneDrawOrder
} from 'src/utils/renderOrder';

const S = UNPROJECTED_TILE_SIZE;
// Seven angles, cardinals included (ADR 0049 acceptance: "round-trips at seven").
const ANGLES = [0, 15, 37, 90, 137, 180, -60];
const near = (a: number, b: number, digits = 9) =>
  expect(a).toBeCloseTo(b, digits);

describe('ADR 0049 §2 — the strategy is a value built from (mode, θ)', () => {
  it('makeIsometricStrategy(0) IS the shared strategy (0° is bit-identical)', () => {
    expect(makeIsometricStrategy(0)).toBe(isometricStrategy);
    expect(makeIsometricStrategy(360)).toBe(isometricStrategy);
    expect(makeIsometricStrategy(-0)).toBe(isometricStrategy);
    expect(getStrategy('ISOMETRIC')).toBe(isometricStrategy);
    expect(getStrategy('ISOMETRIC', 0)).toBe(isometricStrategy);
  });

  it('every 0° output is the historical one', () => {
    const s = isometricStrategy;
    expect(s.projectionMatrix('X')).toEqual([0.707, -0.409, 0.707, 0.409, 0, -0.816]);
    expect(s.projectionMatrix('Y')).toEqual([0.707, 0.409, -0.707, 0.409, 0, -0.816]);
    expect(s.depth({ x: 3, y: -2 })).toBe(-1);
    const o = { x: 7.5, y: -4.25 };
    expect(s.offsetToRender(o)).toBe(o);
    expect(s.offsetFromRender(o)).toBe(o);
    // The corner IS the screen-space origin nudge at 0°.
    expect(s.tileCorner({ tile: { x: 2, y: 3 }, corner: 'LEFT' })).toEqual(
      s.tilePosition({ tile: { x: 2, y: 3 }, origin: 'LEFT' })
    );
  });

  it('the same θ hands back the same object (memos key on identity)', () => {
    expect(makeIsometricStrategy(37)).toBe(makeIsometricStrategy(37));
    expect(makeIsometricStrategy(37)).toBe(makeIsometricStrategy(37 - 360));
    expect(makeIsometricStrategy(37)).not.toBe(makeIsometricStrategy(38));
  });

  it('a recently used θ survives a long orbit through the bounded cache', () => {
    const settled = makeIsometricStrategy(15);
    // An orbit builds a live strategy per frame, re-reading θ₀ as it goes.
    for (let i = 1; i <= 200; i++) {
      makeIsometricStrategy(15 + i * 0.37);
      if (i % 32 === 0) expect(makeIsometricStrategy(15)).toBe(settled);
    }
  });

  it('carries its angle, normalised', () => {
    expect(makeIsometricStrategy(190).rotation).toBe(-170);
    expect(getStrategy('2D', 90).rotation).toBe(0);
  });
});

describe('the readout shows a bearing (UX review 2026-10-03)', () => {
  it('counts clockwise as positive, whole degrees, never "-0°"', () => {
    // E turns the floor clockwise and lowers θ, so the readout negates it.
    expect(formatViewAngle(-30)).toBe('30°');
    expect(formatViewAngle(15)).toBe('-15°');
    expect(formatViewAngle(0)).toBe('0°');
    expect(formatViewAngle(-0)).toBe('0°');
    expect(formatViewAngle(0.3)).toBe('0°');
    expect(formatViewAngle(180)).toBe('180°');
    expect(formatViewAngle(-180)).toBe('180°');
    expect(formatViewAngle(-37.6)).toBe('38°');
  });
});

describe('ADR 0049 §1 — exact cardinal trig', () => {
  it('has no float noise at 0, ±90 and 180', () => {
    expect(rotationTrig(90)).toEqual({ cos: 0, sin: 1 });
    expect(rotationTrig(-90)).toEqual({ cos: 0, sin: -1 });
    expect(rotationTrig(180)).toEqual({ cos: -1, sin: 0 });
    expect(rotationTrig(-180)).toEqual({ cos: -1, sin: 0 });
    expect(rotationTrig(450)).toEqual({ cos: 0, sin: 1 });
  });

  it('normaliseDeg wraps into (-180, 180] and never returns -0', () => {
    expect(normaliseDeg(190)).toBe(-170);
    expect(normaliseDeg(-190)).toBe(170);
    expect(normaliseDeg(180)).toBe(180);
    expect(normaliseDeg(-180)).toBe(180);
    expect(Object.is(normaliseDeg(-360), 0)).toBe(true);
    expect(normaliseDeg(Number.NaN)).toBe(0);
  });
});

describe('the projection round-trips at every angle', () => {
  it('fromCanvasPoint ∘ toScreen is the identity', () => {
    for (const deg of ANGLES) {
      const s = makeIsometricStrategy(deg);
      const p = s.toScreen(4.25, -7.5, S);
      const t = s.fromCanvasPoint(p.x, p.y, S);
      near(t.x, 4.25);
      near(t.y, -7.5);
    }
  });

  it('fromScreen picks the tile whose centre was clicked', () => {
    const rendererSize = { width: 800, height: 600 };
    const scroll = { position: { x: 37, y: -21 }, offset: { x: 0, y: 0 } };
    const zoom = 0.8;
    for (const deg of ANGLES) {
      const s = makeIsometricStrategy(deg);
      for (const tile of [
        { x: 0, y: 0 },
        { x: 3, y: -2 },
        { x: -4, y: 5 }
      ]) {
        const c = s.toScreen(tile.x, tile.y, S);
        const mouse = {
          x: rendererSize.width / 2 + scroll.position.x + c.x * zoom,
          y: rendererSize.height / 2 + scroll.position.y + c.y * zoom
        };
        const got = s.fromScreen(mouse.x, mouse.y, S, zoom, scroll, rendererSize);
        expect({ x: got.x + 0, y: got.y + 0 }).toEqual(tile);
      }
    }
  });
});

describe('ADR 0049 §4 — the offset map', () => {
  it('M(θ) equals P·R(θ)·P⁻¹ (probed through the strategy itself)', () => {
    for (const deg of ANGLES) {
      const rotated = makeIsometricStrategy(deg);
      // P⁻¹ then R then P: read a screen vector as a tile delta at 0°, rotate the
      // tile, project — which is toScreen_θ(fromCanvasPoint_0(v)).
      for (const v of [
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 12.5, y: -3 }
      ]) {
        const viaProjection = reprojectOffset(isometricStrategy, rotated, v);
        const viaMatrix = rotated.offsetToRender(v);
        near(viaMatrix.x, viaProjection.x);
        near(viaMatrix.y, viaProjection.y);
      }
    }
  });

  it('has the closed form [[c, κs], [−s/κ, c]] with det 1 and M(θ)⁻¹ = M(−θ)', () => {
    for (const deg of ANGLES) {
      const t = rotationTrig(deg);
      const m = offsetMatrix(t, isoKappa());
      near(m[0] * m[3] - m[1] * m[2], 1);
      const inv = offsetMatrix(rotationTrig(-deg), isoKappa());
      const v = { x: 9, y: -4 };
      const fwd = { x: m[0] * v.x + m[1] * v.y, y: m[2] * v.x + m[3] * v.y };
      const back = {
        x: inv[0] * fwd.x + inv[1] * fwd.y,
        y: inv[2] * fwd.x + inv[3] * fwd.y
      };
      near(back.x, 9);
      near(back.y, -4);
    }
  });

  it('writing then rendering an offset round-trips at 0°, 37°, 90° and 180°', () => {
    for (const deg of [0, 37, 90, 180]) {
      const s = makeIsometricStrategy(deg);
      const residual = { x: 23.5, y: -11 }; // pointer residual, SceneLayer px
      const stored = s.offsetFromRender(residual);
      const rendered = s.offsetToRender(stored);
      near(rendered.x, residual.x);
      near(rendered.y, residual.y);
    }
  });

  it('a stored offset is a fixed sub-tile vector that turns with its tile', () => {
    // The off-grid node stays at the same FRACTIONAL tile at every angle — the
    // drift the POC had was (M(θ) − I)·offset.
    const item = { tile: { x: 2, y: -3 }, offset: { x: 20, y: 6 } };
    const fractionalAt0 = isometricStrategy.fromCanvasPoint(
      getRenderedTilePosition(item, isometricStrategy).x,
      getRenderedTilePosition(item, isometricStrategy).y,
      S
    );
    for (const deg of ANGLES) {
      const s = makeIsometricStrategy(deg);
      const drawn = getRenderedTilePosition(item, s);
      const fractional = s.fromCanvasPoint(drawn.x, drawn.y, S);
      near(fractional.x, fractionalAt0.x);
      near(fractional.y, fractionalAt0.y);
    }
  });

  it('θ is inert in 2D — offsets, depth, matrices and corners', () => {
    for (const deg of ANGLES) {
      const s = getStrategy('2D', deg);
      expect(s).toBe(cartesian2DStrategy);
    }
    const o = { x: 5, y: 7 };
    expect(cartesian2DStrategy.offsetToRender(o)).toBe(o);
    expect(cartesian2DStrategy.depth({ x: 2, y: 3 })).toBe(-5);
  });

  it('the iso↔2D residual re-projection uses the UNROTATED projections', () => {
    // A mode switch is a model write (R1/PROJ-07); the view angle must not
    // enter it — the stored offset lives in the unrotated frame.
    const o = { x: 40, y: -12 };
    const viaUnrotated = reprojectOffset(getStrategy('ISOMETRIC'), getStrategy('2D'), o);
    const back = reprojectOffset(getStrategy('2D'), getStrategy('ISOMETRIC'), viaUnrotated);
    near(back.x, o.x);
    near(back.y, o.y);
  });
});

describe('ADR 0049 §3 — tile corners and the CSS ground-plane matrix', () => {
  it('the CSS matrix maps local px axes exactly like the projected rotated tile axes', () => {
    for (const deg of ANGLES) {
      const s = makeIsometricStrategy(deg);
      const o = s.toScreen(0, 0, S);
      const dx = { x: s.toScreen(1, 0, S).x - o.x, y: s.toScreen(1, 0, S).y - o.y };
      const dy = { x: s.toScreen(0, 1, S).x - o.x, y: s.toScreen(0, 1, S).y - o.y };
      const [a, b, c, d] = s.projectionMatrix('X')!;
      // X: u → +tile x, v → −tile y (matrix is per-px; ×100 = per tile).
      expect(a * S).toBeCloseTo(dx.x, 0);
      expect(b * S).toBeCloseTo(dx.y, 0);
      expect(c * S).toBeCloseTo(-dy.x, 0);
      expect(d * S).toBeCloseTo(-dy.y, 0);
      const [ya, yb, yc, yd] = s.projectionMatrix('Y')!;
      // Y: u → −tile y, v → −tile x.
      expect(ya * S).toBeCloseTo(-dy.x, 0);
      expect(yb * S).toBeCloseTo(-dy.y, 0);
      expect(yc * S).toBeCloseTo(-dx.x, 0);
      expect(yd * S).toBeCloseTo(-dx.y, 0);
    }
  });

  it('isoPlaneMatrix at exact 0° reproduces the historical literals', () => {
    expect(isoPlaneMatrix('X', rotationTrig(0))).toEqual([
      0.707, -0.409, 0.707, 0.409, 0, -0.816
    ]);
  });

  it('the LEFT corner is the (−½, +½) tile corner at any angle', () => {
    for (const deg of ANGLES) {
      const s = makeIsometricStrategy(deg);
      const corner = s.tileCorner({ tile: { x: 2, y: 3 }, corner: 'LEFT' });
      const direct = s.tilePosition({ tile: { x: 1.5, y: 3.5 } });
      near(corner.x, direct.x);
      near(corner.y, direct.y);
    }
  });

  it('rectangle quad corners are the projected TILE-space corners at any angle', () => {
    for (const deg of ANGLES) {
      const s = makeIsometricStrategy(deg);
      const pos = s.tilePosition;
      const quad = getRenderedAreaCorners(
        { x: 2, y: -2 },
        { x: -1, y: 1 },
        undefined,
        s
      );
      const want = [
        pos({ tile: { x: -1.5, y: 1.5 } }),
        pos({ tile: { x: 2.5, y: 1.5 } }),
        pos({ tile: { x: 2.5, y: -2.5 } }),
        pos({ tile: { x: -1.5, y: -2.5 } })
      ];
      quad.forEach((c, i) => {
        near(c.x, want[i].x, 6);
        near(c.y, want[i].y, 6);
      });
    }
  });

  it('a rotated rectangle quad carries M(θ)·offset', () => {
    const s = makeIsometricStrategy(37);
    const off = { x: 14, y: -9 };
    const bare = getRenderedAreaCorners({ x: 0, y: 0 }, { x: 2, y: 1 }, undefined, s);
    const shifted = getRenderedAreaCorners({ x: 0, y: 0 }, { x: 2, y: 1 }, off, s);
    const r = s.offsetToRender(off);
    shifted.forEach((c, i) => {
      near(c.x - bare[i].x, r.x);
      near(c.y - bare[i].y, r.y);
    });
  });

  it('a tile footprint contains its own centre and no neighbouring centre', () => {
    for (const deg of ANGLES) {
      const s = makeIsometricStrategy(deg);
      const here = { tile: { x: 3, y: -1 } };
      const fp = getRenderedTileFootprint(here, s);
      expect(footprintContainsPoint(fp, s.tilePosition({ tile: here.tile }))).toBe(true);
      for (const n of [
        { x: 4, y: -1 },
        { x: 2, y: -1 },
        { x: 3, y: 0 },
        { x: 3, y: -2 }
      ]) {
        expect(footprintContainsPoint(fp, s.tilePosition({ tile: n }))).toBe(false);
      }
    }
  });

  it('the unrotated footprint is still the iso diamond (TOP, RIGHT, BOTTOM, LEFT)', () => {
    const fp = getRenderedTileFootprint({ tile: { x: 0, y: 0 } }, isometricStrategy);
    const hw = PROJECTED_TILE_SIZE.width / 2;
    near(fp.corners[0].x, 0);
    expect(fp.corners[0].y).toBeLessThan(0);
    near(fp.corners[1].y, 0);
    near(fp.corners[1].x, hw, 3);
    expect(fp.corners[2].y).toBeGreaterThan(0);
    near(fp.corners[3].x, -hw, 3);
  });
});

describe('ADR 0049 §5 — one depth comparator for paint and pick', () => {
  // Two nodes on DIFFERENT tiles whose rotated depths tie exactly at a cardinal
  // angle — e.g. at 90° depth = y − x, so (0,0) and (1,1) tie. With float trig
  // the tie was broken by 1e-17 noise, so painter and picker could disagree.
  const TIES: Record<number, [{ x: number; y: number }, { x: number; y: number }]> = {
    0: [
      { x: 1, y: 0 },
      { x: 0, y: 1 }
    ],
    90: [
      { x: 0, y: 0 },
      { x: 1, y: 1 }
    ],
    180: [
      { x: 1, y: 0 },
      { x: 0, y: 1 }
    ],
    [-90]: [
      { x: 0, y: 0 },
      { x: 1, y: 1 }
    ]
  };

  it.each([0, 90, 180, -90])('tied depths really tie at %i°', (deg) => {
    const s = makeIsometricStrategy(deg);
    const [a, b] = TIES[deg];
    // `===`, not Object.is: −0 and +0 are the same depth to a comparator.
    expect(s.depth(a) === s.depth(b)).toBe(true);
  });

  it.each([0, 90, 180, -90])(
    'the picker returns what the painter put on top at %i° (both array orders)',
    (deg) => {
      const s = makeIsometricStrategy(deg);
      const [ta, tb] = TIES[deg];
      // The nodes overlap only on the pixel path, so query the point halfway
      // between their drawn centres — inside both footprints.
      const pa = s.tilePosition({ tile: ta });
      const pb = s.tilePosition({ tile: tb });
      const point = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
      for (const order of [
        ['a', 'b'],
        ['b', 'a']
      ]) {
        const items = order.map((id) => ({ id, tile: id === 'a' ? ta : tb }));
        // Painter: the merged canvas's comparator over the same model order.
        const units: Array<SceneDrawOrder & { id: string }> = items.map((it) => ({
          id: it.id,
          kind: 'node',
          layerOrder: 0,
          zIndex: 0,
          isoDepth: s.depth(it.tile)
        }));
        const painted = [...units].sort(compareSceneDrawOrder);
        const top = painted[painted.length - 1].id;
        const viaHelper = sortTilesInPaintOrder(items, () => 0, s);
        expect(viaHelper[viaHelper.length - 1].id).toBe(top);
        const fpA = getRenderedTileFootprint({ tile: ta }, s);
        const fpB = getRenderedTileFootprint({ tile: tb }, s);
        // Only meaningful where both footprints contain the probe.
        if (footprintContainsPoint(fpA, point) && footprintContainsPoint(fpB, point)) {
          const hit = getItemAtTile({
            tile: ta,
            scene: { items, textBoxes: [], hitConnectors: [], rectangles: [] },
            strategy: s,
            point
          });
          expect(hit?.id).toBe(top);
        }
      }
    }
  );

  it('at a non-cardinal angle the painter and picker read the same rotated depth', () => {
    const s = makeIsometricStrategy(37);
    const items = [
      { id: 'a', tile: { x: 0, y: 0 } },
      { id: 'b', tile: { x: 1, y: 0 } }
    ];
    const sorted = sortTilesInPaintOrder(items, () => 0, s);
    const expectTopFirst = s.depth(items[0].tile) > s.depth(items[1].tile) ? 'a' : 'b';
    expect(sorted[sorted.length - 1].id).toBe(expectTopFirst);
  });
});

describe('ADR 0049 §7 — viewport pivot and the step lattice', () => {
  it('a rotation keeps the tile under the viewport centre fixed', () => {
    const scroll = { position: { x: 120, y: -45 }, offset: { x: 0, y: 0 } };
    const zoom = 1.25;
    const from = makeIsometricStrategy(10);
    const to = makeIsometricStrategy(55);
    const centreTile = from.fromCanvasPoint(-scroll.position.x / zoom, -scroll.position.y / zoom, S);
    const next = getCanvasModeSwitchScroll(from, to, zoom, scroll);
    const after = to.fromCanvasPoint(-next.x / zoom, -next.y / zoom, S);
    near(after.x, centreTile.x);
    near(after.y, centreTile.y);
  });

  it('steps to the next 15° multiple, from on- or off-lattice angles', () => {
    expect(nextLatticeAngle(37, 1)).toBe(45);
    expect(nextLatticeAngle(37, -1)).toBe(30);
    expect(nextLatticeAngle(45, 1)).toBe(60);
    expect(nextLatticeAngle(45, -1)).toBe(30);
    expect(nextLatticeAngle(180, 1)).toBe(-165);
    expect(nextLatticeAngle(-165, -1)).toBe(180);
    expect(nextLatticeAngle(45.0000000001, 1)).toBe(60);
  });

  it('Shift steps to the next cardinal angle', () => {
    expect(nextLatticeAngle(37, 1, 90)).toBe(90);
    expect(nextLatticeAngle(37, -1, 90)).toBe(0);
    expect(nextLatticeAngle(90, 1, 90)).toBe(180);
    expect(nextLatticeAngle(180, 1, 90)).toBe(-90);
  });

  it('the shortest arc never spins the long way round', () => {
    expect(shortestArc(170, -170)).toBe(20);
    expect(shortestArc(-170, 170)).toBe(-20);
    expect(shortestArc(0, 180)).toBe(180);
  });
});

describe('ADR 0050 §4 — annotation ink follows the floor', () => {
  const apply = (m: readonly number[], v: { x: number; y: number }) => ({
    x: m[0] * v.x + m[1] * v.y,
    y: m[2] * v.x + m[3] * v.y
  });

  it.each(ANGLES)('ink round-trips through M(θ)·M(−θ) at %i°', (deg) => {
    const { toRender, fromRender } = inkFrame('ISOMETRIC', deg);
    const drawnAt = { x: 120.5, y: -48 }; // where the pen touched, scene px
    const stored = apply(fromRender, drawnAt);
    const back = apply(toRender, stored);
    near(back.x, drawnAt.x);
    near(back.y, drawnAt.y);
  });

  it('ink drawn through M(θ) is the offset map — it stays on what it marked', () => {
    const s = makeIsometricStrategy(64);
    const v = { x: 31, y: 7 };
    const viaInk = apply(inkFrame('ISOMETRIC', 64).toRender, v);
    const viaOffset = s.offsetToRender(v);
    near(viaInk.x, viaOffset.x);
    near(viaInk.y, viaOffset.y);
  });

  it('is the identity at 0° and in 2D', () => {
    expect(inkFrame('ISOMETRIC', 0).toRender).toEqual([1, 0, 0, 1]);
    expect(inkFrame('2D', 90).toRender).toEqual([1, 0, 0, 1]);
  });
});
