/**
 * Lasso ⇄ FreehandLasso entity-type PARITY (structural regression guard).
 *
 * Recurring failure mode (this session: floating Labels): a new canvas element
 * type gets wired into ONE selection/movement path but not its siblings, so it
 * silently can't be marquee-selected (or, once selected, can't be group-dragged).
 * The freehand marquee, for one, never enumerated labels at all while the
 * rectangular marquee did.
 *
 * This test pins the invariant with the SAME scene through BOTH lasso modes and
 * asserts each returns the SAME set of user-facing entity types. Add a new
 * placeable element and forget to teach one collector about it → this fails.
 * (Group-drag movement parity for those same types lives in
 * __perf_refactor_regression__/DragItems.modes.test.ts.)
 *
 * Real utils, no geometry mocks — the marquee/polygon genuinely covers the
 * cluster, mirroring Lasso.intersection.test.ts.
 */
import { Lasso } from 'src/interaction/modes/Lasso';
import { FreehandLasso } from 'src/interaction/modes/FreehandLasso';
import { ItemReference } from 'src/types';

// One of every user-facing, marquee-selectable canvas element, clustered inside
// a 0..4 tile box. CONNECTOR uses free-floating (tile-bound) endpoints so it is
// captured by geometry alone (no node lookup needed).
const scene = () => ({
  items: [{ id: 'n1', tile: { x: 2, y: 2 } }],
  rectangles: [{ id: 'r1', from: { x: 0, y: 0 }, to: { x: 3, y: 3 } }],
  textBoxes: [
    {
      id: 't1',
      tile: { x: 1, y: 1 },
      orientation: 'X',
      size: { width: 1, height: 1 }
    }
  ],
  labels: [{ id: 'l1', tile: { x: 2, y: 3 }, text: 'x' }],
  connectors: [
    {
      id: 'c1',
      anchors: [
        { id: 'e0', ref: { tile: { x: 1, y: 2 } } },
        { id: 'e1', ref: { tile: { x: 3, y: 2 } } }
      ]
    }
  ]
});

// The set of entity types the app expects EVERY marquee to be able to capture.
// Adding a new placeable type? Add it here and to both collectors.
const EXPECTED_TYPES = ['ITEM', 'RECTANGLE', 'TEXTBOX', 'LABEL', 'CONNECTOR'];

const typesOf = (refs: ItemReference[]) =>
  new Set(refs.map((r) => r.type).filter((t) => EXPECTED_TYPES.includes(t)));

function rectangularMarquee(sc: any): ItemReference[] {
  let captured: ItemReference[] = [];
  const uiState: any = {
    mode: { type: 'LASSO', selection: null, isDragging: false },
    mouse: {
      delta: { tile: { x: 1, y: 1 } },
      mousedown: { tile: { x: -1, y: -1 }, screen: { x: 0, y: 0 } },
      position: { tile: { x: 5, y: 5 } }
    },
    actions: {
      setMode: (next: any) => {
        if (next?.selection) captured = next.selection.items;
      }
    }
  };
  Lasso.mousemove!({
    uiState,
    scene: sc,
    isRendererInteraction: true,
    isItemInteractable: () => true
  } as any);
  return captured;
}

function freehandMarquee(sc: any): ItemReference[] {
  let captured: ItemReference[] = [];
  // screen/10 = tile. A big square screen path → tile polygon (-5,-5)..(6,6),
  // comfortably enclosing the 0..4 cluster.
  const path = [
    { x: -50, y: -50 },
    { x: 60, y: -50 },
    { x: 60, y: 60 },
    { x: -50, y: 60 }
  ];
  const uiState: any = {
    mode: { type: 'FREEHAND_LASSO', path, selection: null, isDragging: false },
    mouse: { mousedown: { tile: { x: 0, y: 0 } } },
    zoom: 1,
    scroll: { x: 0, y: 0 },
    rendererEl: { getBoundingClientRect: () => ({ width: 800, height: 600 }) },
    actions: {
      setMode: (next: any) => {
        if (next?.selection) captured = next.selection.items;
      },
      setSelectedIds: (refs: ItemReference[]) => {
        captured = refs;
      }
    }
  };
  FreehandLasso.mouseup!({
    uiState,
    scene: sc,
    isRendererInteraction: true,
    isItemInteractable: () => true,
    screenToTile: ({ mouse }: any) => ({ x: mouse.x / 10, y: mouse.y / 10 })
  } as any);
  return captured;
}

describe('Lasso ⇄ FreehandLasso entity-type parity', () => {
  it('rectangular marquee captures every expected element type', () => {
    expect(typesOf(rectangularMarquee(scene()))).toEqual(new Set(EXPECTED_TYPES));
  });

  it('freehand marquee captures every expected element type', () => {
    expect(typesOf(freehandMarquee(scene()))).toEqual(new Set(EXPECTED_TYPES));
  });

  it('both marquees agree on the captured type set (no path-specific gaps)', () => {
    expect(typesOf(freehandMarquee(scene()))).toEqual(
      typesOf(rectangularMarquee(scene()))
    );
  });
});
