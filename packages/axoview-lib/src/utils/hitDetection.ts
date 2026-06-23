// Hit detection: find which scene item (if any) sits at a given isometric tile.
// Kept separate from isoMath.ts so the WeakMap spatial index is isolated and testable.

import { Coords, Size, ItemReference, TextBox } from 'src/types';
import {
  getBoundingBox,
  isWithinBounds,
  connectorPathTileToGlobal,
  getTextBoxEndTile
} from 'src/utils/isoMath';

// Explicit scene shape — avoids importing the full useScene hook type here.
export interface HitTestScene {
  items: Array<{ id: string; tile: Coords }>;
  textBoxes: Array<TextBox & { size: Size }>;
  hitConnectors: Array<{
    id: string;
    path?: { tiles: Coords[]; rectangle: { from: Coords } };
  }>;
  rectangles: Array<{ id: string; from: Coords; to: Coords }>;
}

// WeakMap-based spatial index: one Map<"x,y", id> per unique scene.items array reference.
// Building the index is O(N) once; lookups are O(1). GC'd when items array is replaced.
const itemTileIndexCache = new WeakMap<
  HitTestScene['items'],
  Map<string, string>
>();

const getItemTileIndex = (
  items: HitTestScene['items']
): Map<string, string> => {
  if (!itemTileIndexCache.has(items)) {
    itemTileIndexCache.set(
      items,
      new Map(items.map((item) => [`${item.tile.x},${item.tile.y}`, item.id]))
    );
  }
  return itemTileIndexCache.get(items)!;
};

export const getItemAtTile = ({
  tile,
  scene
}: {
  tile: Coords;
  scene: HitTestScene;
}): ItemReference | null => {
  const tileIndex = getItemTileIndex(scene.items);
  const itemId = tileIndex.get(`${tile.x},${tile.y}`);

  // The index already maps tile → id; return it directly. (SPATIAL-1: the old
  // code did an O(1) Map lookup and then threw the id away with an O(N)
  // scene.items.find to recover an object whose only field we use is the id.)
  if (itemId !== undefined) return { type: 'ITEM', id: itemId };

  const textBox = scene.textBoxes.find((tb) => {
    const textBoxTo = getTextBoxEndTile(tb, tb.size);
    const textBoxBounds = getBoundingBox([
      tb.tile,
      {
        x: Math.ceil(textBoxTo.x),
        y:
          tb.orientation === 'X'
            ? Math.ceil(textBoxTo.y)
            : Math.floor(textBoxTo.y)
      }
    ]);
    return isWithinBounds(tile, textBoxBounds);
  });

  if (textBox) return { type: 'TEXTBOX', id: textBox.id };

  const connector = scene.hitConnectors.find((con) => {
    if (!con.path?.tiles) return false;
    const pathTiles = con.path.tiles;
    const origin = con.path.rectangle.from;

    // B5: connector lines render ~1-2px wide, so exact tile equality made them
    // near-impossible to click. Accept any query tile within Chebyshev-1 (the
    // 8-neighbourhood, max(|dx|,|dy|) <= 1) of a path tile.
    //
    // Exception — a NODE-anchored endpoint sits ON the node's tile, so that ±1
    // halo ballooned the connector's hit region into the whole ring of empty
    // tiles AROUND a connected node: a left-click just beside the node selected
    // the connector (and opened its context menu) instead of clearing the
    // selection / switching to pointer (reported confusion). When the query tile
    // is in the 8-neighbourhood of a node-anchored endpoint, drop the tolerance
    // and require an EXACT path-tile match: the visible line still selects, the
    // node remains its own hit target, and the empty tiles beside it are free
    // again. Free-floating (tile) endpoints keep the halo — their thin loose end
    // needs it. Endpoints are pathTiles[0] / pathTiles[last]; "node-anchored" ==
    // that global tile is occupied by an item (tileIndex hit).
    let nearNodeEndpoint = false;
    for (let k = 0; k < 2 && !nearNodeEndpoint; k += 1) {
      const endTile = k === 0 ? pathTiles[0] : pathTiles[pathTiles.length - 1];
      const g = connectorPathTileToGlobal(endTile, origin);
      if (
        tileIndex.has(`${g.x},${g.y}`) &&
        Math.abs(g.x - tile.x) <= 1 &&
        Math.abs(g.y - tile.y) <= 1
      ) {
        nearNodeEndpoint = true;
      }
    }

    // Computed inline (no per-tile allocation) — this runs per pointer event.
    return pathTiles.some((pathTile) => {
      const globalPathTile = connectorPathTileToGlobal(pathTile, origin);
      const dx = Math.abs(globalPathTile.x - tile.x);
      const dy = Math.abs(globalPathTile.y - tile.y);
      if (dx === 0 && dy === 0) return true;
      if (nearNodeEndpoint) return false;
      return dx <= 1 && dy <= 1;
    });
  });

  if (connector) return { type: 'CONNECTOR', id: connector.id };

  const rectangle = [...scene.rectangles]
    .reverse()
    .find(({ from, to }) => isWithinBounds(tile, [from, to]));

  if (rectangle) return { type: 'RECTANGLE', id: rectangle.id };

  return null;
};
