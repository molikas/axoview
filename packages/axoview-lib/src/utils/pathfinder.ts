import { Size, Coords } from 'src/types';

interface Args {
  gridSize: Size;
  from: Coords;
  to: Coords;
}

// The grid the connector router operates on never has obstacles, so A* over
// it was busywork — every call allocated a fresh PF.Grid (W×H Node objects)
// and ran a search whose answer is determined by geometry alone. During a
// connector drag this allocated tens of MB/sec of garbage and burned the
// main thread. We compute the path directly instead: step diagonally toward
// the target until one axis matches, then orthogonally — equivalent to A*'s
// answer with diagonal movement on an empty grid, modulo cosmetic tie-break.
//
// The gridSize argument is retained for API compatibility with isoMath.ts
// callers and is ignored.
export const findPath = ({ from, to }: Args): Coords[] => {
  const path: Coords[] = [{ x: from.x, y: from.y }];

  let x = from.x;
  let y = from.y;

  while (x !== to.x || y !== to.y) {
    if (x < to.x) x += 1;
    else if (x > to.x) x -= 1;
    if (y < to.y) y += 1;
    else if (y > to.y) y -= 1;
    path.push({ x, y });
  }

  return path;
};
