import { Coords, Size, Scroll } from 'src/types';
import { CoordsUtils, SizeUtils, screenToIso } from 'src/utils';
import { PROJECTED_TILE_SIZE } from 'src/config';
import { viewportCenterTile } from '../viewportCenterTile';

// Mirror renderer.test.ts helpers so the centre-tile derivation is checked
// against the same coordinate convention getMouse uses.
const getRendererSize = (tileSize: Size, zoom = 1): Size => {
  const projectedTileSize = SizeUtils.multiply(PROJECTED_TILE_SIZE, zoom);
  return {
    width: projectedTileSize.width * tileSize.width,
    height: projectedTileSize.height * tileSize.height
  };
};

const getScroll = (coords: Coords): Scroll => ({
  position: coords,
  offset: CoordsUtils.zero()
});

describe('viewportCenterTile', () => {
  it('feeds the renderer centre through the injected screenToTile', () => {
    const zoom = 1;
    const rendererSize = getRendererSize({ width: 10, height: 10 }, zoom);
    const scroll = getScroll({ x: 0, y: 0 });

    const spy = jest.fn(screenToIso);
    const tile = viewportCenterTile({
      rendererSize,
      scroll,
      zoom,
      screenToTile: spy
    });

    // Called with the renderer-relative centre point.
    expect(spy).toHaveBeenCalledWith({
      mouse: { x: rendererSize.width / 2, y: rendererSize.height / 2 },
      zoom,
      scroll,
      rendererSize
    });
    // ISO centre tile at zero scroll is the origin (matches renderer.test.ts).
    expect(tile).toEqual({ x: 0, y: -0 });
  });

  it('matches screenToIso of the centre point for a scrolled viewport', () => {
    const zoom = 1;
    const rendererSize = getRendererSize({ width: 10, height: 10 }, zoom);
    const scroll = getScroll({
      x: rendererSize.width / 2,
      y: rendererSize.height / 2
    });

    const tile = viewportCenterTile({
      rendererSize,
      scroll,
      zoom,
      screenToTile: screenToIso
    });

    expect(tile).toEqual(
      screenToIso({
        mouse: { x: rendererSize.width / 2, y: rendererSize.height / 2 },
        zoom,
        scroll,
        rendererSize
      })
    );
  });
});
