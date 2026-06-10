import {
  Size,
  InitialData,
  Icon,
  Connector,
  TextBox,
  ViewItem,
  View,
  Rectangle,
  Colors
} from 'src/types';
import { CoordsUtils } from 'src/utils';
import { customVars } from './styles/theme';

// TODO: This file could do with better organisation and convention for easier reading.
export const UNPROJECTED_TILE_SIZE = 100;
export const TILE_PROJECTION_MULTIPLIERS: Size = {
  width: 1.415,
  height: 0.819
};
export const PROJECTED_TILE_SIZE = {
  width: UNPROJECTED_TILE_SIZE * TILE_PROJECTION_MULTIPLIERS.width,
  height: UNPROJECTED_TILE_SIZE * TILE_PROJECTION_MULTIPLIERS.height
};

export const DEFAULT_COLOR: Colors[0] = {
  id: '__DEFAULT__',
  value: customVars.customPalette.defaultColor
};

export const DEFAULT_FONT_FAMILY = 'Roboto, Arial, sans-serif';

export const VIEW_DEFAULTS: Required<
  Omit<View, 'id' | 'description' | 'lastUpdated' | 'layers'>
> = {
  name: 'Page 1',
  items: [],
  connectors: [],
  rectangles: [],
  textBoxes: []
};

export const VIEW_ITEM_DEFAULTS: Required<
  Omit<ViewItem, 'id' | 'tile' | 'zIndex' | 'layerId' | 'showLabel'>
> = {
  labelHeight: 80,
  labelFontSize: 14,
  labelColor: ''
};

export const CONNECTOR_DEFAULTS: Required<
  Omit<Connector, 'id' | 'color' | 'layerId' | 'name' | 'notes' | 'headerLink' | 'showLabel'>
> = {
  width: 10,
  description: '',
  startLabel: '',
  endLabel: '',
  startLabelHeight: 0,
  centerLabelHeight: 0,
  endLabelHeight: 0,
  labels: [],
  customColor: '',
  anchors: [],
  style: 'SOLID',
  lineType: 'SINGLE',
  showArrow: true
};

// The boundaries of the search area for the pathfinder algorithm
// is the grid that encompasses the two nodes + the offset below.
export const CONNECTOR_SEARCH_OFFSET = { x: 1, y: 1 };

export const TEXTBOX_DEFAULTS: Required<
  Omit<TextBox, 'id' | 'tile' | 'layerId' | 'name'>
> = {
  orientation: 'X',
  fontSize: 0.6,
  content: 'Text',
  color: '',
  isBold: false,
  isItalic: false,
  isUnderline: false
};

export const TEXTBOX_PADDING = 0.2;
export const TEXTBOX_FONT_WEIGHT = 'normal';

// Canvas rich-text typography scale (MQA #11). Mirrored in:
//   - useTextBoxProps.ts (visual styles applied to dangerouslySetInnerHTML span)
//   - isoMath.ts (dimension measurement so the textbox bounds contain the
//     rendered content)
// Values are em-multipliers applied on top of the user's base fontSize.
// Keep the two consumers in sync — drift here means the rendered content
// overflows the auto-grown bounds.
export const CANVAS_RICHTEXT_SCALE = {
  h1: 1.875,
  h2: 1.5,
  h3: 1.25,
  h4: 1.1,
  h5: 1.0,
  h6: 1.0,
  p: 1.0,
  li: 1.0,
  blockquote: 1.0,
  pre: 0.9
} as const;

export const RECTANGLE_DEFAULTS: Required<
  Omit<Rectangle, 'id' | 'from' | 'to' | 'color' | 'layerId' | 'name'>
> = {
  customColor: ''
};

export const ZOOM_INCREMENT = 0.05;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 1;
export const TRANSFORM_ANCHOR_SIZE = 30;
export const TRANSFORM_CONTROLS_COLOR = '#0392ff';
export const INITIAL_DATA: InitialData = {
  title: 'Untitled',
  version: '',
  icons: [],
  colors: [DEFAULT_COLOR],
  items: [],
  views: [],
  fitToView: false
};
export const INITIAL_UI_STATE = {
  zoom: 0.65,
  scroll: {
    position: CoordsUtils.zero(),
    offset: CoordsUtils.zero()
  }
};
export const INITIAL_SCENE_STATE = {
  connectors: {},
  textBoxes: {}
};

export const DEFAULT_ICON: Icon = {
  id: 'default',
  name: 'block',
  isIsometric: true,
  url: ''
};

// Tombstone icon — rendered in place of any item.icon id that no longer
// resolves against model.icons. Two cases produce a tombstone:
//   1. an imported icon was deleted (ADR-0002 lifecycle section)
//   2. a paste/import references an icon id that was never present
// One render path covers both. Faded dashed-square SVG so the layout stays
// stable and the user can recover by re-importing the icon under the same id.
export const TOMBSTONE_ICON: Icon = {
  id: '__tombstone__',
  name: 'Icon removed',
  isIsometric: false,
  url:
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>" +
        "<rect x='6' y='6' width='52' height='52' rx='6' " +
        "fill='none' stroke='%23999' stroke-width='2.5' " +
        "stroke-dasharray='5 4' opacity='0.7'/>" +
        "<path d='M22 22 L42 42 M42 22 L22 42' stroke='%23999' " +
        "stroke-width='2' stroke-linecap='round' opacity='0.45'/>" +
        '</svg>'
    )
};

export const DEFAULT_LABEL_HEIGHT = 20;
export const PROJECT_BOUNDING_BOX_PADDING = 3;
