/**
 * INVARIANT — an off-grid item is drawn, framed and hit-tested in the SAME place.
 *
 * Why this exists: ADR 0023 gave items a sub-tile px `offset` beside the
 * authoritative integer `tile`. Seven consumers re-derived position from the
 * tile alone, so a node was PAINTED at tile+offset but FRAMED, HOVERED and
 * HIT-TESTED at the bare tile — selection chrome floating off the icon, nodes
 * that could not be hovered or right-clicked, a rectangle snapping back to its
 * cell on drop. The ADR's acceptance test asserted only the data model (tile
 * stays integer, offset gets committed), so every one of those was invisible
 * to CI. This suite asserts the RENDERED ARTIFACTS instead — DOM styles, real
 * `getItemAtTile` calls, the WebGL vertex tuple — parametrized over element
 * kind × offset corpus × canvas mode.
 *
 * Every expectation is derived from the raw projection (`getStrategy(mode)
 * .toScreen(...)` plus a hand-written vector add), never from
 * `renderedGeometry`. A helper-vs-helper comparison would be tautological now
 * that every consumer shares the helper.
 *
 * MUTATION GATE (performed 2026-07-23, decision 3): the offset composition was
 * removed from ONE consumer — `HoverOutline.tsx`'s `HoverNode`, reverted to
 * `center={getTilePosition({ tile: node.tile, origin: 'CENTER' })}` — and this
 * suite went RED on every non-zero offset case (hover-outline tier), while the
 * data-model suite stayed green. The composition was then restored. Repeat that
 * experiment on any consumer if you suspect a case here has gone tautological.
 */

import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { CanvasMode, Coords } from 'src/types';
import { PROJECTED_TILE_SIZE, UNPROJECTED_TILE_SIZE } from 'src/config';
import {
  getStrategy,
  makeTilePositionFn
} from 'src/utils/coordinateTransforms';
import { getItemAtTile } from 'src/utils/hitDetection';
import { getTextBoxEndTile } from 'src/utils/isoMath';
import { getRenderedAreaCorners } from 'src/utils/renderedGeometry';

// ---------------------------------------------------------------------------
// Harness — real projection, stubbed data plumbing
// ---------------------------------------------------------------------------

// jsdom has no ResizeObserver; the node's label wrapper observes itself.
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(global as unknown as { ResizeObserver: unknown }).ResizeObserver =
  NoopResizeObserver;

// The mode under test. Mutable so `describe.each` can flip it; `mock`-prefixed
// names are the only ones jest's hoisted factories may close over.
let mockMode: CanvasMode = 'ISOMETRIC';
let mockNode: {
  id: string;
  tile: Coords;
  offset?: Coords;
  showLabel?: boolean;
  labelHeight?: number;
};

jest.mock('src/contexts/CanvasModeContext', () => {
  // Deliberately the REAL strategies: the projection is the thing under test,
  // only the store plumbing is stubbed.
  const actual = jest.requireActual('src/utils/coordinateTransforms');
  return {
    useCanvasMode: () => {
      const strategy = actual.getStrategy(mockMode);
      return {
        strategy,
        getTilePosition: actual.makeTilePositionFn(strategy),
        screenToTile: () => ({ x: 0, y: 0 }),
        getProjectionCss: () =>
          strategy.projectionName === '2D'
            ? ''
            : 'matrix(0.707, -0.409, 0.707, 0.409, 0, -0.816)'
      };
    }
  };
});

const uiState = {
  zoom: 1,
  editorMode: 'EDITABLE',
  mode: { type: 'CURSOR' },
  hoveredItem: null as { type: string; id: string } | null,
  itemControls: null as { type: string; id: string } | null,
  selectedIds: [] as { type: string; id: string }[],
  iconScaleDrag: null,
  labelMove: null,
  previewHideLabels: false,
  exportHideLabels: false,
  actions: { clearLabelDrag: () => {}, setLabelDrag: () => {} }
};

jest.mock('src/stores/uiStateStore', () => ({
  useUiStateStore: (selector: (s: unknown) => unknown) =>
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    selector(mockUiState()),
  useUiStateStoreApi: () => ({
    getState: () => mockUiState(),
    setState: () => {},
    subscribe: () => () => {}
  })
}));

jest.mock('src/stores/modelStore', () => ({
  useModelStore: (selector: (s: unknown) => unknown) =>
    selector({
      items: [{ id: 'n1', name: 'Node one', icon: 'icon1' }],
      icons: [{ id: 'icon1', isIsometric: true, scale: 1 }]
    }),
  useModelStoreApi: () => ({ getState: () => ({ items: [], colors: [] }) })
}));

jest.mock('src/hooks/useViewItem', () => ({
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  useViewItem: () => mockViewItem()
}));
jest.mock('src/hooks/useModelItem', () => ({
  useModelItem: () => ({ id: 'n1', name: 'Node one', icon: 'icon1' })
}));
jest.mock('src/hooks/useIcon', () => ({
  useIcon: () => ({
    icon: { id: 'icon1', isIsometric: true, scale: 1, url: '' },
    iconComponent: null
  })
}));
jest.mock('src/hooks/useImageAspect', () => ({ useImageAspect: () => 1 }));
jest.mock('src/hooks/useSceneActions', () => ({
  useSceneActions: () => ({ updateViewItem: () => {}, updateModelItem: () => {} })
}));
jest.mock('src/hooks/useInlineRename', () => ({
  useInlineRename: () => ({
    isEditing: false,
    value: '',
    setValue: () => {},
    start: () => {},
    commit: () => {},
    cancel: () => {},
    inputRef: { current: null }
  })
}));
jest.mock('src/utils/renderProbe', () => ({ useRenderProbe: () => {} }));

// Accessors the hoisted factories call (they may not close over `let` bindings
// declared after them, but a function reference resolved at call time is fine).
function mockUiState() {
  return uiState;
}
function mockViewItem() {
  return mockNode;
}

// Imported AFTER the mocks so the components pick them up.
/* eslint-disable import/first */
import { Node } from 'src/components/SceneLayers/Nodes/Node/Node';
import { NodeTransformControls } from 'src/components/TransformControlsManager/NodeTransformControls';
import { HoverOutline } from 'src/components/TransformControlsManager/HoverOutline';
import { NodeLabelHitLayer } from 'src/components/SceneLayers/Nodes/NodeLabelHitLayer';
import { TransformControls } from 'src/components/TransformControlsManager/TransformControls';
/* eslint-enable import/first */

// ---------------------------------------------------------------------------
// Corpus (locked decision 4)
// ---------------------------------------------------------------------------

const EPS = 0.01;
// The stated contract is ±0.5 px. Every assertion below is exact arithmetic on
// style values (jsdom does no layout), so we hold them far tighter — at ±0.5 px
// the corpus's sub-pixel `(0.5, 0.5)` case would survive a consumer dropping the
// offset entirely, which is precisely the bug this suite exists to catch.
const TOL = 1e-6;

const halfExtents = (mode: CanvasMode) =>
  mode === '2D'
    ? { w: UNPROJECTED_TILE_SIZE / 2, h: UNPROJECTED_TILE_SIZE / 2 }
    : { w: PROJECTED_TILE_SIZE.width / 2, h: PROJECTED_TILE_SIZE.height / 2 };

const offsetCorpus = (
  mode: CanvasMode
): { name: string; offset?: Coords }[] => {
  const { w, h } = halfExtents(mode);
  return [
    { name: 'snapped (no offset field)', offset: undefined },
    { name: 'snapped (explicit 0,0)', offset: { x: 0, y: 0 } },
    { name: 'the real regression case (-75,-3)', offset: { x: -75, y: -3 } },
    { name: '+half-width boundary', offset: { x: w - EPS, y: 0 } },
    { name: '-half-width boundary', offset: { x: -(w - EPS), y: 0 } },
    { name: '+half-height boundary', offset: { x: 0, y: h - EPS } },
    { name: '-half-height boundary', offset: { x: 0, y: -(h - EPS) } },
    { name: 'sub-pixel (0.5,0.5)', offset: { x: 0.5, y: 0.5 } },
    { name: 'multi-tile (140,90)', offset: { x: 140, y: 90 } }
  ];
};

const TILE: Coords = { x: 2, y: -3 };

/** The expected rendered centre, derived from the RAW projection only. */
const expectedCentre = (mode: CanvasMode, offset?: Coords): Coords => {
  const base = getStrategy(mode).toScreen(TILE.x, TILE.y, UNPROJECTED_TILE_SIZE);
  return { x: base.x + (offset?.x ?? 0), y: base.y + (offset?.y ?? 0) };
};

/** Does the bare-tile centre fall OUTSIDE the rendered footprint? */
const bareTileCentreIsOutside = (mode: CanvasMode, offset?: Coords): boolean => {
  if (!offset) return false;
  const { w, h } = halfExtents(mode);
  const dx = Math.abs(offset.x);
  const dy = Math.abs(offset.y);
  return mode === '2D' ? dx > w || dy > h : dx / w + dy / h > 1;
};

const px = (value: string | number | null | undefined): number =>
  typeof value === 'number' ? value : parseFloat(String(value ?? 'NaN'));

const expectClose = (actual: number, expected: number, what: string) => {
  if (Math.abs(actual - expected) > TOL) {
    throw new Error(
      `${what}: expected ${expected.toFixed(3)}, got ${actual.toFixed(3)} ` +
        `(off by ${(actual - expected).toFixed(3)} px, tolerance ±${TOL})`
    );
  }
};

// ---------------------------------------------------------------------------

describe.each<CanvasMode>(['ISOMETRIC', '2D'])(
  'rendered geometry invariants — %s',
  (mode) => {
    beforeEach(() => {
      mockMode = mode;
      uiState.hoveredItem = null;
      uiState.itemControls = null;
      uiState.selectedIds = [];
    });

    describe.each(offsetCorpus(mode))('offset: $name', ({ offset }) => {
      const centre = expectedCentre(mode, offset);

      beforeEach(() => {
        mockNode = {
          id: 'n1',
          tile: TILE,
          offset,
          showLabel: true,
          labelHeight: 60
        };
      });

      it('the node PAINTS at tile + offset (Node CSS vars)', () => {
        const { container } = render(<Node node={mockNode as never} order={0} />);
        const transform = container.querySelector<HTMLElement>(
          '[data-drag-id] > div'
        );
        expect(transform).not.toBeNull();
        const style = transform!.style;
        const x = px(style.getPropertyValue('--ff-x')) +
          px(style.getPropertyValue('--ff-off-x'));
        const y = px(style.getPropertyValue('--ff-y')) +
          px(style.getPropertyValue('--ff-off-y'));
        expectClose(x, centre.x, 'node paint x');
        expectClose(y, centre.y, 'node paint y');
      });

      it('the selection chrome FRAMES the painted position', () => {
        uiState.itemControls = { type: 'ITEM', id: 'n1' };
        const { container } = render(<NodeTransformControls id="n1" />);
        const svg = container.querySelector<SVGElement>('svg');
        expect(svg).not.toBeNull();
        // The screen box is centred on the icon: left/top + half its size.
        const left = px(svg!.style.left);
        const top = px(svg!.style.top);
        const width = px(svg!.style.width);
        const height = px(svg!.style.height);
        expectClose(left + width / 2, centre.x, 'chrome centre x');
        expectClose(top + height / 2, centre.y, 'chrome centre y');
      });

      it('the hover outline TRACES the painted position', () => {
        uiState.hoveredItem = { type: 'ITEM', id: 'n1' };
        const { container } = render(<HoverOutline />);
        const svg = container.querySelector<SVGElement>('svg');
        expect(svg).not.toBeNull();
        const left = px(svg!.style.left);
        const top = px(svg!.style.top);
        const width = px(svg!.style.width);
        const height = px(svg!.style.height);
        expectClose(left + width / 2, centre.x, 'hover outline centre x');
        expectClose(top + height / 2, centre.y, 'hover outline centre y');
      });

      it('the node HIT ZONE is at the painted position, not the tile', () => {
        const scene = {
          items: [{ id: 'n1', tile: TILE, offset }],
          textBoxes: [],
          hitConnectors: [],
          rectangles: []
        };
        const hit = getItemAtTile({
          tile: TILE,
          scene,
          canvasMode: mode,
          point: centre
        });
        expect(hit).toEqual({ type: 'ITEM', id: 'n1' });

        if (bareTileCentreIsOutside(mode, offset)) {
          const bare = getStrategy(mode).toScreen(
            TILE.x,
            TILE.y,
            UNPROJECTED_TILE_SIZE
          );
          expect(
            getItemAtTile({ tile: TILE, scene, canvasMode: mode, point: bare })
          ).toBeNull();
        }
      });

      it("the node label's hit proxy sits at the painted position + anchor", () => {
        const { container } = render(
          <NodeLabelHitLayer nodes={[mockNode as never]} />
        );
        const box = container.querySelector<HTMLElement>(
          '[data-axoview-id="canvas-label-hit"]'
        );
        expect(box).not.toBeNull();
        const left = px(box!.style.left);
        const width = px(box!.style.width);
        const top = px(box!.style.top);
        const height = px(box!.style.height);
        // Chip is centred on the node's rendered x; labelHeight 60 floats it
        // above the rendered centre (chip bottom at centre.y - 60).
        expectClose(left + width / 2, centre.x, 'label hit centre x');
        expectClose(top + height, centre.y - 60, 'label hit bottom y');
      });

      it('the iso-ring chrome (rect / text box) frames tile + offset', () => {
        const from: Coords = TILE;
        const to: Coords = { x: TILE.x + 2, y: TILE.y - 1 };
        const withOffset = render(
          <TransformControls from={from} to={to} offset={offset} />
        );
        const withoutOffset = render(
          <TransformControls from={from} to={to} />
        );
        const a = withOffset.container.querySelector<SVGElement>('svg')!;
        const b = withoutOffset.container.querySelector<SVGElement>('svg')!;
        expectClose(
          px(a.style.left) - px(b.style.left),
          offset?.x ?? 0,
          'ring left shift'
        );
        expectClose(
          px(a.style.top) - px(b.style.top),
          offset?.y ?? 0,
          'ring top shift'
        );

        // R1 base-agreement tripwire (plan-author review 2026-07-24). Every
        // assertion in this file so far checks a DELTA (offset shift, corner
        // shift) — all of which stay green if `getRenderedAreaCorners` has the
        // right OFFSET math but the wrong BASE (a matrix fat-finger, the wrong
        // origin tile, a dropped `origin:'LEFT'`). And because hit-testing
        // consumes the same corners, such a base error moves render + hit +
        // chrome together, so the cross-artifact checks stay green too while
        // every rectangle visibly shifts. This is the one absolute pin that
        // closes that hole: the snapped chrome's origin is `useIsoProjection`'s
        // `position` (its own `getTilePosition` call via `getBoundingBox`,
        // independent of renderedGeometry), and it must land on the bulk path's
        // base corner. Tolerance ~1.5 px: the two derivations agree to the
        // sub-pixel in practice, but the wide band keeps this a coarse tripwire
        // (a base error is a whole tile, ~46–141 px) rather than a precision
        // assertion that would duplicate the delta checks.
        const bulkBase = getRenderedAreaCorners(
          from,
          to,
          undefined,
          makeTilePositionFn(getStrategy(mode)),
          mode
        )[0];
        const BASE_TOL = 1.5;
        expect(Math.abs(px(b.style.left) - bulkBase.x)).toBeLessThan(BASE_TOL);
        expect(Math.abs(px(b.style.top) - bulkBase.y)).toBeLessThan(BASE_TOL);
      });

      it('the WebGL rect corners carry the offset the DOM path carries', () => {
        const from: Coords = TILE;
        const to: Coords = { x: TILE.x + 2, y: TILE.y - 1 };
        const getTilePosition = makeTilePositionFn(getStrategy(mode));
        const shifted = getRenderedAreaCorners(
          from,
          to,
          offset,
          getTilePosition,
          mode
        );
        const bare = getRenderedAreaCorners(
          from,
          to,
          undefined,
          getTilePosition,
          mode
        );
        shifted.forEach((corner, i) => {
          expectClose(
            corner.x - bare[i].x,
            offset?.x ?? 0,
            `WebGL corner ${i} x shift`
          );
          expectClose(
            corner.y - bare[i].y,
            offset?.y ?? 0,
            `WebGL corner ${i} y shift`
          );
        });
      });

      it('a text box FRAMES and HIT-TESTS at its drawn area', () => {
        const textBox = {
          id: 'tb1',
          tile: TILE,
          orientation: 'X' as const,
          size: { width: 2, height: 1 },
          offset
        };
        const to = getTextBoxEndTile(textBox as never, textBox.size);

        // Chrome: the ring shifts by exactly the residual.
        const shifted = render(
          <TransformControls from={TILE} to={to} offset={offset} />
        );
        const bare = render(<TransformControls from={TILE} to={to} />);
        const a = shifted.container.querySelector<SVGElement>('svg')!;
        const b = bare.container.querySelector<SVGElement>('svg')!;
        expectClose(
          px(a.style.left) - px(b.style.left),
          offset?.x ?? 0,
          'text box ring left shift'
        );
        expectClose(
          px(a.style.top) - px(b.style.top),
          offset?.y ?? 0,
          'text box ring top shift'
        );

        // Hit zone: the drawn anchor-tile centre resolves to the text box.
        const hit = getItemAtTile({
          tile: TILE,
          scene: {
            items: [],
            textBoxes: [textBox as never],
            hitConnectors: [],
            rectangles: []
          },
          canvasMode: mode,
          point: centre
        });
        expect(hit).toEqual({ type: 'TEXTBOX', id: 'tb1' });
      });

      it('a rectangle HIT ZONE follows the drawn area', () => {
        const from: Coords = TILE;
        const to: Coords = { x: TILE.x + 2, y: TILE.y - 1 };
        const getTilePosition = makeTilePositionFn(getStrategy(mode));
        const corners = getRenderedAreaCorners(
          from,
          to,
          offset,
          getTilePosition,
          mode
        );
        const point = {
          x: (corners[0].x + corners[2].x) / 2,
          y: (corners[0].y + corners[2].y) / 2
        };
        const scene = {
          items: [],
          textBoxes: [],
          hitConnectors: [],
          rectangles: [{ id: 'r1', from, to, offset }]
        };
        const hit = getItemAtTile({
          tile: TILE,
          scene,
          canvasMode: mode,
          point
        });
        expect(hit).toEqual({ type: 'RECTANGLE', id: 'r1' });

        // …and NOT at the cell it vacated. This is the E3 tightening: the old
        // tile-granular test rounded the point back into the shape's un-offset
        // frame, so the vacated cell stayed grabbable. Whether the vacated
        // centre is genuinely outside is derived independently — convert the
        // residual to tile units and compare against the area's half-extents.
        const shiftTiles = getStrategy(mode).fromCanvasPoint(
          offset?.x ?? 0,
          offset?.y ?? 0,
          UNPROJECTED_TILE_SIZE
        );
        const halfTilesX = (Math.abs(to.x - from.x) + 1) / 2;
        const halfTilesY = (Math.abs(to.y - from.y) + 1) / 2;
        if (
          offset &&
          (Math.abs(shiftTiles.x) > halfTilesX ||
            Math.abs(shiftTiles.y) > halfTilesY)
        ) {
          const vacated = { x: point.x - offset.x, y: point.y - offset.y };
          expect(
            getItemAtTile({ tile: TILE, scene, canvasMode: mode, point: vacated })
          ).toBeNull();
        }
      });
    });
  }
);
