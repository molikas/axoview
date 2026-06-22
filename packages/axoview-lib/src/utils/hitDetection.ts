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
    return con.path.tiles.find((pathTile) => {
      const globalPathTile = connectorPathTileToGlobal(
        pathTile,
        con.path!.rectangle.from
      );
      // B5: connector lines render ~1-2px wide, so exact tile equality made them
      // near-impossible to click. Accept any query tile within Chebyshev-1
      // (the 8-neighbourhood, max(|dx|,|dy|) <= 1) of a path tile. Computed
      // inline to avoid per-pointer-event allocations in this hot path.
      return (
        Math.abs(globalPathTile.x - tile.x) <= 1 &&
        Math.abs(globalPathTile.y - tile.y) <= 1
      );
    });
  });

  if (connector) return { type: 'CONNECTOR', id: connector.id };

  const rectangle = [...scene.rectangles]
    .reverse()
    .find(({ from, to }) => isWithinBounds(tile, [from, to]));

  if (rectangle) return { type: 'RECTANGLE', id: rectangle.id };

  return null;
};
