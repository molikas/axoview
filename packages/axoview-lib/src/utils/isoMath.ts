// Isometric coordinate math, tile operations, connector path helpers, and text measurement.
// All functions here are pure — no React dependencies, no store access.

import { produce } from 'immer';
import {
  UNPROJECTED_TILE_SIZE,
  PROJECTED_TILE_SIZE,
  ZOOM_INCREMENT,
  MAX_ZOOM,
  MIN_ZOOM,
  TEXTBOX_PADDING,
  CONNECTOR_SEARCH_OFFSET,
  DEFAULT_FONT_FAMILY,
  TEXTBOX_DEFAULTS,
  TEXTBOX_FONT_WEIGHT,
  CANVAS_RICHTEXT_SCALE
} from 'src/config';
import {
  Coords,
  TileOrigin,
  Connector,
  Size,
  ConnectorAnchor,
  ItemReference,
  Rect,
  ProjectionOrientationEnum,
  BoundingBox,
  TextBox,
  View,
  AnchorPosition
} from 'src/types';
import { CoordsUtils } from 'src/utils/coordsUtils';
import { SizeUtils } from 'src/utils/sizeUtils';
import { findPath } from 'src/utils/pathfinder';
import {
  clamp,
  roundToTwoDecimalPlaces,
  toPx,
  getItemByIdOrThrow
} from 'src/utils/common';

// ---------------------------------------------------------------------------
// Tile coordinate transforms
// ---------------------------------------------------------------------------

interface ScreenToIso {
  mouse: Coords;
  zoom: number;
  scroll: { position: Coords };
  rendererSize: Size;
}

export const screenToIso = ({
  mouse,
  zoom,
  scroll,
  rendererSize
}: ScreenToIso) => {
  const projectedTileSize = SizeUtils.multiply(PROJECTED_TILE_SIZE, zoom);
  const halfW = projectedTileSize.width / 2;
  const halfH = projectedTileSize.height / 2;

  const projectPosition = {
    x: -rendererSize.width * 0.5 + mouse.x - scroll.position.x,
    y: -rendererSize.height * 0.5 + mouse.y - scroll.position.y
  };

  return {
    x: Math.floor(
      (projectPosition.x + halfW) / projectedTileSize.width -
        projectPosition.y / projectedTileSize.height
    ),
    y: -Math.floor(
      (projectPosition.y + halfH) / projectedTileSize.height +
        projectPosition.x / projectedTileSize.width
    )
  };
};

interface GetTilePosition {
  tile: Coords;
  origin?: TileOrigin;
}

export const getTilePosition = ({
  tile,
  origin = 'CENTER'
}: GetTilePosition) => {
  const halfW = PROJECTED_TILE_SIZE.width / 2;
  const halfH = PROJECTED_TILE_SIZE.height / 2;

  const position: Coords = {
    x: halfW * tile.x - halfW * tile.y,
    y: -(halfH * tile.x + halfH * tile.y)
  };

  switch (origin) {
    case 'TOP':
      return CoordsUtils.add(position, { x: 0, y: -halfH });
    case 'BOTTOM':
      return CoordsUtils.add(position, { x: 0, y: halfH });
    case 'LEFT':
      return CoordsUtils.add(position, { x: -halfW, y: 0 });
    case 'RIGHT':
      return CoordsUtils.add(position, { x: halfW, y: 0 });
    case 'CENTER':
    default:
      return position;
  }
};

type IsoToScreen = GetTilePosition & { rendererSize: Size };

export const isoToScreen = ({ tile, origin, rendererSize }: IsoToScreen) => {
  const position = getTilePosition({ tile, origin });
  return {
    x: position.x + rendererSize.width / 2,
    y: position.y + rendererSize.height / 2
  };
};

// ---------------------------------------------------------------------------
// Tile set operations
// ---------------------------------------------------------------------------

export const sortByPosition = (tiles: Coords[]) => {
  const xSorted = [...tiles].sort((a, b) => a.x - b.x);
  const ySorted = [...tiles].sort((a, b) => a.y - b.y);

  const highest = {
    byX: xSorted[xSorted.length - 1],
    byY: ySorted[ySorted.length - 1]
  };
  const lowest = { byX: xSorted[0], byY: ySorted[0] };

  return {
    byX: xSorted,
    byY: ySorted,
    highest,
    lowest,
    lowX: lowest.byX.x,
    lowY: lowest.byY.y,
    highX: highest.byX.x,
    highY: highest.byY.y
  };
};

export const getGridSubset = (tiles: Coords[]) => {
  const { lowX, lowY, highX, highY } = sortByPosition(tiles);
  const subset: Coords[] = [];
  for (let x = lowX; x < highX + 1; x += 1) {
    for (let y = lowY; y < highY + 1; y += 1) {
      subset.push({ x, y });
    }
  }
  return subset;
};

export const isWithinBounds = (tile: Coords, bounds: Coords[]) => {
  const { lowX, lowY, highX, highY } = sortByPosition(bounds);
  return tile.x >= lowX && tile.x <= highX && tile.y >= lowY && tile.y <= highY;
};

export const getBoundingBox = (
  tiles: Coords[],
  offset: Coords = CoordsUtils.zero()
): BoundingBox => {
  const { lowX, lowY, highX, highY } = sortByPosition(tiles);
  return [
    { x: lowX - offset.x, y: lowY - offset.y },
    { x: highX + offset.x, y: lowY - offset.y },
    { x: highX + offset.x, y: highY + offset.y },
    { x: lowX - offset.x, y: highY + offset.y }
  ];
};

export const getBoundingBoxSize = (boundingBox: Coords[]): Size => {
  const { lowX, lowY, highX, highY } = sortByPosition(boundingBox);
  return { width: highX - lowX + 1, height: highY - lowY + 1 };
};

// ---------------------------------------------------------------------------
// Isometric projection CSS
// ---------------------------------------------------------------------------

const isoProjectionBaseValues = [0.707, -0.409, 0.707, 0.409, 0, -0.816];

export const getIsoMatrix = (
  orientation?: keyof typeof ProjectionOrientationEnum
) => {
  switch (orientation) {
    case ProjectionOrientationEnum.Y:
      return produce(isoProjectionBaseValues, (draft) => {
        draft[1] = -draft[1];
        draft[2] = -draft[2];
      });
    case ProjectionOrientationEnum.X:
    default:
      return isoProjectionBaseValues;
  }
};

export const getIsoProjectionCss = (
  orientation?: keyof typeof ProjectionOrientationEnum
) => {
  return `matrix(${getIsoMatrix(orientation).join(', ')})`;
};

export const getTranslateCSS = (translate: Coords = { x: 0, y: 0 }) =>
  `translate(${translate.x}px, ${translate.y}px)`;

// ---------------------------------------------------------------------------
// Zoom helpers
// ---------------------------------------------------------------------------

export const incrementZoom = (zoom: number) =>
  roundToTwoDecimalPlaces(clamp(zoom + ZOOM_INCREMENT, MIN_ZOOM, MAX_ZOOM));

export const decrementZoom = (zoom: number) =>
  roundToTwoDecimalPlaces(clamp(zoom - ZOOM_INCREMENT, MIN_ZOOM, MAX_ZOOM));

// ---------------------------------------------------------------------------
// Connector anchor helpers
// ---------------------------------------------------------------------------

export const getAllAnchors = (connectors: Connector[]) =>
  connectors.reduce(
    (acc, connector) => [...acc, ...connector.anchors],
    [] as ConnectorAnchor[]
  );

export const getAnchorTile = (anchor: ConnectorAnchor, view: View): Coords => {
  if (anchor.ref.item) {
    const viewItem = getItemByIdOrThrow(view.items, anchor.ref.item).value;
    return viewItem.tile;
  }
  if (anchor.ref.anchor) {
    const allAnchors = getAllAnchors(view.connectors ?? []);
    const nextAnchor = getItemByIdOrThrow(allAnchors, anchor.ref.anchor).value;
    return getAnchorTile(nextAnchor, view);
  }
  if (anchor.ref.tile) {
    return anchor.ref.tile;
  }
  throw new Error('Could not get anchor tile.');
};

export const getAnchorAtTile = (tile: Coords, anchors: ConnectorAnchor[]) =>
  anchors.find((anchor) =>
    Boolean(anchor.ref.tile && CoordsUtils.isEqual(anchor.ref.tile, tile))
  );

export const getAnchorParent = (anchorId: string, connectors: Connector[]) => {
  const connector = connectors.find((con) =>
    con.anchors.find((anchor) => anchor.id === anchorId)
  );
  if (!connector)
    throw new Error(`Could not find connector with anchor id ${anchorId}`);
  return connector;
};

// ---------------------------------------------------------------------------
// Connector path computation
// ---------------------------------------------------------------------------

export const normalisePositionFromOrigin = ({
  position,
  origin
}: {
  position: Coords;
  origin: Coords;
}) => CoordsUtils.subtract(origin, position);

interface GetConnectorPath {
  anchors: ConnectorAnchor[];
  view: View;
}

export const getConnectorPath = ({
  anchors,
  view
}: GetConnectorPath): { tiles: Coords[]; rectangle: Rect } => {
  if (anchors.length < 2)
    throw new Error(
      `Connector needs at least two anchors (received: ${anchors.length})`
    );

  const anchorPosition = anchors.map((anchor) => getAnchorTile(anchor, view));
  const searchArea = getBoundingBox(anchorPosition, CONNECTOR_SEARCH_OFFSET);
  const sorted = sortByPosition(searchArea);
  const searchAreaSize = getBoundingBoxSize(searchArea);
  const rectangle = {
    from: { x: sorted.highX, y: sorted.highY },
    to: { x: sorted.lowX, y: sorted.lowY }
  };

  const positionsNormalisedFromSearchArea = anchorPosition.map((position) =>
    normalisePositionFromOrigin({ position, origin: rectangle.from })
  );

  const tiles = positionsNormalisedFromSearchArea.reduce<Coords[]>(
    (acc, position, i) => {
      if (i === 0) return acc;
      const prev = positionsNormalisedFromSearchArea[i - 1];
      const path = findPath({
        from: prev,
        to: position,
        gridSize: searchAreaSize
      });
      return [...acc, ...path];
    },
    []
  );

  return { tiles, rectangle };
};

export const connectorPathTileToGlobal = (
  tile: Coords,
  origin: Coords
): Coords =>
  CoordsUtils.subtract(
    CoordsUtils.subtract(origin, CONNECTOR_SEARCH_OFFSET),
    CoordsUtils.subtract(tile, CONNECTOR_SEARCH_OFFSET)
  );

export const getConnectorsByViewItem = (
  viewItemId: string,
  connectors: Connector[]
) =>
  connectors.filter((connector) =>
    connector.anchors.find((anchor) => anchor.ref.item === viewItemId)
  );

export const getConnectorDirectionIcon = (connectorTiles: Coords[]) => {
  if (connectorTiles.length < 2) return null;

  const iconTile = connectorTiles[connectorTiles.length - 2];
  const lastTile = connectorTiles[connectorTiles.length - 1];
  let rotation: number | undefined;

  if (lastTile.x > iconTile.x) {
    rotation =
      lastTile.y > iconTile.y ? 135 : lastTile.y < iconTile.y ? 45 : 90;
  } else if (lastTile.x < iconTile.x) {
    rotation =
      lastTile.y > iconTile.y ? -135 : lastTile.y < iconTile.y ? -45 : -90;
  } else {
    rotation =
      lastTile.y > iconTile.y ? 180 : lastTile.y < iconTile.y ? 0 : -90;
  }

  return {
    x: iconTile.x * UNPROJECTED_TILE_SIZE + UNPROJECTED_TILE_SIZE / 2,
    y: iconTile.y * UNPROJECTED_TILE_SIZE + UNPROJECTED_TILE_SIZE / 2,
    rotation
  };
};

// ---------------------------------------------------------------------------
// Misc geometry helpers
// ---------------------------------------------------------------------------

export const getRectangleFromSize = (from: Coords, size: Size) => ({
  from,
  to: { x: from.x + size.width, y: from.y + size.height }
});

export const hasMovedTile = (mouse: { delta: { tile: Coords } | null }) => {
  if (!mouse.delta) return false;
  return !CoordsUtils.isEqual(mouse.delta.tile, CoordsUtils.zero());
};

export const getTileScrollPosition = (
  tile: Coords,
  origin?: TileOrigin
): Coords => {
  const tilePosition = getTilePosition({ tile, origin });
  return { x: -tilePosition.x, y: -tilePosition.y };
};

export const outermostCornerPositions: TileOrigin[] = [
  'BOTTOM',
  'RIGHT',
  'TOP',
  'LEFT'
];

export const convertBoundsToNamedAnchors = (
  boundingBox: BoundingBox
): { [key in AnchorPosition]: Coords } => ({
  BOTTOM_LEFT: boundingBox[0],
  BOTTOM_RIGHT: boundingBox[1],
  TOP_RIGHT: boundingBox[2],
  TOP_LEFT: boundingBox[3]
});

// ---------------------------------------------------------------------------
// Text box measurement
// ---------------------------------------------------------------------------

export const getTextBoxEndTile = (textBox: TextBox, size: Size) => {
  if (textBox.orientation === ProjectionOrientationEnum.X) {
    return CoordsUtils.add(textBox.tile, { x: size.width, y: 0 });
  }
  return CoordsUtils.add(textBox.tile, { x: 0, y: -size.width });
};

const getPlainTextForMeasurement = (content: string): string => {
  if (!content?.trim().startsWith('<')) return content;
  const lines = content
    .split(/<\/p>|<\/div>|<br\s*\/?>/i)
    .map((s) =>
      s
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim()
    )
    .filter(Boolean);
  return lines.reduce((a, b) => (a.length > b.length ? a : b), '');
};

// Approximate vertical space (in user-fontSize units) each block contributes
// once rendered with CANVAS_RICHTEXT_SCALE + the margins declared in
// useTextBoxProps. Computed as: font-size-em × line-height + margin-top-em
// + margin-bottom-em. Keep in sync with richTextStyles in useTextBoxProps.ts
// — drift here means the auto-grown bounds clip the rendered content.
const BLOCK_HEIGHT_UNITS: Record<string, number> = {
  h1: 1.875 * 1.2 + 0.8 + 0.3, // 3.35
  h2: 1.5 * 1.25 + 0.7 + 0.25, // 2.825
  h3: 1.25 * 1.3 + 0.6 + 0.2, // 2.425
  h4: 1.1 * 1.4 + 0.4 + 0.2, // 2.14
  h5: 1.0 * 1.4 + 0.3 + 0.2, // 1.9
  h6: 1.0 * 1.4 + 0.3 + 0.2, // 1.9
  p: 1.0 * 1.5 + 0 + 0.4, // 1.9
  li: 1.0 * 1.5 + 0 + 0.2, // 1.7
  blockquote: 1.0 * 1.5 + 0.5 + 0.5, // 2.5
  pre: 0.9 * 1.5 + 0.5 + 0.5 // 2.35
};

/** @internal exported for unit-testing the per-block weighting only. */
export const countHtmlLines = (content: string): number => {
  if (!content?.trim().startsWith('<')) return 1;
  const re = /<\/(p|li|h[1-6]|blockquote|pre)>/gi;
  let total = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const tag = m[1].toLowerCase();
    total += BLOCK_HEIGHT_UNITS[tag] ?? 1.0;
  }
  return Math.max(1, total);
};

// Extract per-block plain text + scale so width measurement can account for
// headers rendering bigger than body. Returns at least one block so callers
// can always measure something; falls back to the longest-line heuristic for
// HTML the regex doesn't recognise.
/** @internal exported for unit-testing the per-block scaling only. */
export const splitIntoMeasurableBlocks = (
  content: string
): Array<{ text: string; scale: number }> => {
  if (!content?.trim().startsWith('<')) {
    return [{ text: content || '', scale: 1.0 }];
  }
  const blocks: Array<{ text: string; scale: number }> = [];
  const re =
    /<(p|li|h([1-6])|blockquote|pre)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const tag = m[1].toLowerCase();
    const text = m[3]
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
    if (!text) continue;
    const scale =
      CANVAS_RICHTEXT_SCALE[tag as keyof typeof CANVAS_RICHTEXT_SCALE] ?? 1.0;
    blocks.push({ text, scale });
  }
  if (blocks.length === 0) {
    return [{ text: getPlainTextForMeasurement(content), scale: 1.0 }];
  }
  return blocks;
};

export const getTextWidth = (
  text: string,
  fontProps: {
    fontWeight: number | string;
    fontSize: number;
    fontFamily: string;
  }
) => {
  if (!text) return 0;
  const paddingX = TEXTBOX_PADDING * UNPROJECTED_TILE_SIZE;
  const fontSizePx = toPx(fontProps.fontSize * UNPROJECTED_TILE_SIZE);
  const canvas: HTMLCanvasElement = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not get canvas context');
  context.font = `${fontProps.fontWeight} ${fontSizePx} ${fontProps.fontFamily}`;
  const metrics = context.measureText(text);
  canvas.remove();
  return (metrics.width + paddingX * 2) / UNPROJECTED_TILE_SIZE - 0.8;
};

export const getTextBoxDimensions = (textBox: TextBox): Size => {
  const fontSize = textBox.fontSize ?? TEXTBOX_DEFAULTS.fontSize;
  // Measure each block at its CANVAS_RICHTEXT_SCALE-scaled size and take the
  // widest. A long <h1> at scale 1.6 needs 60% more horizontal room than a
  // body paragraph with the same character count.
  const blocks = splitIntoMeasurableBlocks(textBox.content);
  let width = 0;
  for (const b of blocks) {
    const w = getTextWidth(b.text, {
      fontSize: fontSize * b.scale,
      fontFamily: DEFAULT_FONT_FAMILY,
      fontWeight: TEXTBOX_FONT_WEIGHT
    });
    if (w > width) width = w;
  }
  // countHtmlLines now returns a weighted unit total (headers count for more);
  // multiplying by fontSize gives the rendered height in tile units.
  const lineUnits = countHtmlLines(textBox.content);
  const height = Math.max(1, Math.ceil(lineUnits * fontSize));
  return { width, height };
};
