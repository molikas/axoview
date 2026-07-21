import { getItemAtTile, HitTestScene } from 'src/utils/hitDetection';

const emptyScene = (): HitTestScene => ({
  items: [],
  textBoxes: [],
  hitConnectors: [],
  rectangles: []
});

describe('getItemAtTile — connector hit-testing robustness', () => {
  it('does not crash on an UNROUTABLE connector (empty path.tiles)', () => {
    // syncConnector's catch and paste's provisional connector both produce this
    // exact shape: tiles [] with a placeholder rectangle. Hovering must skip it,
    // not read tiles[0] and dereference undefined (the agent-diagram hover crash).
    const scene: HitTestScene = {
      ...emptyScene(),
      hitConnectors: [
        {
          id: 'c1',
          path: { tiles: [], rectangle: { from: { x: 0, y: 0 } } }
        }
      ]
    };
    expect(() =>
      getItemAtTile({ tile: { x: 0, y: 0 }, scene })
    ).not.toThrow();
    expect(getItemAtTile({ tile: { x: 0, y: 0 }, scene })).toBeNull();
  });

  it('does not crash on a connector with no scene path at all (path undefined)', () => {
    const scene: HitTestScene = {
      ...emptyScene(),
      hitConnectors: [{ id: 'c1' }]
    };
    expect(() => getItemAtTile({ tile: { x: 1, y: 1 }, scene })).not.toThrow();
  });

  it('still hits a routed connector on its path tile', () => {
    const scene: HitTestScene = {
      ...emptyScene(),
      hitConnectors: [
        {
          id: 'c1',
          path: {
            tiles: [{ x: 0, y: 0 }],
            rectangle: { from: { x: 0, y: 0 } }
          }
        }
      ]
    };
    const hit = getItemAtTile({ tile: { x: 0, y: 0 }, scene });
    expect(hit).toEqual({ type: 'CONNECTOR', id: 'c1' });
  });
});
