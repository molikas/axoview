/**
 * Regression tests for B3 — rectangle border clipping.
 *
 * SVG strokes are centred on the path, so a rect drawn flush to the SVG
 * viewport loses strokeWidth/2 to clipping on every edge (a 30px border
 * showed only ~15px). IsoTileArea now insets the rect by half the stroke and
 * shrinks it by the full stroke so the whole border stays inside the viewport.
 * The same DOM feeds the image export, so this also guards the export clip.
 *
 * Strategy mocking mirrors useIsoProjection.twoDY.test.tsx: we stub
 * useCanvasMode so the test doesn't depend on provider wiring. pxSize is
 * derived from the real UNPROJECTED_TILE_SIZE, so the assertions stay correct
 * if that constant ever changes.
 */

import { render } from '@testing-library/react';
import { UNPROJECTED_TILE_SIZE } from 'src/config';
import { IsoTileArea } from '../IsoTileArea';

jest.mock('src/contexts/CanvasModeContext', () => ({
  useCanvasMode: () => {
    const TILE = 100;
    const strategy = {
      projectionName: 'ISOMETRIC',
      gridTileUrl: '',
      toScreen: (x: number, y: number) => ({ x: x * TILE, y: -y * TILE }),
      fromScreen: () => ({ x: 0, y: 0 })
    };
    return {
      strategy,
      getTilePosition: ({ tile }: { tile: { x: number; y: number } }) =>
        strategy.toScreen(tile.x, tile.y),
      screenToTile: () => ({ x: 0, y: 0 }),
      getProjectionCss: () => 'matrix(1, 0, 0, 1, 0, 0)'
    };
  }
}));

// A single tile → pxSize SIZE×SIZE.
const SIZE = UNPROJECTED_TILE_SIZE;
const SINGLE_TILE = { from: { x: 0, y: 0 }, to: { x: 0, y: 0 } };

const rectOf = (container: HTMLElement): SVGRectElement => {
  const rect = container.querySelector('rect');
  if (!rect) throw new Error('IsoTileArea rendered no <rect>');
  return rect as SVGRectElement;
};

describe('IsoTileArea — border inset (B3 regression)', () => {
  it('insets a 30px stroke by half its width so the full border stays inside the viewport', () => {
    const { container } = render(
      <IsoTileArea {...SINGLE_TILE} stroke={{ width: 30, color: '#000' }} />
    );
    const rect = rectOf(container);

    // Drawn flush, a centred 30px stroke would clip 15px on every edge.
    expect(rect.getAttribute('x')).toBe('15');
    expect(rect.getAttribute('y')).toBe('15');
    expect(rect.getAttribute('width')).toBe(String(SIZE - 30));
    expect(rect.getAttribute('height')).toBe(String(SIZE - 30));
    expect(rect.getAttribute('stroke-width')).toBe('30');
    expect(rect.getAttribute('stroke')).toBe('#000');
  });

  it('reduces the corner radius by the half-stroke so rounded corners stay centred', () => {
    const { container } = render(
      <IsoTileArea
        {...SINGLE_TILE}
        cornerRadius={20}
        stroke={{ width: 30, color: '#000' }}
      />
    );
    expect(rectOf(container).getAttribute('rx')).toBe('5'); // max(0, 20 - 15)
  });

  it('clamps width / height / rx at 0 when the stroke exceeds the tile size', () => {
    const { container } = render(
      <IsoTileArea
        {...SINGLE_TILE}
        cornerRadius={4}
        stroke={{ width: SIZE + 50, color: '#000' }}
      />
    );
    const rect = rectOf(container);
    expect(rect.getAttribute('width')).toBe('0');
    expect(rect.getAttribute('height')).toBe('0');
    expect(rect.getAttribute('rx')).toBe('0');
  });

  it('leaves geometry full-bleed when there is no stroke (no fill-seam regression)', () => {
    const { container } = render(<IsoTileArea {...SINGLE_TILE} fill="#abc" />);
    const rect = rectOf(container);

    expect(rect.getAttribute('x')).toBe('0');
    expect(rect.getAttribute('y')).toBe('0');
    expect(rect.getAttribute('width')).toBe(String(SIZE));
    expect(rect.getAttribute('height')).toBe(String(SIZE));
    expect(rect.getAttribute('fill')).toBe('#abc');
  });
});
